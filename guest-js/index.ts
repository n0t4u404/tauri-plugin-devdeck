import { invoke } from "@tauri-apps/api/core";

export interface DevdeckOptions {
	hotkey?: string;
	reportIntervalMs?: number;
}

interface Hotkey {
	ctrl: boolean;
	alt: boolean;
	shift: boolean;
	meta: boolean;
	key: string;
}

type MemoryInfo = {
	usedJSHeapSize: number;
	totalJSHeapSize: number;
	jsHeapSizeLimit: number;
}

const gauges = new Map<string, number>();
const totals = new Map<string, number>();
let isStarted = false;

export function devGauge(name: string, delta: number): void {
	if (!isStarted) return;
	gauges.set(name, (gauges.get(name) ?? 0) + delta);
}

export function devTotal(name: string, amount = 1): void {
	if (!isStarted) return;
	totals.set(name, (totals.get(name) ?? 0) + amount);
}

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

const report = () => {
	const memory = (performance as Performance & { memory?: MemoryInfo }).memory;

	return {
		heap: memory ? { used: memory.usedJSHeapSize, total: memory.totalJSHeapSize, limit: memory.jsHeapSizeLimit } : null,
		domNodes: document.getElementsByTagName("*").length,
		gauges: Object.fromEntries(gauges),
		totals: Object.fromEntries(totals)
	}
}

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

	const timer = window.setInterval(() => {
		void invoke("plugin:devdeck|report", { report: report() }).catch(() => undefined);
	}, options.reportIntervalMs ?? 1000);

	window.addEventListener("keydown", onKeyDown);
	return () => {
		window.clearInterval(timer);
		window.removeEventListener("keydown", onKeyDown);
		isStarted = false;
	}
}