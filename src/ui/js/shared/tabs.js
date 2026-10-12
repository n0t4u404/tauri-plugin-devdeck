const tabs = [...document.querySelectorAll(".tab")];
const listeners = new Map();

export const onShowView = (name, listener) => listeners.set(name, listener);

export const showView = name => {
	for (const tab of tabs) {
		const isActive = tab.dataset.view === name;
		tab.classList.toggle("is-active", isActive);
		document.getElementById(`${tab.dataset.view}-view`).hidden = !isActive;
	}
	listeners.get(name)?.();
}

for (const tab of tabs) tab.addEventListener("click", () => showView(tab.dataset.view));