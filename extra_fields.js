const field_reads = {
	tags: {
		pull: async () => pref_of('default_tags'),
		target: "value",
		bypref: 'show_tags',
		input: true
	},
	text: {
		pull: async () => "",
		target: "value",
		bypref: 'show_text',
		input: true
	}
}