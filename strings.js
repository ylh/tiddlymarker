document.querySelectorAll("[data-msg]").forEach(elem =>
	elem[(e => {
		if (e.matches("input[type=\"button\""))
			return "value";
		if (e.matches("textarea"))
			return "placeholder";
		return 'innerHTML';
	})(elem)] = browser.i18n.getMessage(elem.dataset.msg)
);
