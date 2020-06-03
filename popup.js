"use strict";

const unfinish = async () => browser.storage.local.set({state: "unfinished"});
let proper_finish = () => {};
(async () => {
	if (await pref_of("careful")) {
		window.addEventListener("unload", unfinish);
		proper_finish = () => window.removeEventListener("unload", unfinish);
	}
})();

document.getElementById("cancel").addEventListener("click", async () => {
	proper_finish();
	await browser.storage.local.set({state: "ready"});
	window.close();
});

const display = (id, msg) => {
	let e = document.getElementById(id);
	if (msg !== undefined) {
		e.children[0].innerHTML = msg;
	}
	e.classList.remove("dnd");
};

const all_fields = f =>
	Promise.all(Object.entries(tab_reads).map(async ([k, v]) => {
		let r = await f(k);
		if (r !== undefined) {
			document.getElementById(k)[v.target] = r;
		}
	}));

(async () => {
	let f;

	switch (await local_of("state")) {
	case "failure":
		f = stored_tab;
		for (let [k, v] of Object.entries(await local_of("error"))) {
			display(k, v);
		}
		break;
	case "unfinished":
		display("warning", "If you meant to discard this bookmark, hit <b>Cancel</b>.");
		f = stored_tab;
		break;
	default: // case "ready"
		f = tab_read(await current_tab());
	}
	await all_fields(f);

	let e = document.getElementById("go");
	e.addEventListener("click", async () => {
		proper_finish();
		await browser.storage.local.set({state: "working"});
		window.close();
	});
	e.disabled = false;
	document.getElementById("settings").addEventListener('click', () => browser.runtime.openOptionsPage().then(_ => window.close()));
})();
