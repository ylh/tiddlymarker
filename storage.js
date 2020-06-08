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
`let o = {
	title: title,
	tags: tags,
	text: text,
	fields: {
		rawtitle: rawtitle,
		link: url
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
