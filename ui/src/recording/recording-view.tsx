import { Box, Button, MenuItem, Paper, Select, Stack, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { getJson, post } from "#/shared/api";
import { ErrorBoundary } from "#/shared/error-boundary";
import { formatSpan } from "#/shared/format";
import { prepare, Recording, RecordingFile, RecordingInfo, recordingLabel } from "./recording";
import { Summary } from "./summary";
import { Timeline, TimelineHover, TimelineView } from "./timeline";

export const RecordingView = ({ preferred }: { preferred: string | null }) => {
	const overviewRef = useRef<HTMLCanvasElement>(null);
	const tracksRef = useRef<HTMLCanvasElement>(null);
	const timelineRef = useRef<Timeline | null>(null);
	const [recordings, setRecordings] = useState<RecordingInfo[] | null>(null);
	const [selected, setSelected] = useState<string>("");
	const [recording, setRecording] = useState<Recording | null>(null);
	const [view, setView] = useState<TimelineView>({ start: 0, end: 1 });
	const [hover, setHover] = useState<TimelineHover | null>(null);

	useEffect(() => {
		let isActive = true;
		getJson<RecordingInfo[]>("recordings").then(list => {
			if (!isActive) return;
			setRecordings(list);
			setSelected(current => {
				const wanted = preferred ?? current;
				return list.some(item => item.name === wanted) ? wanted : list[0]?.name ?? "";
			});
		}).catch(error => console.error("[devdeck]", error));
		return () => {
			isActive = false;
		}
	}, [preferred]);

	useEffect(() => {
		if (!selected) {
			setRecording(null);
			return;
		}
		let isActive = true;
		getJson<RecordingFile>(`recordings/${encodeURIComponent(selected)}`)
			.then(file => isActive && setRecording(prepare(selected, file)))
			.catch(error => console.error("[devdeck]", error));
		return () => {
			isActive = false;
		}
	}, [selected]);

	const hasRecording = recording !== null;
	useEffect(() => {
		if (!hasRecording || !overviewRef.current || !tracksRef.current) return;
		const timeline = new Timeline(overviewRef.current, tracksRef.current, setView, setHover);
		timelineRef.current = timeline;
		return () => {
			timeline.destroy();
			timelineRef.current = null;
		}
	}, [hasRecording]);

	useEffect(() => {
		timelineRef.current?.setRecording(recording);
	}, [recording]);

	const isEmpty = recordings !== null && recordings.length === 0;

	return (
		<Box component="main">
			<Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap", px: 3, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
				<Select size="small" variant="standard" disableUnderline value={selected} disabled={isEmpty} onChange={event => setSelected(event.target.value)} sx={{ minWidth: 220, fontSize: 13, fontWeight: 600, "&&": { ml: -1 } }} displayEmpty>
					{(recordings ?? []).map(item => <MenuItem key={item.name} value={item.name} sx={{ fontSize: 12 }}>{recordingLabel(item)}</MenuItem>)}
				</Select>
				<Button disabled={isEmpty || !selected} onClick={() => void post("recording/reveal", selected).catch(error => console.error("[devdeck]", error))}>
					Show in folder
				</Button>
				{recording && (
					<Typography sx={{ color: "text.secondary" }}>
						{`${recording.file.app ?? ""} · ${formatSpan(recording.duration)} · ${recording.samples.length} samples · every ${recording.interval} ms`}
					</Typography>
				)}
				<Typography sx={{ ml: "auto !important", fontSize: 11, color: "text.disabled" }}>Wheel to zoom · drag to pan · double-click to reset</Typography>
			</Stack>
			{isEmpty && (
				<Typography sx={{ py: 8, textAlign: "center", color: "text.secondary" }}>
					No recordings yet. Press <b>Record</b>, do what you want to measure, then <b>Stop</b>.
				</Typography>
			)}
			{recording && (
				<>
					<Box sx={{ px: 3, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
						<canvas ref={overviewRef} style={{ display: "block", width: "100%", height: 72 }} />
					</Box>
					<Box sx={{ borderBottom: 1, borderColor: "divider" }}>
						<canvas ref={tracksRef} style={{ display: "block", width: "100%", cursor: "grab" }} />
					</Box>
					<ErrorBoundary name="Summary">
						<Summary recording={recording} view={view} />
					</ErrorBoundary>
				</>
			)}
			{hover && (
				<Paper
					sx={{
						position: "fixed",
						left: Math.min(hover.x + 14, window.innerWidth - 280),
						top: Math.min(hover.y + 14, window.innerHeight - 40 - hover.rows.length * 20),
						p: "8px 10px",
						minWidth: 200,
						pointerEvents: "none",
						zIndex: 10,
						bgcolor: "background.paper"
					}}
				>
					<Typography sx={{ mb: 0.5, fontSize: 11, fontWeight: 600, color: "text.primary" }}>{hover.title}</Typography>
					{hover.rows.map(row => (
						<Stack key={row.name} direction="row" sx={{ justifyContent: "space-between", gap: 2, fontSize: 11 }}>
							<span><Box component="span" sx={{ display: "inline-block", width: 8, height: 8, mr: 1, borderRadius: "50%", bgcolor: row.color }} />{row.name}</span>
							<Box component="span" sx={{ color: "text.primary" }}>{row.value}</Box>
						</Stack>
					))}
				</Paper>
			)}
		</Box>
	);
}