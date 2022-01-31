'use strict';

const defaults = {
	sync: {
		quickmode: false,
		careful: false,
		show_text: true,
		show_tags: true,
		default_tags: "Bookmark",
		reqfav: true,
		savingmode: 'download',
		savebox: false,
		address: "",
		auth: false,
		username: "",
		password: "",
		safety: true,
		bookmark_fmt:
`let now = (d => {
	const pad = (w, i) => ("0".repeat(w) + i).slice(-w);
	return pad(4, d.getUTCFullYear())
	     + pad(2, d.getUTCMonth() + 1)
	     + pad(2, d.getUTCDate())
	     + pad(2, d.getUTCHours())
	     + pad(2, d.getUTCMinutes())
	     + pad(2, d.getUTCSeconds())
	     + pad(3, d.getUTCMilliseconds());
})(new Date());

let o = {
	title: title,
	tags: tags,
	text: text,
	fields: {
		rawtitle: rawtitle,
		link: url,
		created: now,
		modified: now
	}
};

if (icon !== undefined) {
	o.fields.icon = icon.title;
}

return o;`,
		favicon_separate: true,
		favicon_fmt:
`return {
	title: \`\${hash}.\${ext}\`,
	tags: "Favicon",
	text: data,
	type: mime
};`,
	justinstalled: true
	},
	local: {
		state: 'ready',
		error: {},
		tags: ""
	}
};

const storage_all = a =>
	browser.storage[a].get(defaults[a]);

const storage_obj = (a, k) =>
	browser.storage[a].get({[k]: defaults[a][k]});

const local_of = async k => (await storage_obj('local', k))[k];
const pref_of = async k => (await storage_obj('sync', k))[k];

const fake_update = async (a, k) =>
	browser.storage[a].set(await storage_obj(a, k));
