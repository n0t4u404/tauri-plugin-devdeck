import { duration, formatMegabytes, formatNumber, formatPercent, megabytes, signed } from "#/shared/format.js";
import { colorOf, minuteChange, statsOf } from "#/shared/chart.js";
import { Panel } from "./panel.js";
import { processName } from "#/shared/processes.js";
import { Stat } from "./stat.js";

const columns = format => [
	{ key: "min", label: "min", format },
	{ key: "max", label: "max", format },
	{ key: "avg", label: "avg", format },
	{ key: "current", label: "current", format, isDefaultSort: true }
];

const panels = {
	memory: new Panel({ title: "Memory", subtitle: "MB · last 5 min", unit: formatMegabytes, columns: columns(formatMegabytes) }),
	cpu: new Panel({
		title: "CPU",
		subtitle: "% of one core · last 5 min",
		unit: formatPercent,
		columns: columns(formatPercent),
		note: "100% is one fully busy core. WebView2 processes are shared by all windows of the app — this window is one of the pages."
	}),
	gauges: new Panel({
		title: "Resources",
		subtitle: "created minus released · devGauge()",
		unit: formatNumber,
		kind: "lines",
		columns: [
			{ key: "min", label: "min", format: formatNumber },
			{ key: "max", label: "max", format: formatNumber },
			{ key: "current", label: "current", format: formatNumber, isDefaultSort: true },
			{ key: "minute", label: "1 min", format: value => signed(value, formatNumber), isGrowthWarning: true }
		],
		note: "A number that only grows and never comes back is a leak."
	}),
	traffic: new Panel({
		title: "Calls and events",
		subtitle: "per second · devTotal()",
		unit: formatNumber,
		columns: [
			{ key: "avg", label: "avg", format: formatNumber, isDefaultSort: true },
			{ key: "max", label: "max", format: formatNumber },
			{ key: "current", label: "current", format: formatNumber },
			{ key: "total", label: "total", format: formatNumber }
		]
	})
}

const stats = {
	heap: new Stat("JS heap", formatMegabytes),
	elements: new Stat("Elements on the page", formatNumber),
	tasks: new Stat("Tokio tasks (Rust)", formatNumber)
}

const deck = document.getElementById("deck");
const statsRow = document.createElement("div");
statsRow.className = "stats";
statsRow.append(stats.heap.element, stats.elements.element, stats.tasks.element);
deck.append(panels.memory.element, panels.cpu.element, statsRow, panels.gauges.element, panels.traffic.element);

const processSeries = (samples, read) => samples.at(-1).processes.map(process => {
	const key = `${process.kind}:${process.pid}`;
	const values = samples.map(sample => {
		const found = sample.processes.find(item => item.pid === process.pid);
		return found ? read(found) : null;
	});
	return {
		key,
		name: processName(process),
		color: colorOf(key),
		values,
		stats: statsOf(values)
	}
});

const live = document.getElementById("live");
let lastTime = 0;
let firstTime = null;
let staleTimer;

const render = samples => {
	if (samples.length === 0) return;
	document.getElementById("waiting").hidden = true;
	deck.hidden = false;
	const latest = samples.at(-1);
	if (latest.time !== lastTime) {
		lastTime = latest.time;
		live.classList.remove("is-stale");
		clearTimeout(staleTimer);
		staleTimer = setTimeout(() => live.classList.add("is-stale"), 3000);
	}

	document.getElementById("chip-memory").textContent = formatMegabytes(megabytes(latest.processes.reduce((sum, process) => sum + process.memory, 0)));
	document.getElementById("chip-cpu").textContent = formatPercent(latest.processes.reduce((sum, process) => sum + process.cpu, 0));
	document.getElementById("chip-processes").textContent = String(latest.processes.length);
	firstTime ??= samples[0].time;
	document.getElementById("chip-uptime").textContent = duration(latest.time - firstTime);
	const times = samples.map(sample => sample.time);
	panels.memory.update({ times, series: processSeries(samples, process => megabytes(process.memory)) });
	panels.cpu.update({ times, series: processSeries(samples, process => process.cpu) });
	stats.heap.update(samples.map(sample => megabytes(sample.page?.heap?.used ?? 0)));
	stats.elements.update(samples.map(sample => sample.page?.domNodes ?? 0));
	stats.tasks.update(samples.map(sample => sample.rust.tasks));

	const gaugeNames = [...new Set(samples.flatMap(sample => Object.keys(sample.page?.gauges ?? {})))];
	panels.gauges.update({
		times,
		series: gaugeNames.map(name => {
			const values = samples.map(sample => sample.page?.gauges?.[name] ?? 0);
			return { key: `gauge:${name}`, name, color: colorOf(`gauge:${name}`), values, stats: statsOf(values, { minute: minuteChange(values) }) }
		})
	});

	const totalNames = [...new Set(samples.flatMap(sample => Object.keys(sample.page?.totals ?? {})))];
	panels.traffic.update({
		times,
		series: totalNames.map(name => {
			const cumulative = samples.map(sample => sample.page?.totals?.[name] ?? null);
			const values = cumulative.map((value, index) => {
				const before = cumulative[index - 1];
				return value === null || before === null || before === undefined ? 0 : Math.max(0, value - before);
			});
			return { key: `total:${name}`, name, color: colorOf(`total:${name}`), values, stats: statsOf(values, { total: cumulative.at(-1) ?? 0 }) }
		}).filter(series => series.stats.max > 0)
	});
}

export const startMonitor = async () => {
	try {
		const response = await fetch("samples", { cache: "no-store" });
		if (response.ok) render(await response.json());
	} catch (error) {
		console.error("[devdeck]", error);
	}

	setTimeout(startMonitor, 1000);
}