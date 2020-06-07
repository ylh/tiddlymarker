document.querySelectorAll("textarea").forEach(e => {
	const dy = e.offsetHeight - e.scrollHeight;

	e.addEventListener('input', function() {
		this.style.height = "1px";
		this.style.height = `${dy + e.scrollHeight}px`;
	});
	e.dispatchEvent(new Event('input'));
});