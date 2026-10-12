import { formatSpan } from "#/shared/format.js";
import { layout } from "./draw.js";
import { HEADER_HEIGHT, LABEL_WIDTH, nearestIndex, requestDraw, setView, state } from "./state.js";

const EDGE = 6;

const overview = document.getElementById("timeline-overview");
const tracksCanvas = document.getElementById("timeline-tracks");
const tooltip = document.getElementById("tooltip");

let gesture = null;

const showTooltip = (event, band, index) => {
	const time = document.createElement("div");
	time.className = "tooltip-time";
	time.textContent = `${band.track.title} · ${formatSpan(state.recording.times[index])}`;
	const rows = band.track.series
		.map(series => ({ series, value: series.values[index] }))
		.filter(item => item.value !== null && item.value !== undefined && item.value !== 0)
		.sort((a, b) => b.value - a.value)
		.slice(0, 12);
	tooltip.replaceChildren(time, ...rows.map(({ series, value }) => {
		const line = document.createElement("div");
		line.className = "tooltip-row";
		const name = document.createElement("span");
		const swatch = document.createElement("span");
		swatch.className = "swatch";
		swatch.style.background = series.color;
		name.append(swatch, series.name);
		const amount = document.createElement("span");
		amount.textContent = band.track.unit(value);
		line.append(name, amount);
		return line;
	}));
	tooltip.hidden = false;
	tooltip.style.left = `${Math.min(event.clientX + 14, window.innerWidth - tooltip.offsetWidth - 8)}px`;
	tooltip.style.top = `${Math.min(event.clientY + 14, window.innerHeight - tooltip.offsetHeight - 8)}px`;
}

const pointer = (canvas, event) => {
	const rect = canvas.getBoundingClientRect();
	return { x: event.clientX - rect.left, y: event.clientY - rect.top, width: rect.width }
}

const timeAtTracks = (x, width) => {
	const { view } = state;
	return view.start + (x - LABEL_WIDTH) / (width - LABEL_WIDTH) * (view.end - view.start);
}

const hideHover = () => {
	state.hoverTime = null;
	tooltip.hidden = true;
	requestDraw();
}

tracksCanvas.addEventListener("mousedown", event => {
	if (!state.recording) return;
	const { x, y, width } = pointer(tracksCanvas, event);
	if (x < LABEL_WIDTH) {
		const band = layout().find(item => y >= item.top && y < item.top + HEADER_HEIGHT);
		if (!band) return;
		if (state.collapsed.has(band.track.id)) state.collapsed.delete(band.track.id);
		else state.collapsed.add(band.track.id);
		requestDraw();
		return;
	}

	gesture = { type: "pan", x: event.clientX, width: width - LABEL_WIDTH, start: state.view.start, end: state.view.end }
	tracksCanvas.classList.add("is-panning");
});

tracksCanvas.addEventListener("mousemove", event => {
	if (!state.recording || gesture) return;
	const { x, y, width } = pointer(tracksCanvas, event);
	tracksCanvas.style.cursor = x < LABEL_WIDTH ? "pointer" : "";
	const band = layout().find(item => y >= item.top && y < item.top + item.height);
	if (x < LABEL_WIDTH || !band) {
		hideHover();
		return;
	}

	state.hoverTime = timeAtTracks(x, width);
	if (state.collapsed.has(band.track.id)) tooltip.hidden = true;
	else showTooltip(event, band, nearestIndex(state.hoverTime));
	requestDraw();
});

tracksCanvas.addEventListener("mouseleave", hideHover);

tracksCanvas.addEventListener("wheel", event => {
	if (!state.recording) return;
	event.preventDefault();
	const { view } = state;
	const { x, width } = pointer(tracksCanvas, event);
	const span = view.end - view.start;
	if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
		const shift = (event.deltaX || event.deltaY) / (width - LABEL_WIDTH) * span;
		setView(view.start + shift, view.end + shift);
		return;
	}

	const anchor = x < LABEL_WIDTH ? (view.start + view.end) / 2 : timeAtTracks(x, width);
	const nextSpan = span * Math.exp(event.deltaY * 0.0015);
	const start = anchor - (anchor - view.start) * nextSpan / span;
	setView(start, start + nextSpan);
}, { passive: false });

tracksCanvas.addEventListener("dblclick", event => {
	if (state.recording && pointer(tracksCanvas, event).x >= LABEL_WIDTH) setView(0, state.recording.duration);
});

const overviewTime = event => {
	const { duration } = state.recording;
	const { x, width } = pointer(overview, event);
	return { x, time: Math.min(duration, Math.max(0, x / width * duration)), width }
}

const selectionEdges = width => ({
	left: state.view.start / state.recording.duration * width,
	right: state.view.end / state.recording.duration * width
});

overview.addEventListener("mousedown", event => {
	if (!state.recording) return;
	const { x, time, width } = overviewTime(event);
	const { left, right } = selectionEdges(width);
	if (Math.abs(x - left) <= EDGE) gesture = { type: "resize-start" }
	else if (Math.abs(x - right) <= EDGE) gesture = { type: "resize-end" }
	else if (x > left && x < right) gesture = { type: "move", offset: time - state.view.start }
	else gesture = { type: "select", anchor: time, x: event.clientX, isMoved: false }
});

overview.addEventListener("mousemove", event => {
	if (!state.recording || gesture) return;
	const { x, width } = overviewTime(event);
	const { left, right } = selectionEdges(width);
	overview.style.cursor = Math.abs(x - left) <= EDGE || Math.abs(x - right) <= EDGE ? "ew-resize" : x > left && x < right ? "grab" : "crosshair";
});

window.addEventListener("mousemove", event => {
	if (!gesture || !state.recording) return;
	const { view } = state;
	if (gesture.type === "pan") {
		const shift = -(event.clientX - gesture.x) / gesture.width * (gesture.end - gesture.start);
		setView(gesture.start + shift, gesture.end + shift);
		return;
	}

	const { time } = overviewTime(event);
	if (gesture.type === "resize-start") setView(Math.min(time, view.end), view.end);
	else if (gesture.type === "resize-end") setView(view.start, Math.max(time, view.start));
	else if (gesture.type === "move") {
		const span = view.end - view.start;
		setView(time - gesture.offset, time - gesture.offset + span);
	} else if (gesture.type === "select") {
		gesture.isMoved ||= Math.abs(event.clientX - gesture.x) > 3;
		if (gesture.isMoved) setView(Math.min(gesture.anchor, time), Math.max(gesture.anchor, time));
	}
});

window.addEventListener("mouseup", () => {
	if (gesture?.type === "select" && !gesture.isMoved) {
		const span = state.view.end - state.view.start;
		setView(gesture.anchor - span / 2, gesture.anchor + span / 2);
	}

	gesture = null;
	tracksCanvas.classList.remove("is-panning");
});