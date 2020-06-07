'use strict';

const value_field = elem => elem.type === 'checkbox' ? 'checked' : 'value';
const populate = (elem, v) => elem[value_field(elem)] = v;
const readfrom = elem => elem[value_field(elem)];

const act = b => k => {
	const grey = (b, e) => e.classList[b ? 'remove' : 'add']("greyout");

	let e = document.getElementById(k);

	if ('disabled' in e) {
		e.disabled = !b;
	} else {
		grey(b, e);
	}
	document.querySelectorAll(`.${k}, [for="${k}"]`).forEach(
		elem => grey(b, elem)
	);

	let a;
	if (do_you_even(a = controls[k], 'activate', 'onact'))
		a.activate.onact(b, e);
};

/* means of population */
const pref = {
	fill: async (elem, k) =>
		populate(elem, await pref_of(k)),
	read: function(ev) {
		browser.storage.sync.set({[this.id]: readfrom(this)});
	}
};
const def = v => ({fill: async (elem, k) => populate(elem, v)});

/* means of activation */
const rel = (o) => (() => {
	const fn = (b, e) => {
		let ac = [],
		    de = [];
		for (let [k, v] of Object.entries(o)) {
			if (readfrom(e).toString() === k && b)
				ac = ac.concat(v);
			else
				de = de.concat(v);
		}
		ac.forEach(act(true));
		de.forEach(act(false));
	};
	return {
		onact: fn,
		oninput: function(ev) {
			fn(true, this);
		}
	};
})();
const always = (a) => ({
	onact: (b, e) =>
		a.forEach(act(b))
});

/* controls and init both call these */
const act_all = (b) =>
	Object.keys(controls).filter(k => controls[k].root).forEach(act(b));
const populate_all = async () => {
	for (let [k, v] of Object.entries(controls)) {
		if (do_you_even(v, 'pop', 'fill')) {
			let e = document.getElementById(k);

			await v.pop.fill(e, k);
			if (do_you_even(v, 'bump'))
				e.dispatchEvent(new Event('input'));
		}
	}
};
const reset_all = async () => {
	act_all(false);
	await browser.storage.sync.clear();
	await populate_all();
	act_all(true);
};
const reset_one = k =>
	async function(ev) {
		let e = document.getElementById(k);
		(act(false))(k);
		await browser.storage.sync.set({[k]: defaults.sync[k]});
		await controls[k].pop.fill(e, k);
		e.dispatchEvent(new Event('input'));
		(act(true))(k);
	};

const ordinary_child = {root: false, pop: pref};
const controls = {
	quickmode: {
		root: true,
		pop: pref,
		activate: rel({false: ["popup_prefs"]})
	},
	default_tags: {
		root: true,
		pop: pref
	},
	reqfav: {
		root: true,
		pop: pref,
		activate: rel({
			true: ["favicon_separate", "favicon_fmt"]
		})
	},
	savingmode: {
		root: true,
		pop: pref,
		activate: rel({
			download: [],
			webserver: ["webserver_prefs"]
		})
	},
	popup_prefs: {
		root: false,
		activate: always(["careful", "show_text", "show_tags"])
	},
	careful: ordinary_child,
	show_text: ordinary_child,
	show_tags: ordinary_child,
	webserver_prefs: {
		root: false,
		activate: always(["address", "auth", "safety"])
	},
	address: ordinary_child,
	auth: {
		root: false,
		pop: pref,
		activate: rel({
			true: ["username", "password"]
		})
	},
	username: ordinary_child,
	password: ordinary_child,
	safety: ordinary_child,
	bookmark_fmt: {
		root: true,
		pop: pref,
		activate: always(["reset_bookmark_fmt"]),
		bump: true
	},
	reset_bookmark_fmt: {
		root: false,
		onclick: reset_one("bookmark_fmt")
	},
	favicon_separate: ordinary_child,
	favicon_fmt: {
		root: false,
		pop: pref,
		activate: always(["reset_favicon_fmt"]),
		bump: true
	},
	reset_favicon_fmt: {
		root: false,
		onclick: reset_one("favicon_fmt")
	},
	textarea_tabs: {
		root: false,
		pop: def(false)
	},
	unlock_reset: {
		root: true,
		pop: def(false),
		activate: rel({
			true: ["reset_all"]
		})
	},
	reset_all: {
		root: false,
		onclick: reset_all
	}
};

/* textarea tabbing */
const tabber = function(e) {
	if (e.keyCode === 9) {
		const ssp = this.selectionStart,
		      sep = this.selectionEnd,
		      oc = this.value;
		this.value = `${oc.substring(0, ssp)}\t${oc.substring(sep)}`;
		this.selectionStart = this.selectionEnd = ssp + 1;
		e.preventDefault();
	}
};

document.getElementById("textarea_tabs").addEventListener('click', function() {
	document.querySelectorAll("textarea").forEach(e =>
		e[`${this.checked ? 'add' : 'remove'}EventListener`]('keydown', tabber)
	);
});


(async () => {
	if (await pref_of('justinstalled')) {
		document.getElementById("firstinstall").hidden = false;
		await browser.storage.sync.set({justinstalled: false});
	}
	await populate_all();
	for (let [k, v] of Object.entries(controls)) {
		let e = document.getElementById(k);
		switch (k) {
		case 'bookmark_fmt':
		case 'favicon_fmt':
			e.dispatchEvent(new Event('input'));
		default:
		}
		if (do_you_even(v, 'pop', 'read'))
			e.addEventListener('input', v.pop.read);
		if (do_you_even(v, 'activate', 'oninput'))
			e.addEventListener('input', v.activate.oninput);
		if (v.onclick)
			e.addEventListener('click', v.onclick);
	}
	act_all(true);
})();