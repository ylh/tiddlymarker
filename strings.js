document.querySelectorAll("[data-msg]").forEach(e =>
	e[e.matches("input[type=\"button\"")
		? "value"
		: 'innerHTML'
	] = browser.i18n.getMessage(e.dataset.msg)
);