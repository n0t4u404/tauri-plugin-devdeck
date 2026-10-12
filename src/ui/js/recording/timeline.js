import { getJson, post } from "#/shared/api.js";
import { formatSpan } from "#/shared/format.js";
import { onShowView, showView } from "#/shared/tabs.js";
import { drawOverview, drawTracks } from "./draw.js";
import "./interaction.js";
import { prepare } from "./prepare.js";
import { onDraw, requestDraw, state } from "./state.js";
import { renderSummary } from "./summary.js";

const select = document.getElementById("recording-select");
const revealButton = document.getElementById("recording-reveal");
const info = document.getElementById("recording-info");
const empty = document.getElementById("recording-empty");
const body = document.getElementById("recording-body");

onDraw(() => {
	drawOverview();
	drawTracks();
	renderSummary();
});

new ResizeObserver(requestDraw).observe(document.getElementById("timeline-overview"));
new ResizeObserver(requestDraw).observe(document.getElementById("timeline-tracks"));

const optionLabel = recordingInfo => {
	const match = /(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})/.exec(recordingInfo.name);
	const time = match
		? new Date(Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +match[6])).toLocaleString()
		: recordingInfo.name;
	return `${time} · ${Math.max(1, Math.round(recordingInfo.size / 1024))} KB`;
}

const load = async name => {
	try {
		const recording = prepare(await getJson(`recordings/${encodeURIComponent(name)}`));
		recording.name = name;
		state.recording = recording;
		state.view = { start: 0, end: recording.duration }
		const { file, samples, duration, interval } = recording;
		info.textContent = `${file.app ?? ""} · ${formatSpan(duration)} · ${samples.length} samples · every ${interval} ms`;
		body.hidden = false;
		requestDraw();
	} catch (error) {
		console.error("[devdeck]", error);
	}
}

const refresh = async preferred => {
	try {
		const recordings = await getJson("recordings");
		const current = preferred ?? select.value;
		select.replaceChildren(...recordings.map(item => new Option(optionLabel(item), item.name)));
		const isEmpty = recordings.length === 0;
		empty.hidden = !isEmpty;
		select.disabled = isEmpty;
		revealButton.disabled = isEmpty;
		if (isEmpty) {
			body.hidden = true;
			state.recording = null;
			info.textContent = "";
			return;
		}

		const name = recordings.some(item => item.name === current) ? current : recordings[0].name;
		select.value = name;
		if (state.recording?.name !== name) await load(name);
	} catch (error) {
		console.error("[devdeck]", error);
	}
}

select.addEventListener("change", () => void load(select.value));

revealButton.addEventListener("click", () => {
	if (select.value) void post("recording/reveal", select.value).catch(error => console.error("[devdeck]", error));
});

export const openRecording = name => {
	showView("recording");
	void refresh(name);
}

export const startTimeline = () => onShowView("recording", () => void refresh());