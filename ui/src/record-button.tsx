import { Button } from "@mui/material";
import { useEffect, useState } from "react";
import { getJson, post } from "#/shared/api";
import { duration } from "#/shared/format";
import { tokens, withAlpha } from "#/shared/tokens";

interface RecordingStatus {
	isRecording: boolean;
	started?: number;
}

export const RecordButton = ({ onStopped }: { onStopped: (name: string) => void }) => {
	const [started, setStarted] = useState<number | null>(null);
	const [now, setNow] = useState(() => Date.now());
	const [isBusy, setIsBusy] = useState(false);

	useEffect(() => {
		getJson<RecordingStatus>("recording")
			.then(status => setStarted(status.isRecording ? status.started ?? Date.now() : null))
			.catch(() => undefined);
	}, []);

	useEffect(() => {
		if (started === null) return;
		const timer = window.setInterval(() => setNow(Date.now()), 500);
		return () => window.clearInterval(timer);
	}, [started]);

	const toggle = async () => {
		setIsBusy(true);
		try {
			if (started === null) {
				const status = await post<RecordingStatus>("recording/start");
				setNow(Date.now());
				setStarted(status.isRecording ? status.started ?? Date.now() : null);
			} else {
				const result = await post<{ name: string }>("recording/stop");
				setStarted(null);
				onStopped(result.name);
			}
		} catch (error) {
			console.error("[devdeck]", error);
		}
		setIsBusy(false);
	}

	const isRecording = started !== null;
	return (
		<Button
			disabled={isBusy}
			onClick={() => void toggle()}
			startIcon={<span style={{ width: 8, height: 8, borderRadius: isRecording ? 2 : "50%", background: tokens.danger, boxShadow: `0 0 8px ${withAlpha(tokens.danger, 0.8)}` }} />}
			sx={isRecording ? { color: tokens.danger, bgcolor: withAlpha(tokens.danger, 0.1), "&:hover": { color: tokens.danger, bgcolor: withAlpha(tokens.danger, 0.16) } } : undefined}
		>
			{isRecording ? `Stop · ${duration(now - started)}` : "Record"}
		</Button>
	);
}