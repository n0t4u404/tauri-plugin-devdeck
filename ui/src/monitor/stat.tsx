import { Box, Stack, Typography } from "@mui/material";
import { SparkLineChart } from "@mui/x-charts/SparkLineChart";
import { tokens } from "#/shared/tokens";

interface StatProps {
	label: string;
	format: (value: number) => string;
	values: number[];
	unavailable?: string;
}

export const Stat = ({ label, format, values, unavailable }: StatProps) => {
	const change = (values.at(-1) ?? 0) - (values.at(-61) ?? values[0] ?? 0);
	const note = unavailable ?? (change === 0 ? null : `${change > 0 ? "▲" : "▼"} ${format(Math.abs(change))} / 1 min`);
	const noteColor = unavailable || change === 0 ? "text.disabled" : change > 0 ? tokens.danger : tokens.success;
	const min = Math.min(...values);
	const max = Math.max(...values);

	return (
		<Box sx={{ flex: 1, minWidth: 220, px: 3, py: 2.5 }}>
			<Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline" }}>
				<Typography sx={{ fontSize: 13, fontWeight: 600, color: "text.secondary" }}>{label}</Typography>
				{note && <Typography sx={{ fontSize: 10, fontWeight: 600, color: noteColor }}>{note}</Typography>}
			</Stack>
			<Typography sx={{ fontSize: 20, fontWeight: 600, color: "text.primary", letterSpacing: "-0.01em" }}>
				{unavailable || values.length === 0 ? "—" : format(values.at(-1)!)}
			</Typography>
			<SparkLineChart
				data={unavailable ? [] : values}
				baseline="min"
				yAxis={{ min, max: max + (max === min ? 1 : 0) }}
				height={40}
				area
				curve="monotoneX"
				color={tokens.accent}
				skipAnimation
				showHighlight
				showTooltip
				valueFormatter={value => value === null ? "" : format(value)}
				sx={{ mt: 1, "& .MuiLineChart-area": { fillOpacity: 0.14 }, "& .MuiLineChart-line": { strokeWidth: 1.5 } }}
			/>
		</Box>
	);
}