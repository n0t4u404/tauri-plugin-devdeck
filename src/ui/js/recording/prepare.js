import { colorOf, token } from "#/shared/chart.js";
import { formatMegabytes, formatNumber, formatPercent, megabytes } from "#/shared/format.js";
import { processName } from "#/shared/processes.js";

export const prepare = file => {
	const samples = file.samples ?? [];
	const started = file.started ?? samples[0]?.time ?? 0;
	const times = samples.map(sample => sample.time - started);

	const kinds = new Map();
	for (const sample of samples) {
		for (const process of sample.processes) if (!kinds.has(process.pid)) kinds.set(process.pid, process.kind);
	}
	const processSeries = read => [...kinds].map(([pid, kind]) => {
		const key = `${kind}:${pid}`;
		const values = samples.map(sample => {
			const found = sample.processes.find(process => process.pid === pid);
			return found ? read(found) : null;
		});
		return { key, name: processName({ pid, kind }), color: colorOf(key), values }
	});

	const namesOf = field => [...new Set(samples.flatMap(sample => Object.keys(sample.page?.[field] ?? {})))];
	const gauges = namesOf("gauges").map(name => ({
		key: `gauge:${name}`,
		name,
		color: colorOf(`gauge:${name}`),
		values: samples.map(sample => sample.page?.gauges?.[name] ?? null)
	}));
	const calls = namesOf("totals").map(name => {
		const cumulative = samples.map(sample => sample.page?.totals?.[name] ?? null);
		const values = cumulative.map((value, index) => {
			const before = cumulative[index - 1];
			return value === null || before === null || before === undefined ? 0 : Math.max(0, value - before);
		});
		return { key: `total:${name}`, name, color: colorOf(`total:${name}`), values }
	}).filter(series => series.values.some(value => value > 0));

	const accent = token("--base-color-accent");
	const page = (key, read) => ({ key, name: key, color: accent, values: samples.map(sample => sample.page ? read(sample.page) : null) });

	const tracks = [
		{ id: "cpu", title: "CPU", unit: formatPercent, kind: "stacked", height: 96, series: processSeries(process => process.cpu) },
		{ id: "memory", title: "Memory", unit: formatMegabytes, kind: "stacked", height: 96, series: processSeries(process => megabytes(process.memory)) },
		{ id: "heap", title: "JS heap", unit: formatMegabytes, kind: "lines", height: 56, series: [page("JS heap", report => report.heap ? megabytes(report.heap.used) : null)] },
		{ id: "elements", title: "Elements", unit: formatNumber, kind: "lines", height: 48, series: [page("Elements", report => report.domNodes ?? null)] },
		{ id: "gauges", title: "Resources", unit: formatNumber, kind: "lines", height: 72, series: gauges },
		{ id: "calls", title: "Calls", unit: formatNumber, kind: "stacked", height: 72, series: calls }
	].filter(track => track.series.some(series => series.values.some(value => value !== null)));

	const duration = Math.max(times.at(-1) ?? 0, (file.stopped ?? 0) - started, 1);
	return { file, samples, times, tracks, duration, interval: file.intervalMs ?? 250 }
}