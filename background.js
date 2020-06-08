'use strict';

/* this object is a particularly ugly hack. tl;dr we can't await anything in the
   user input handler if we hope to call openPopup(), which is rather crucial
   to the whole “conditional popup” “quick mode” *thing*. so, instead of
   accessing the appropriate storage in the input handler, we close over this
   global in the storage update handlers for local.state and sync.quickmode.
   we fire off some fake updates to the values to make sure those closures run,
   then in the input handler we use these globals and pretend we've accessed
   storage. as a result, the API gains the illusion of orthogonality */
let storage_cache = {};

const msg = browser.i18n.getMessage;

const popup_able = b => browser.browserAction.setPopup({popup: b ? null : ""});

const badge = ({text, fg, bg}) => {
	browser.browserAction.setBadgeText({text: text});
	browser.browserAction.setBadgeTextColor({color: fg});
	browser.browserAction.setBadgeBackgroundColor({color: bg});
};

const union = (a, b) => a.filter(x => b.includes(x));

/* informative errors are key to a positive user experience. the fields:
   - errortitle: big and bold, general category of what went wrong
   - reason: friendly detailed description
   - details: technical output such as error.toString()s. never localisable text
   - advice: what the user might do with the information */
const catch_bookmark = async () => {
	let error = await do_bookmark();
	if (error != null) {
		browser.storage.local.set({
			error: error,
			state: 'failure'
		});
	} else {
		browser.storage.local.set({state: 'done'});
	}
}
/* if i were getting weird edge cases i would simply escape everything */
const arg = str => `"${str.split("").map(single =>
	`\\u${`0000${single.charCodeAt(0).toString(16).toUpperCase()}`.slice(-4)}`
).join("")}"`;

const do_bookmark = async () => {
	const prefs = await storage_all('sync'),
	      bookmark = await browser.storage.local.get(Object.keys(field_reads)),
	      {rawtitle, title, tags, text, url, icon} = bookmark;
	const creation_error = (error, field) =>
		error.message.startsWith("Missing host permission") ? {
			errortitle: msg("permissionErrorTitle"),
			reason: msg("contentScriptErrorReason"),
			details: error.toString(),
			advice: msg("contentScriptErrorAdvice")
		} : {
			errortitle: msg("formatErrorTitle"),
			details: error.toString(),
			advice: msg("formatErrorAdvice", field)
		};
	let favicon_fmt_out, bookmark_fmt_out;

	if (icon !== undefined) {
		try {
			let {data, hash, mime, datauri, ext} = icon;
			/* a content script is a makeshift eval sandbox. unfortunately,
			   as functions are not structured cloneable, we must evaluate
			   them in the same context that they're created */
			favicon_fmt_out = (await browser.tabs.executeScript({
				code: `((data, hash, mime, datauri, ext) => {
					${prefs.favicon_fmt}
				})(${arg(data)}, ${arg(hash)}, ${arg(mime)}, ${arg(datauri)},
				   ${arg(ext)})`
			}))[0];
		} catch (e) {
			return creation_error(e, "favicon_fmt");
		}
	}
	try {
		let iconarg = icon === undefined
				? "undefined"
				: `JSON.parse(${arg(JSON.stringify(favicon_fmt_out))})`;
		bookmark_fmt_out = (await browser.tabs.executeScript({
			code: `((rawtitle, title, tags, text, url, icon) => {
				${prefs.bookmark_fmt}
			})(${arg(rawtitle)}, ${arg(title)}, ${arg(tags)}, ${arg(text)},
			   ${arg(url)}, ${iconarg})`
		}))[0];
	} catch (e) {
		return creation_error(e, "bookmark_fmt");
	}

	return send_bookmark(prefs, bookmark_fmt_out, favicon_fmt_out);
};

const send_bookmark = async (prefs, bookmark_fmt_out, favicon_fmt_out) => {
	const sanity = result => {
		if (do_you_even(result, 'fields')) {
			const {fields, ...rest} = result;

			if (union(Object.keys(fields), Object.keys(rest)).length !== 0)
				return msg("sanityFieldsReason");
		}
		if (!do_you_even(result, 'title'))
			return msg("sanityTitleReason");

		return null;
	};
	const merge = (mode, tiddler) => {
		if (mode !== 'webserver' && tiddler !== undefined) {
			const {fields, ...rest} = tiddler;

			return {...fields, ...rest};
		}
		return tiddler;
	};

	let bookmark_sanity = sanity(bookmark_fmt_out);

	if (bookmark_sanity !== null) {
		return {
			errortitle: msg("formatErrorTitle"),
			reason: bookmark_sanity,
			advice: msg("formatErrorAdvice", "bookmark_fmt")
		};
	}
	bookmark_fmt_out = merge(prefs.savingmode, bookmark_fmt_out);
	if (prefs.favicon_separate && favicon_fmt_out !== undefined) {
		let favicon_sanity = sanity(favicon_fmt_out);

		if (favicon_sanity !== null) {
			return {
				errortitle: msg("formatErrorTitle"),
				reason: favicon_sanity,
				advice: msg(
					"formatErrorAdvice", "favicon_fmt"
				)
			};
		}
		favicon_fmt_out = merge(prefs.savingmode, favicon_fmt_out);
	}

	return sends[prefs.savingmode](prefs, bookmark_fmt_out, favicon_fmt_out);
};

