export const LABEL_WIDTH = 168;
export const RULER_HEIGHT = 22;
export const HEADER_HEIGHT = 22;
export const OVERVIEW_RULER = 16;

export const state = {
	recording: null,
	view: { start: 0, end: 1 },
	hoverTime: null,
	collapsed: new Set()
}

let draw = () => undefined;
let frame = 0;

export const onDraw = callback => {
	draw = callback;
}

export const requestDraw = () => {
	if (frame || !state.recording) return;
	frame = requestAnimationFrame(() => {
		frame = 0;
		draw();
	});
}

export const lowerIndex = time => {
	const { times } = state.recording;
	let low = 0;
	let high = times.length;
	while (low < high) {
		const middle = (low + high) >> 1;
		if (times[middle] < time) low = middle + 1;
		else high = middle;
	}
	return low;
}

export const nearestIndex = time => {
	const { times } = state.recording;
	const index = lowerIndex(time);
	if (index <= 0) return 0;
	if (index >= times.length) return times.length - 1;
	return time - times[index - 1] < times[index] - time ? index - 1 : index;
}

export const visibleRange = () => [
	Math.max(0, lowerIndex(state.view.start) - 1),
	Math.min(state.recording.times.length - 1, lowerIndex(state.view.end))
];

export const setView = (start, end) => {
	const { duration, interval } = state.recording;
	const minSpan = Math.min(duration, Math.max(interval * 4, 200));
	const span = Math.min(duration, Math.max(minSpan, end - start));
	const from = Math.min(Math.max(0, start), duration - span);
	state.view = { start: from, end: from + span }
	requestDraw();
}