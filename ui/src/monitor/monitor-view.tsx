import { Box, Divider, Stack, Typography } from "@mui/material";
import { formatMegabytes, formatNumber, formatPercent, megabytes, signed } from "#/shared/format";
import { deltas, minuteChange, processName, ProcessSample, Sample, statsOf } from "#/shared/samples";
import { colorOf } from "#/shared/tokens";
import { Column, PanelSeries, SeriesPanel } from "./series-panel";
import { ErrorBoundary } from "#/shared/error-boundary";
import { Stat } from "./stat";

const columns = (format: (value: number) => string): Column[] => [
	{ key: "min", label: "min", format },
	{ key: "max", label: "max", format },
	{ key: "avg", label: "avg", format },
	{ key: "current", label: "current", format, isDefaultSort: true }
];

const processSeries = (samples: Sample[], read: (process: ProcessSample) => number): PanelSeries[] => samples.at(-1)!.processes.map(process => {
	const key = `${process.kind}:${process.pid}`;
	const values = samples.map(sample => {
		const found = sample.processes.find(item => item.pid === process.pid);
		return found ? read(found) : null;
	});
	return { key, name: processName(process), color: colorOf(key), values, stats: statsOf(values) }
});

const namesOf = (samples: Sample[], field: "gauges" | "totals") => [...new Set(samples.flatMap(sample => Object.keys(sample.page?.[field] ?? {})))];

export const MonitorView = ({ samples }: { samples: Sample[] | null }) => {
	if (!samples || samples.length === 0) {
		return (
			<Box sx={{ display: "grid", minHeight: "calc(100vh - 120px)", placeItems: "center" }}>
				<Typography sx={{ color: "text.disabled" }}>Waiting for the first sample…</Typography>
			</Box>
		);
	}

	const times = samples.map(sample => sample.time);
	const hasHeap = samples.some(sample => sample.page?.heap);
	const gauges: PanelSeries[] = namesOf(samples, "gauges").map(name => {
		const values = samples.map(sample => sample.page?.gauges?.[name] ?? 0);
		return { key: `gauge:${name}`, name, color: colorOf(`gauge:${name}`), values, stats: statsOf(values, { minute: minuteChange(values) }) }
	});
	const traffic: PanelSeries[] = namesOf(samples, "totals").map(name => {
		const cumulative = samples.map(sample => sample.page?.totals?.[name] ?? null);
		const values = deltas(cumulative);
		return { key: `total:${name}`, name, color: colorOf(`total:${name}`), values, stats: statsOf(values, { total: cumulative.at(-1) ?? 0 }) }
	}).filter(series => series.stats.max > 0);

	return (
		<>
			<ErrorBoundary name="Memory">
				<SeriesPanel
					title="Memory"
					subtitle="MB · last 5 min"
					unit={formatMegabytes}
					columns={columns(formatMegabytes)}
					times={times}
					series={processSeries(samples, process => megabytes(process.memory))}
				/>
			</ErrorBoundary>
			<ErrorBoundary name="CPU">
				<SeriesPanel
					title="CPU"
					subtitle="% of one core · last 5 min"
					unit={formatPercent}
					columns={columns(formatPercent)}
					note="100% is one fully busy core. Web view processes are shared by all windows of the app — this window is one of the pages."
					times={times}
					series={processSeries(samples, process => process.cpu)}
				/>
			</ErrorBoundary>
			<ErrorBoundary name="Page stats">
				<Stack direction="row" divider={<Divider orientation="vertical" flexItem />} sx={{ flexWrap: "wrap", borderBottom: 1, borderColor: "divider" }}>
					<Stat
						label="JS heap"
						format={formatMegabytes}
						values={samples.map(sample => megabytes(sample.page?.heap?.used ?? 0))}
						unavailable={hasHeap ? undefined : "Not available in this web view"}
					/>
					<Stat label="Elements on the page" format={formatNumber} values={samples.map(sample => sample.page?.domNodes ?? 0)} />
					<Stat label="Tokio tasks (Rust)" format={formatNumber} values={samples.map(sample => sample.rust.tasks)} />
				</Stack>
			</ErrorBoundary>
			<ErrorBoundary name="Resources">
				<SeriesPanel
					title="Resources"
					subtitle="created minus released · devGauge()"
					unit={formatNumber}
					kind="lines"
					columns={[
						{ key: "min", label: "min", format: formatNumber },
						{ key: "max", label: "max", format: formatNumber },
						{ key: "current", label: "current", format: formatNumber, isDefaultSort: true },
						{ key: "minute", label: "1 min", format: value => signed(value, formatNumber), isGrowthWarning: true }
					]}
					note="A number that only grows and never comes back is a leak."
					times={times}
					series={gauges}
				/>
			</ErrorBoundary>
			<ErrorBoundary name="Calls and events">
				<SeriesPanel
					title="Calls and events"
					subtitle="per second · devTotal()"
					unit={formatNumber}
					kind="bars"
					columns={[
						{ key: "avg", label: "avg", format: formatNumber, isDefaultSort: true },
						{ key: "max", label: "max", format: formatNumber },
						{ key: "current", label: "current", format: formatNumber },
						{ key: "total", label: "total", format: formatNumber }
					]}
					times={times}
					series={traffic}
				/>
			</ErrorBoundary>
		</>
	);
}