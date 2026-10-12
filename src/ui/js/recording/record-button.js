import { post } from "#/shared/api.js";
import { duration } from "#/shared/format.js";
import { openRecording } from "./timeline.js";

const recordButton = document.getElementById("record");
let recordingStarted = null;
let recordingTimer;

const showRecording = status => {
	recordingStarted = status.isRecording ? status.started : null;
	recordButton.classList.toggle("is-recording", status.isRecording);
	clearInterval(recordingTimer);
	if (!status.isRecording) {
		recordButton.textContent = "Record";
		return;
	}

	const tick = () => recordButton.textContent = `Stop · ${duration(Date.now() - recordingStarted)}`;
	tick();
	recordingTimer = setInterval(tick, 500);
}

recordButton.addEventListener("click", async () => {
	recordButton.disabled = true;
	try {
		if (recordingStarted === null) {
			showRecording(await post("recording/start"));
		} else {
			const result = await post("recording/stop");
			showRecording({ isRecording: false });
			openRecording(result.name);
		}
	} catch (error) {
		console.error("[devdeck]", error);
	}
	recordButton.disabled = false;
});

export const startRecording = () => fetch("recording", { cache: "no-store" })
	.then(response => response.json())
	.then(showRecording)
	.catch(() => undefined);