import { duration } from "./format.js";

const recordButton = document.getElementById("record");
const saved = document.getElementById("saved");
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

const post = async (path, body) => {
	const response = await fetch(path, { method: "POST", body });
	if (!response.ok) throw new Error(await response.text());
	return response.json();
}

recordButton.addEventListener("click", async () => {
	recordButton.disabled = true;
	try {
		if (recordingStarted === null) {
			saved.hidden = true;
			showRecording(await post("recording/start"));
		} else {
			const result = await post("recording/stop");
			showRecording({ isRecording: false });
			document.getElementById("saved-text").textContent = `Saved ${duration(result.duration)} · ${result.samples} samples`;
			document.getElementById("saved-path").textContent = result.path;
			document.getElementById("saved-path").title = result.path;
			saved.hidden = false;
		}
	} catch (error) {
		console.error("[devdeck]", error);
	}
	recordButton.disabled = false;
});

document.getElementById("saved-reveal").addEventListener("click", () => {
	void post("recording/reveal", document.getElementById("saved-path").textContent).catch(error => console.error("[devdeck]", error));
});

export const startRecording = () => fetch("recording", { cache: "no-store" })
	.then(response => response.json())
	.then(showRecording)
	.catch(() => undefined);