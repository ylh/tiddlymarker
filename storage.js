const defaults = {
	sync: {
		quickmode: false,
		careful: false,
		reqfav: true,
		savingmode: "download",
		/*taburi: "",*/
		address: "",
		auth: false,
		username: "",
		password: "",
		safety: true,
		bookmark_fmt:
`let o = {
	title: title,
	tags: "Bookmark",
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
		state: "ready",
		error: {}
	}
};

const storage_obj = async (a, k) =>
	await browser.storage[a].get({[k]: defaults[a][k]});

const local_of = async k => (await storage_obj("local", k))[k];
const pref_of = async k => (await storage_obj("sync", k))[k];

const fake_update = async (a, k) =>
	browser.storage[a].set(await storage_obj(a, k));
