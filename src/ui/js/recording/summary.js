import { formatMegabytes, formatNumber, formatPercent, formatSpan, signed } from "#/shared/format.js";
import { lowerIndex, state } from "./state.js";

const summary = document.getElementById("timeline-summary");

const cell = (text, className) => {
	const element = document.createElement("td");
	element.textContent = text;
	if (className) element.className = className;
	return element;
}

const table = (title, headers, rows) => {
	const card = document.createElement("section");
	card.className = "summary-card";
	const heading = document.createElement("div");
	heading.className = "summary-title";
	heading.textContent = title;
	const element = document.createElement("table");
	element.className = "summary-table";
	const head = element.createTHead().insertRow();
	for (const header of headers) {
		const th = document.createElement("th");
		th.textContent = header;
		head.append(th);
	}
	const tbody = element.createTBody();
	for (const row of rows) {
		const tr = tbody.insertRow();
		tr.append(...row);
	}
	card.append(heading, element);
	return card;
}

const present = values => values.filter(value => value !== null && value !== undefined);

const changeRows = (series, from, to, unit) => series.map(item => {
	const values = present(item.values.slice(from, to + 1));
	const first = values[0] ?? 0;
	const last = values.at(-1) ?? 0;
	const change = last - first;
	return [cell(item.name), cell(unit(first)), cell(unit(last)), cell(signed(change, unit), change > 0 ? "grows" : "")];
});

const processRows = (cpu, memory, from, to) => cpu.series.map(series => {
	const usage = present(series.values.slice(from, to + 1));
	const memorySeries = memory.series.find(item => item.key === series.key);
	const used = present(memorySeries?.values.slice(from, to + 1) ?? []);
	const average = usage.length ? usage.reduce((sum, value) => sum + value, 0) / usage.length : 0;
	const change = (used.at(-1) ?? 0) - (used[0] ?? 0);
	return {
		average,
		row: [
			cell(series.name),
			cell(formatPercent(average)),
			cell(formatPercent(usage.length ? Math.max(...usage) : 0)),
			cell(formatMegabytes(used[0] ?? 0)),
			cell(formatMegabytes(used.at(-1) ?? 0)),
			cell(signed(change, formatMegabytes), change > 0 ? "grows" : "")
		]
	}
}).sort((a, b) => b.average - a.average).map(item => item.row);

const callRows = (calls, from, to, seconds) => calls.series.map(series => {
	const count = series.values.slice(from + 1, to + 1).reduce((sum, value) => sum + (value ?? 0), 0);
	return { count, row: [cell(series.name), cell(formatNumber(count)), cell(formatNumber(count / seconds))] }
}).filter(item => item.count > 0).sort((a, b) => b.count - a.count).map(item => item.row);

export const renderSummary = () => {
	const { recording, view } = state;
	const { times, tracks } = recording;
	const from = Math.min(lowerIndex(view.start), times.length - 1);
	const to = Math.max(from, lowerIndex(view.end + 1e-6) - 1);
	const seconds = Math.max(1e-3, (view.end - view.start) / 1000);
	const trackOf = id => tracks.find(track => track.id === id);

	const range = document.createElement("div");
	range.className = "summary-range";
	range.textContent = `Range: ${formatSpan(view.start)} – ${formatSpan(view.end)} · ${formatSpan(view.end - view.start)} · ${to - from + 1} samples`;
	const cards = [];

	const cpu = trackOf("cpu");
	const memory = trackOf("memory");
	if (cpu && memory) {
		const processes = table("Processes", ["", "avg CPU", "max CPU", "memory at start", "at end", "change"], processRows(cpu, memory, from, to));
		processes.classList.add("is-wide");
		cards.push(processes);
	}

	const page = [trackOf("heap"), trackOf("elements")].filter(Boolean)
		.flatMap(track => changeRows(track.series, from, to, track.unit));
	if (page.length) cards.push(table("Page", ["", "start", "end", "change"], page));

	const gauges = trackOf("gauges");
	if (gauges) cards.push(table("Resources", ["", "start", "end", "change"], changeRows(gauges.series, from, to, formatNumber)));

	const calls = trackOf("calls");
	const rows = calls ? callRows(calls, from, to, seconds) : [];
	if (rows.length) cards.push(table("Calls", ["", "count", "per second"], rows));

	const grid = document.createElement("div");
	grid.className = "summary-grid";
	grid.append(...cards);
	summary.replaceChildren(range, grid);
}