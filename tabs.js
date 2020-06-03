"use strict";

const scrub = s => s.replace(/[[\]{}|]/g, '');

const byte_flatmap = (f, ab) =>
	Array.prototype.map.call(new Uint8Array(ab), f).join("");
const abtobs = ab =>
	/* don't you just adore optional arguments */
	byte_flatmap(b => String.fromCharCode(b), ab);
const abtoh = ab =>
	byte_flatmap(b => ("00" + b.toString(16)).slice(-2), ab);

const exts = {
	gif: "gif",
	png: "png",
	jpeg: "jpg",
	["x-icon"]: "ico",
	["vnd.microsoft.icon"]: "ico",
	bmp: "bmp",
	["svg+xml"]: "svg",
	webp: "webp"
};
const favicon_of = async tab => {
	if (!(await pref_of("reqfav")))
		return undefined;
	return favicon_req(tab);
};

const favicon_req = tab => new Promise((resolve, reject) => {
	let xhr = new XMLHttpRequest();

	xhr.responseType = 'arraybuffer';
	xhr.open("GET", tab.favIconUrl);
	xhr.onload = function() {
		let mime = this.getResponseHeader("Content-Type");
		let [type, subtype] = mime.split("/");

		if (type !== "image") {
			/* i don't even want to think about whatever weird edge case would
			   make this premature */
			resolve(undefined);
			return;
		}

		let bin = abtobs(this.response);
		let data = bin;
		let dc = subtype === "svg+xml"
	           ? `,${encodeURIComponent(bin)}`
		       : `;base64,${data = btoa(bin)}`;

		(async () => resolve({
			data: data,
			hash: abtoh(await crypto.subtle.digest("SHA-1", this.response)),
			mime: mime,
			datauri: `data:${mime}${dc}`,
			ext: exts[subtype]
		}))();
	};
	xhr.onerror = () => resolve(undefined);
	xhr.send();
});

const tab_reads = (() => {
	const bsls = (k, v) => browser.storage.local.set({[k]: v}),
	      field = k => x => x[k],
	      compose = (f, g) => x => f(g(x));

	return {
		icon: {
			from_tab: favicon_of,
			get: field("datauri"),
			target: "src"
		},
		rawtitle: {
			from_tab: field("title"),
			target: "innerHTML"
		},
		url: {
			from_tab: field("url"),
			target: "value",
			input: bsls
		},
		title: {
			from_tab: compose(scrub, field("title")),
			target: "value",
			input: bsls
		}
	};
})();

const tab_get = (o, r) =>
	(r !== undefined && o.hasOwnProperty("get")) ? o.get(r) : r;

const tab_read = t => async k => {
	const o = tab_reads[k];
	const r = await o.from_tab(t);
	await browser.storage.local.set({[k]: r});
	return tab_get(o, r);
};
const stored_tab = async k => tab_get(tab_reads[k], await local_of(k));
const current_tab = async () =>
	 (await browser.tabs.query({
		currentWindow: true,
		active: true
	}))[0];