const tiddler_blob = tiddlers => new Blob([
	new TextEncoder().encode(JSON.stringify(tiddlers, null, "\t")).buffer
], {type: "application/json"});

const addr_of = (prefs, tiddler) =>
	`${prefs.address}/recipes/default/tiddlers/` +
	`${encodeURIComponent(tiddler.title)}`;

const status_of = xhr => `${xhr.status} ${xhr.statusText}`;

const prefab_xhr = (reject, act) => {
	let xhr = new XMLHttpRequest();
	xhr.onerror = _e => reject({
		errortitle: msg("networkErrorTitle"),
		reason: msg("couldNotReason", act),
		advice: msg("networkErrorAdvice")
	});
	xhr.onloadend = _e => reject({
		errortitle: msg("unknownErrorTitle"),
		reason: msg("xhrErrorReason", act)
	});
	return xhr;
};

const authopen = (xhr, prefs, method, url) => xhr.open(method, url, true,
	prefs.auth ? prefs.username : null,
	prefs.auth ? prefs.password : null
);

const put_tiddler = (resolve, reject, prefs, tiddler, desci18n) => {
	const desc = msg(desci18n),
	      act = msg("putTiddlerPhrase", desc);
	let put = prefab_xhr(reject, act);

	authopen(put, prefs, 'PUT', addr_of(prefs, tiddler));
	put.setRequestHeader('X-Requested-With', 'TiddlyWiki');
	put.onload = function(_e) {
		if (this.status === 204)
			return resolve(null);
		if (this.status === 401)
			return reject({
				errortitle: msg("permissionErrorTitle"),
				reason: msg("couldNotReason", act),
				details: status_of(this),
				advice: msg("permissionErrorAdvice")
			});
		return reject(status_of(this));
	};
	put.send(JSON.stringify(tiddler));
};

const check_tiddler = (resolve, reject, prefs, tiddler, desci18n, ex, ne) => {
	const desc = msg(desci18n),
	      act = msg("checkTiddlerPhrase", desc);
	let get = prefab_xhr(reject, act);

	authopen(get, prefs, 'GET', addr_of(prefs, tiddler));
	get.onload = function(_e) {
		if (this.status === 200)
			return ex();
		if (this.status === 404)
			return ne();
		if (this.status === 401)
			return reject({
				errortitle: msg("permissionErrorTitle"),
				reason: msg("couldNotReason", act),
				details: status_of(this),
				advice: prefs.auth
				      ? msg("validateCredentialsAdvice")
				      : msg("enableAuthAdvice")
			});
		return reject(status_of(this));
	};
	get.send();
};

