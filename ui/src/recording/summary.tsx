import { Box, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { ReactNode } from "react";
import { formatMegabytes, formatNumber, formatPercent, formatSpan, signed } from "#/shared/format";
import { Series } from "#/shared/samples";
import { tokens } from "#/shared/tokens";
import { lowerIndex, Recording } from "./recording";
import { TimelineView } from "./timeline";

type Cell = { text: string; isGrowing?: boolean }

const present = (values: (number | null)[]) => values.filter((value): value is number => value !== null && value !== undefined);
const changeRows = (series: Series[], from: number, to: number, unit: (value: number) => string): Cell[][] => series.map(item => {
	const values = present(item.values.slice(from, to + 1));
	const first = values[0] ?? 0;
	const last = values.at(-1) ?? 0;
	const change = last - first;
	return [{ text: item.name }, { text: unit(first) }, { text: unit(last) }, { text: signed(change, unit), isGrowing: change > 0 }];
});

const SummaryCard = ({ title, headers, rows, isWide }: { title: string; headers: string[]; rows: Cell[][]; isWide?: boolean }) => (
	<Box sx={{ px: 3, py: 2.5, overflow: "auto", gridColumn: isWide ? "1 / -1" : undefined, borderBottom: 1, borderColor: "divider" }}>
		<Typography sx={{ mb: 1, fontSize: 13, fontWeight: 600, color: "text.secondary" }}>{title}</Typography>
		<Table size="small">
			<TableHead>
				<TableRow>
					{headers.map((header, index) => <TableCell key={header || index} align={index === 0 ? "left" : "right"}>{header}</TableCell>)}
				</TableRow>
			</TableHead>
			<TableBody>
				{rows.map((row, rowIndex) => (
					<TableRow key={rowIndex}>
						{row.map((cell, index) => (
							<TableCell
								key={index}
								align={index === 0 ? "left" : "right"}
								sx={{ color: cell.isGrowing ? tokens.danger : "text.primary", maxWidth: index === 0 ? 240 : undefined, overflow: "hidden", textOverflow: "ellipsis" }}
							>
								{cell.text}
							</TableCell>
						))}
					</TableRow>
				))}
			</TableBody>
		</Table>
	</Box>
);

export const Summary = ({ recording, view }: { recording: Recording; view: TimelineView }) => {
	const { times, tracks } = recording;
	const from = Math.min(lowerIndex(times, view.start), times.length - 1);
	const to = Math.max(from, lowerIndex(times, view.end + 1e-6) - 1);
	const seconds = Math.max(1e-3, (view.end - view.start) / 1000);
	const trackOf = (id: string) => tracks.find(track => track.id === id);
	const cards: ReactNode[] = [];

	const cpu = trackOf("cpu");
	const memory = trackOf("memory");
	if (cpu && memory) {
		const rows = cpu.series.map(series => {
			const usage = present(series.values.slice(from, to + 1));
			const used = present(memory.series.find(item => item.key === series.key)?.values.slice(from, to + 1) ?? []);
			const average = usage.length ? usage.reduce((sum, value) => sum + value, 0) / usage.length : 0;
			const change = (used.at(-1) ?? 0) - (used[0] ?? 0);
			return {
				average,
				cells: [
					{ text: series.name },
					{ text: formatPercent(average) },
					{ text: formatPercent(usage.length ? Math.max(...usage) : 0) },
					{ text: formatMegabytes(used[0] ?? 0) },
					{ text: formatMegabytes(used.at(-1) ?? 0) },
					{ text: signed(change, formatMegabytes), isGrowing: change > 0 }
				]
			}
		}).sort((a, b) => b.average - a.average).map(row => row.cells);
		cards.push(<SummaryCard key="processes" title="Processes" headers={["", "avg CPU", "max CPU", "memory at start", "at end", "change"]} rows={rows} isWide />);
	}

	const page = [trackOf("heap"), trackOf("elements")]
		.filter(track => track !== undefined)
		.flatMap(track => changeRows(track.series, from, to, track.unit));
	if (page.length) cards.push(<SummaryCard key="page" title="Page" headers={["", "start", "end", "change"]} rows={page} />);

	const gauges = trackOf("gauges");
	if (gauges) cards.push(<SummaryCard key="gauges" title="Resources" headers={["", "start", "end", "change"]} rows={changeRows(gauges.series, from, to, formatNumber)} />);

	const calls = trackOf("calls");
	const callRows = (calls?.series ?? []).map(series => {
		const count = series.values.slice(from + 1, to + 1).reduce<number>((sum, value) => sum + (value ?? 0), 0);
		return { count, cells: [{ text: series.name }, { text: formatNumber(count) }, { text: formatNumber(count / seconds) }] }
	}).filter(row => row.count > 0).sort((a, b) => b.count - a.count).map(row => row.cells);
	if (callRows.length) cards.push(<SummaryCard key="calls" title="Calls" headers={["", "count", "per second"]} rows={callRows} />);

	return (
		<>
			<Typography sx={{ px: 3, pt: 2.5, fontSize: 13, fontWeight: 600, color: "text.primary" }}>
				{`Range: ${formatSpan(view.start)} – ${formatSpan(view.end)} · ${formatSpan(view.end - view.start)} · ${to - from + 1} samples`}
			</Typography>
			<Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))" }}>{cards}</Box>
		</>
	);
}