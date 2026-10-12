import { invoke } from "@tauri-apps/api/core";

export interface DevdeckOptions {
	hotkey?: string;
}

interface Hotkey {
	ctrl: boolean;
	alt: boolean;
	shift: boolean;
	meta: boolean;
	key: string;
}

let isStarted = false;

const parseHotkey = (hotkey: string): Hotkey => {
	const parts = hotkey.toLowerCase().split("+").map(part => part.trim());
	const key = parts.pop() ?? "";
	return {
		ctrl: parts.includes("ctrl"),
		alt: parts.includes("alt"),
		shift: parts.includes("shift"),
		meta: parts.includes("meta"),
		key
	}
}

const pressedKey = (event: KeyboardEvent): string => event.code.toLowerCase().replace(/^key|^digit/, "");

export function openDevdeck(): Promise<void> {
	return invoke("plugin:devdeck|open");
}

export function startDevdeck(options: DevdeckOptions = {}): () => void {
	if (isStarted) return () => undefined;
	isStarted = true;
	const hotkey = parseHotkey(options.hotkey ?? "Ctrl+Alt+M");

	const onKeyDown = (event: KeyboardEvent) => {
		const isMatch = event.ctrlKey === hotkey.ctrl && event.altKey === hotkey.alt
			&& event.shiftKey === hotkey.shift && event.metaKey === hotkey.meta && pressedKey(event) === hotkey.key;
		if (!isMatch) return;
		event.preventDefault();
		void openDevdeck().catch(error => console.error("[devdeck]", error));
	}

	window.addEventListener("keydown", onKeyDown);
	return () => {
		window.removeEventListener("keydown", onKeyDown);
		isStarted = false;
	}
}