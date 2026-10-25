import { formatMegabytes, formatNumber, formatPercent, megabytes } from "#/shared/format";
import { deltas, processName, Sample, Series } from "#/shared/samples";
import { colorOf, tokens } from "#/shared/tokens";

export interface RecordingFile {
	app?: string;
	started?: number;
	stopped?: number;
	intervalMs?: number;
	samples?: Sample[];
}

export interface Track {
	id: "cpu" | "memory" | "heap" | "elements" | "gauges" | "calls";
	title: string;
	unit: (value: number) => string;
	kind: "stacked" | "lines";
	height: number;
	series: Series[];
}

export interface Recording {
	name: string;
	file: RecordingFile;
	samples: Sample[];
	times: number[];
	tracks: Track[];
	duration: number;
	interval: number;
}

export interface RecordingInfo {
	name: string;
	size: number;
}

export const prepare = (name: string, file: RecordingFile): Recording => {
	const samples = file.samples ?? [];
	const started = file.started ?? samples[0]?.time ?? 0;
	const times = samples.map(sample => sample.time - started);

	const kinds = new Map<number, string>();
	for (const sample of samples) {
		for (const process of sample.processes) if (!kinds.has(process.pid)) kinds.set(process.pid, process.kind);
	}
	const processSeries = (read: (process: Sample["processes"][number]) => number): Series[] => [...kinds].map(([pid, kind]) => {
		const key = `${kind}:${pid}`;
		const values = samples.map(sample => {
			const found = sample.processes.find(process => process.pid === pid);
			return found ? read(found) : null;
		});
		return { key, name: processName({ pid, kind }), color: colorOf(key), values }
	});

	const namesOf = (field: "gauges" | "totals") => [...new Set(samples.flatMap(sample => Object.keys(sample.page?.[field] ?? {})))];
	const gauges = namesOf("gauges").map(name => ({
		key: `gauge:${name}`,
		name,
		color: colorOf(`gauge:${name}`),
		values: samples.map(sample => sample.page?.gauges?.[name] ?? null)
	}));
	
	const calls = namesOf("totals").map(name => ({
		key: `total:${name}`,
		name,
		color: colorOf(`total:${name}`),
		values: deltas(samples.map(sample => sample.page?.totals?.[name] ?? null))
	})).filter(series => series.values.some(value => value > 0));

	const page = (key: string, read: (report: NonNullable<Sample["page"]>) => number | null): Series => ({
		key,
		name: key,
		color: tokens.accent,
		values: samples.map(sample => sample.page ? read(sample.page) : null)
	});

	const tracks: Track[] = ([
		{ id: "cpu", title: "CPU", unit: formatPercent, kind: "stacked", height: 96, series: processSeries(process => process.cpu) },
		{ id: "memory", title: "Memory", unit: formatMegabytes, kind: "stacked", height: 96, series: processSeries(process => megabytes(process.memory)) },
		{ id: "heap", title: "JS heap", unit: formatMegabytes, kind: "lines", height: 56, series: [page("JS heap", report => report.heap ? megabytes(report.heap.used) : null)] },
		{ id: "elements", title: "Elements", unit: formatNumber, kind: "lines", height: 48, series: [page("Elements", report => report.domNodes ?? null)] },
		{ id: "gauges", title: "Resources", unit: formatNumber, kind: "lines", height: 72, series: gauges },
		{ id: "calls", title: "Calls", unit: formatNumber, kind: "stacked", height: 72, series: calls }
	] satisfies Track[]).filter(track => track.series.some(series => series.values.some(value => value !== null)));

	const duration = Math.max(times.at(-1) ?? 0, (file.stopped ?? 0) - started, 1);
	return { name, file, samples, times, tracks, duration, interval: file.intervalMs ?? 250 }
}

export const recordingLabel = (info: RecordingInfo) => {
	const match = /(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})/.exec(info.name);
	const time = match
		? new Date(Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +match[6])).toLocaleString()
		: info.name;
	return `${time} · ${Math.max(1, Math.round(info.size / 1024))} KB`;
}

export const lowerIndex = (times: number[], time: number) => {
	let low = 0;
	let high = times.length;
	while (low < high) {
		const middle = (low + high) >> 1;
		if (times[middle] < time) low = middle + 1;
		else high = middle;
	}
	return low;
}

export const nearestIndex = (times: number[], time: number) => {
	const index = lowerIndex(times, time);
	if (index <= 0) return 0;
	if (index >= times.length) return times.length - 1;
	return time - times[index - 1] < times[index] - time ? index - 1 : index;
}