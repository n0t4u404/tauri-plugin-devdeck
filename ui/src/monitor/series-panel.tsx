import { Box, Chip, Table, TableBody, TableCell, TableHead, TableRow, TableSortLabel } from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import { LineChart } from "@mui/x-charts/LineChart";
import { useMemo, useState } from "react";
import { clock } from "#/shared/format";
import { Section } from "#/shared/section";
import { fitPeak, niceStep, Series, Stats } from "#/shared/samples";
import { tokens, withAlpha } from "#/shared/tokens";

export interface Column {
	key: string;
	label: string;
	format: (value: number) => string;
	isDefaultSort?: boolean;
	isGrowthWarning?: boolean;
}

export interface PanelSeries extends Series {
	stats: Stats;
}

export type PanelKind = "areas" | "lines" | "bars";

interface SeriesPanelProps {
	title: string;
	subtitle: string;
	note?: string;
	unit: (value: number) => string;
	columns: Column[];
	kind?: PanelKind;
	times: number[];
	series: PanelSeries[];
}

const CHART_HEIGHT = 220;

const scaleOf = (series: PanelSeries[], count: number, isStacked: boolean) => {
	const heights = isStacked
		? Array.from({ length: count }, (_, index) => series.reduce((sum, item) => sum + (item.values[index] ?? 0), 0))
		: series.flatMap(item => item.values.map(value => value ?? 0));
	const peak = fitPeak(heights);
	const step = niceStep(peak, 4);
	const top = Math.ceil(peak / step) * step;
	const spikeIndex = heights.reduce((best, value, index) => value > top && value > (heights[best] ?? -Infinity) ? index : best, -1);
	return { top, spike: spikeIndex === -1 ? null : { value: heights[spikeIndex], index: spikeIndex % count } }
}

export const SeriesPanel = ({ title, subtitle, note, unit, columns, kind = "areas", times, series }: SeriesPanelProps) => {
	const [sort, setSort] = useState(() => ({ column: columns.find(column => column.isDefaultSort)?.key ?? columns[0].key, isDescending: true }));
	const [hidden, setHidden] = useState<Set<string>>(() => new Set());
	const [highlight, setHighlight] = useState<string | null>(null);
	const visible = series.filter(item => !hidden.has(item.key));
	const isStacked = kind !== "lines";
	const { top, spike } = useMemo(() => scaleOf(visible, times.length, isStacked), [visible, times.length, isStacked]);

	const rows = [...series].sort((a, b) => {
		const difference = (a.stats[sort.column] ?? 0) - (b.stats[sort.column] ?? 0);
		return sort.isDescending ? -difference : difference;
	});

	const toggle = (key: string) => setHidden(current => {
		const next = new Set(current);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		return next;
	});

	const valueFormatter = (value: number | null) => value === null ? "" : unit(value);
	const chartSeries = visible.map(item => ({
		id: item.key,
		label: item.name,
		color: highlight && highlight !== item.key ? withAlpha(item.color, 0.2) : item.color,
		data: item.values,
		valueFormatter,
		highlightScope: { highlight: "series", fade: "global" } as const
	}));
	const yAxis = [{ min: 0, max: top, valueFormatter: (value: number) => unit(value), width: 76 }];
	const tickNumber = 6;
	const barTickEvery = Math.max(1, Math.ceil(times.length / tickNumber));

	const current = visible.reduce((sum, item) => sum + item.stats.current, 0);

	return (
		<Section
			title={title}
			value={isStacked && visible.length ? unit(current) : undefined}
			subtitle={subtitle}
			note={note}
			aside={spike && (
				<Chip
					size="small"
					color="error"
					variant="outlined"
					label={`▲ ${unit(spike.value)} at ${clock(times[spike.index])}`}
					sx={{ height: 20, fontSize: 10 }}
				/>
			)}
		>
			<Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 540px)", gap: 3, alignItems: "start" }}>
				<Box sx={{ "& .MuiLineChart-area": { fillOpacity: kind === "lines" ? 0.12 : 0.35 }, "& .MuiLineChart-line": { strokeWidth: kind === "lines" ? 2 : 1.5 } }}>
					{kind === "bars" ? (
						<BarChart
							height={CHART_HEIGHT}
							skipAnimation
							hideLegend
							series={chartSeries.map(item => ({ ...item, data: item.data.map(value => value ?? 0), stack: "total" }))}
							xAxis={[{ scaleType: "band", data: times, valueFormatter: (time: number) => clock(time), tickInterval: (_: number, index: number) => index % barTickEvery === 0, categoryGapRatio: 0.4 }]}
							yAxis={yAxis}
							grid={{ horizontal: true }}
							borderRadius={4}
						/>
					) : (
						<LineChart
							height={CHART_HEIGHT}
							skipAnimation
							hideLegend
							series={chartSeries.map(item => ({ ...item, area: true, showMark: false, curve: "monotoneX" as const, stack: isStacked ? "total" : undefined }))}
							xAxis={[{ scaleType: "time", data: times, valueFormatter: (time: number) => clock(time), tickNumber }]}
							yAxis={yAxis}
							grid={{ horizontal: true }}
						/>
					)}
				</Box>
				<Box sx={{ overflowX: "auto" }}>
					<Table size="small">
						<TableHead>
							<TableRow>
								<TableCell />
								{columns.map(column => (
									<TableCell key={column.key} align="right" sortDirection={sort.column === column.key ? (sort.isDescending ? "desc" : "asc") : false}>
										<TableSortLabel
											active={sort.column === column.key}
											direction={sort.isDescending ? "desc" : "asc"}
											onClick={() => setSort(current => ({ column: column.key, isDescending: current.column === column.key ? !current.isDescending : true }))}
										>
											{column.label}
										</TableSortLabel>
									</TableCell>
								))}
							</TableRow>
						</TableHead>
						<TableBody>
							{rows.map(item => (
								<TableRow
									key={item.key}
									hover
									onMouseEnter={() => setHighlight(item.key)}
									onMouseLeave={() => setHighlight(null)}
									onClick={() => toggle(item.key)}
									sx={{ cursor: "pointer", opacity: hidden.has(item.key) ? 0.35 : 1 }}
								>
									<TableCell title={item.name} sx={{ maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", color: "text.primary" }}>
										<Box component="span" sx={{ display: "inline-block", width: 8, height: 8, mr: 1, borderRadius: "50%", bgcolor: item.color }} />
										{item.name}
									</TableCell>
									{columns.map(column => {
										const value = item.stats[column.key] ?? 0;
										return (
											<TableCell key={column.key} align="right" sx={{ color: column.isGrowthWarning && value > 0 ? tokens.danger : "text.primary" }}>
												{column.format(value)}
											</TableCell>
										);
									})}
								</TableRow>
							))}
						</TableBody>
					</Table>
				</Box>
			</Box>
		</Section>
	);
}