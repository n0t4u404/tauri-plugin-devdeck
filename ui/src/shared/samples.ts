export interface ProcessSample {
	pid: number;
	kind: string;
	memory: number;
	cpu: number;
}

export interface PageReport {
	heap: { used: number; total: number; limit: number } | null;
	domNodes: number;
	gauges: Record<string, number>;
	totals: Record<string, number>;
}

export interface Sample {
	time: number;
	processes: ProcessSample[];
	page: PageReport | null;
	rust: { tasks: number }
}

export interface Series {
	key: string;
	name: string;
	color: string;
	values: (number | null)[];
}

export interface Stats {
	min: number;
	max: number;
	avg: number;
	current: number;
	[extra: string]: number;
}

const KIND_NAMES: Record<string, string> = {
	"app": "App (Rust)",
	"webview:browser": "WebView2 — browser",
	"webview:renderer": "WebView2 — page",
	"webview:gpu": "WebView2 — GPU",
	"webview:network": "WebView2 — network",
	"webview:storage": "WebView2 — storage",
	"webview:audio": "WebView2 — audio",
	"webview:utility": "WebView2 — utility",
	"webview:crashpad-handler": "WebView2 — crashpad",
	"webkit:web": "WebKit — page",
	"webkit:network": "WebKit — network",
	"webkit:gpu": "WebKit — GPU"
}

export const MINUTE = 60;
export const processName = (process: { kind: string; pid: number }) => `${KIND_NAMES[process.kind] ?? process.kind} · ${process.pid}`;

export const statsOf = (values: (number | null)[], extra: Record<string, number> = {}): Stats => {
	const present = values.filter((value): value is number => value !== null && value !== undefined);
	const sum = present.reduce((total, value) => total + value, 0);
	return {
		min: present.length ? Math.min(...present) : 0,
		max: present.length ? Math.max(...present) : 0,
		avg: present.length ? sum / present.length : 0,
		current: present.at(-1) ?? 0,
		...extra
	}
}

export const minuteChange = (values: number[]) => (values.at(-1) ?? 0) - (values.at(-1 - MINUTE) ?? values[0] ?? 0);

export const fitPeak = (values: number[]) => {
	const sorted = values.filter(value => value > 0).sort((a, b) => a - b);
	if (sorted.length === 0) return 1e-9;
	const max = sorted.at(-1)!;
	const usual = sorted[Math.floor((sorted.length - 1) * 0.98)];
	return usual > 0 && max > usual * 1.5 ? usual * 1.2 : max;
}

export const niceStep = (range: number, count: number) => {
	const raw = range / count;
	const power = 10 ** Math.floor(Math.log10(raw || 1));
	return [1, 2, 2.5, 5, 10].map(multiple => multiple * power).find(candidate => candidate >= raw) ?? power * 10;
}

export const deltas = (cumulative: (number | null)[]) => cumulative.map((value, index) => {
	const before = cumulative[index - 1];
	return value === null || before === null || before === undefined ? 0 : Math.max(0, value - before);
});