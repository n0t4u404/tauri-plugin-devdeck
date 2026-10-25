import { Box, Stack, Tab, Tabs, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { MonitorView } from "#/monitor/monitor-view";
import { RecordButton } from "#/record-button";
import { RecordingView } from "#/recording/recording-view";
import { usePolling } from "#/shared/api";
import { duration, formatMegabytes, formatPercent, megabytes } from "#/shared/format";
import { Sample } from "#/shared/samples";
import { tokens, withAlpha } from "#/shared/tokens";

type View = "monitor" | "recording";

const STALE_MS = 3000;

const Metric = ({ label, value }: { label: string; value: string }) => (
	<Stack direction="row" spacing={0.75} sx={{ alignItems: "baseline" }}>
		<Typography sx={{ fontSize: 11, color: "text.disabled" }}>{label}</Typography>
		<Typography sx={{ fontSize: 13, fontWeight: 600, color: "text.primary" }}>{value}</Typography>
	</Stack>
);

const LiveDot = ({ isLive }: { isLive: boolean }) => (
	<Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
		<Box sx={{
			width: 7,
			height: 7,
			borderRadius: "50%",
			bgcolor: isLive ? tokens.success : tokens.textMuted,
			boxShadow: isLive ? `0 0 0 3px ${withAlpha(tokens.success, 0.18)}` : "none"
		}} />
		<Typography sx={{ fontSize: 11, fontWeight: 600, color: isLive ? tokens.success : "text.disabled" }}>{isLive ? "Live" : "Paused"}</Typography>
	</Stack>
);

export const App = () => {
	const [view, setView] = useState<View>("monitor");
	const [openedRecording, setOpenedRecording] = useState<string | null>(null);
	const samples = usePolling<Sample[]>("samples", 1000);
	const latest = samples?.at(-1);
	const [isLive, setIsLive] = useState(false);

	useEffect(() => {
		if (!latest) return;
		setIsLive(true);
		const timer = window.setTimeout(() => setIsLive(false), STALE_MS);
		return () => window.clearTimeout(timer);
	}, [latest?.time]);

	const total = (read: (process: Sample["processes"][number]) => number) => latest ? latest.processes.reduce((sum, process) => sum + read(process), 0) : null;
	const memory = total(process => process.memory);
	const cpu = total(process => process.cpu);

	return (
		<>
			<Stack
				component="header"
				direction="row"
				spacing={3}
				sx={{ position: "sticky", top: 0, zIndex: 2, alignItems: "center", px: 3, bgcolor: "background.default", borderBottom: 1, borderColor: "divider" }}
			>
				<Tabs value={view} onChange={(_, next: View) => setView(next)} sx={{ flexShrink: 0 }}>
					<Tab value="monitor" label="Monitor" tabIndex={0} />
					<Tab value="recording" label="Recording" tabIndex={0} />
				</Tabs>
				<LiveDot isLive={isLive} />
				<RecordButton onStopped={name => {
					setOpenedRecording(name);
					setView("recording");
				}} />
				<Stack direction="row" spacing={2.5} sx={{ ml: "auto !important", flexWrap: "wrap" }}>
					<Metric label="Memory" value={memory === null ? "—" : formatMegabytes(megabytes(memory))} />
					<Metric label="CPU" value={cpu === null ? "—" : formatPercent(cpu)} />
					<Metric label="Processes" value={latest ? String(latest.processes.length) : "—"} />
					<Metric label="Uptime" value={samples && latest ? duration(latest.time - samples[0].time) : "—"} />
				</Stack>
			</Stack>
			{view === "monitor" ? <MonitorView samples={samples} /> : <RecordingView preferred={openedRecording} />}
		</>
	);
}