const sends = {
	download: async (prefs, bookmark, favicon) => {
		let tiddlers = (favicon !== undefined) ? [bookmark, favicon] : bookmark,
		    url = URL.createObjectURL(tiddler_blob(tiddlers));

		try {
			let id = await browser.downloads.download({
				url: url,
				saveAs: prefs.savebox,
				filename: bookmark.title.replace(/[^A-Za-z0-9._-]/g, "_")
				        + ".json"
			});
			let revoker = delta => {
				if (delta.id === id && delta.state.current === 'complete') {
					browser.downloads.onChanged.removeListener(revoker);
					URL.revokeObjectURL(url);
				}
			};

			browser.downloads.onChanged.addListener(revoker);
		} catch (e) {
			URL.revokeObjectURL(url);
			return {
				errortitle: msg("downloadErrorTitle"),
				details: e.toString(),
				advice: msg("tryAgainAdvice")
			};
		}

		return null;
	},
	webserver: (prefs, bookmark, favicon) => new Promise((resolve, reject) => {
		const badurl = (reason, advice = "serverAddressAdvice") =>
			reject({
				errortitle: msg("configErrorTitle"),
				reason: msg(reason),
				advice: msg(advice)
			});
		let u;

		try {
			u = new URL(prefs.address);
		} catch {
			return badurl("serverAddressParseReason");
		}
		if (u.hash !== "")
			return badurl("serverAddressHashReason")
		if (u.search !== "")
			return badurl("serverAddressQueryReason")
		if (u.password !== "" || u.password)
			return badurl("serverAddressAuthReason", "serverAddressAuthAdvice");
		if (prefs.safety && u.protocol === "http:"
		 && u.hostname !== "localhost" && u.hostname !== "127.0.0.1"
		 && u.hostname !== "::1")
		 	return reject({
		 		errortitle: msg("safetyErrorTitle"),
				reason: msg("safetyErrorReason"),
				advice: msg("safetyErrorAdvice")
			})
		if (u.protocol !== "http:" && u.protocol !== "https:")
			return badurl("serverAddressProtocolReason");

		return resolve(null);
	}).then(_ => new Promise((resolve, reject) => {
		let getstatus = prefab_xhr(reject, "get server status");

		getstatus.responseType = 'json';
		authopen(getstatus, prefs, 'GET', `${prefs.address}/status`);
		getstatus.onload = function(_e) {
			if (this.status === 401 || this.status === 403)
				return resolve({
					errortitle: msg("permissionErrorTitle"),
					details: status_of(this),
					advice: msg("validateCredentialsAdvice")
				});
			if (this.response !== null
			 && this.response.hasOwnProperty('tiddlywiki_version')) {
				return resolve(null);
			}
			return reject({
				errortitle: msg("serverErrorTitle"),
				details: status_of(this),
				advice: msg("ensureTiddlyWikiAdvice")
			});
		};
		getstatus.send();
	})).then(_ => new Promise((resolve, reject) => favicon === undefined
		? resolve(false)
		: check_tiddler(
			resolve, reject, prefs, favicon, "favicon",
			() => resolve(false),
			() => resolve(true)
		)
	)).then(do_fav => new Promise((resolve, reject) =>
		check_tiddler(
			resolve, reject, prefs, bookmark, "bookmark",
			() => reject({
				errortitle: msg("refusingToSaveTitle"),
				reason: msg("alreadyExistsReason")
			}),
			() => resolve(do_fav)
		)
	)).then(do_fav => new Promise((resolve, reject) => do_fav
		? put_tiddler(resolve, reject, prefs, favicon, "favicon")
		: resolve(null)
	)).then(_ => new Promise((resolve, reject) =>
		put_tiddler(resolve, reject, prefs, bookmark, "bookmark")
	)).catch(e => e.hasOwnProperty('errortitle') ? e : {
		errortitle: msg("unknownErrorTitle"),
		details: e.toString()
	})
};

/* this seemed like it was going to be bigger and justify its scaffolding more
   but oh well whatever */
const handler_tree = {
	sync: {
		quickmode: (changes, change) => {
			storage_cache.quickmode = change.newValue;
		}
	},
	local: {
		state: (changes, change) => {
			let nv = storage_cache.state = change.newValue;
			badge({
				ready: {text: "", fg: null, bg: null},
				unfinished: {text: "!", fg: "white", bg: "#F80B"},
				working: {text: "…", fg: "white", bg: "#888B"},
				failure: {text: "✕", fg: "white", bg: "#F00B"},
				done: {text: "✓", fg: "white", bg: "#0F08"}
			}[nv]);
			switch (nv) {
			case 'done':
				browser.alarms.create('done', {when: Date.now() + 3000});
				break;
			case 'ready':
				browser.alarms.clear('done');
				break;
			case 'working':
				catch_bookmark();
				break;
			}
		}
	}
};

browser.storage.onChanged.addListener((changes, area) => {
	const a = handler_tree[area];
	for (let [k, v] of Object.entries(changes)) {
		if (a.hasOwnProperty(k))
			a[k](changes, v);
	}
});
browser.browserAction.onClicked.addListener(() => {
	switch (storage_cache.state) {
	case 'unfinished':
		break;
	case 'working':
		return;
	case 'failure':
		break;
	case 'done':
		storage_cache.state = 'ready'; /* so as to avoid waiting on an async */
		browser.storage.local.set({state: 'ready'});
	case 'ready':
		if (!storage_cache.quickmode)
			break;
		(async () => {
			/* mind here that the map is for Promise.all - we don't actually
			   care about the return values once everything is settled, as
			   they are massaged for popup purposes. meanwhile the full values
			   are stored regardless */
			await Promise.all(Object.keys(field_reads).map(
				tab_read(await current_tab())
			));
			storage_cache.state = 'working';
			browser.storage.local.set({state: 'working'});
		})();
		return;
	}

	popup_able(true);
	browser.browserAction.openPopup();
	popup_able(false);
});
browser.alarms.onAlarm.addListener(info => {
	if (info.name === 'done' && storage_cache.state === 'done')
		browser.storage.local.set({state: 'ready'});
});
popup_able(false);
(async () => {
	if (await pref_of('justinstalled')) {
		browser.runtime.openOptionsPage();
	}
	if (await local_of('state') === 'working')
		browser.storage.local.set({
			state: 'failure',
			error: {
				errortitle: msg("interruptedTitle"),
				reason: msg("interruptedReason")
			}
		});
	else
		await fake_update('local', 'state');
	await fake_update('sync', 'quickmode');
})();

