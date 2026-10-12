import { niceStep, sizeCanvas, token } from "#/shared/chart.js";
import { formatSpan } from "#/shared/format.js";
import { HEADER_HEIGHT, LABEL_WIDTH, OVERVIEW_RULER, RULER_HEIGHT, nearestIndex, state, visibleRange } from "./state.js";

const TIME_STEPS = [10, 20, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000, 300000, 600000];

const overview = document.getElementById("timeline-overview");
const tracksCanvas = document.getElementById("timeline-tracks");

const peakOf = values => values.reduce((peak, value) => Math.max(peak, value), 1e-9);

const niceTop = peak => {
	const step = niceStep(peak, 2);
	return Math.max(step, Math.ceil(peak / step) * step);
}

const drawTicks = (context, { left, width, start, end, lineTop, lineBottom, labelY }) => {
	const span = end - start;
	const step = TIME_STEPS.find(candidate => candidate / span * width >= 70) ?? TIME_STEPS.at(-1);
	context.strokeStyle = token("--base-color-border-faint");
	context.fillStyle = token("--base-color-text-muted");
	context.lineWidth = 1;
	context.font = `11px ${token("--font-family-body")}`;
	context.textAlign = "right";
	context.textBaseline = "alphabetic";
	for (let time = Math.ceil(start / step) * step; time <= end; time += step) {
		const x = Math.round(left + (time - start) / span * width) + 0.5;
		context.beginPath();
		context.moveTo(x, lineTop);
		context.lineTo(x, lineBottom);
		context.stroke();
		if (x - left > 30) context.fillText(formatSpan(time), x - 4, labelY);
	}
}

const totalsOf = (series, from, to) => {
	const totals = [];
	for (let index = from; index <= to; index++) totals.push(series.reduce((sum, item) => sum + (item.values[index] ?? 0), 0));
	return totals;
}

export const drawOverview = () => {
	const { context, width, height } = sizeCanvas(overview);
	const { recording, view } = state;
	const { times, duration, tracks } = recording;
	const xOf = time => time / duration * width;
	const plotTop = OVERVIEW_RULER + 4;
	const plotBottom = height - 2;
	drawTicks(context, { left: 0, width, start: 0, end: duration, lineTop: OVERVIEW_RULER, lineBottom: height, labelY: 11 });

	const drawTotal = (track, color, isFilled) => {
		if (!track) return;
		const totals = totalsOf(track.series, 0, times.length - 1);
		const top = peakOf(totals);
		const y = value => plotBottom - value / top * (plotBottom - plotTop);
		context.beginPath();
		totals.forEach((value, index) => index === 0 ? context.moveTo(xOf(times[index]), y(value)) : context.lineTo(xOf(times[index]), y(value)));
		context.strokeStyle = color;
		context.lineWidth = 1.25;
		context.stroke();
		if (!isFilled) return;
		context.lineTo(xOf(times.at(-1)), plotBottom);
		context.lineTo(xOf(times[0]), plotBottom);
		context.closePath();
		context.globalAlpha = 0.25;
		context.fillStyle = color;
		context.fill();
		context.globalAlpha = 1;
	}
	const accent = token("--base-color-accent");
	const success = token("--base-color-success");
	drawTotal(tracks.find(track => track.id === "cpu"), accent, true);
	drawTotal(tracks.find(track => track.id === "memory"), success, false);

	context.font = `600 10px ${token("--font-family-body")}`;
	context.textAlign = "right";
	context.textBaseline = "top";
	context.fillStyle = accent;
	context.fillText("CPU", width - 4, plotTop);
	context.fillStyle = success;
	context.fillText("MEM", width - 4, plotTop + 12);

	const left = xOf(view.start);
	const right = xOf(view.end);
	context.fillStyle = `rgba(${token("--base-color-bg-primary-rgb")}, 0.65)`;
	context.fillRect(0, OVERVIEW_RULER, left, height - OVERVIEW_RULER);
	context.fillRect(right, OVERVIEW_RULER, width - right, height - OVERVIEW_RULER);
	context.strokeStyle = accent;
	context.lineWidth = 1;
	context.strokeRect(left + 0.5, OVERVIEW_RULER + 0.5, Math.max(1, right - left - 1), height - OVERVIEW_RULER - 1);
	context.fillStyle = accent;
	const middle = (OVERVIEW_RULER + height) / 2;
	context.fillRect(left - 2, middle - 8, 4, 16);
	context.fillRect(right - 2, middle - 8, 4, 16);
}

export const layout = () => {
	let top = RULER_HEIGHT;
	return state.recording.tracks.map(track => {
		const height = state.collapsed.has(track.id) ? HEADER_HEIGHT : track.height;
		const band = { track, top, height }
		top += height;
		return band;
	});
}

const drawStacked = (context, { series, from, to, xOf, y, times }) => {
	const base = new Array(to - from + 1).fill(0);
	for (const item of series) {
		context.beginPath();
		for (let index = from; index <= to; index++) {
			const value = base[index - from] + (item.values[index] ?? 0);
			if (index === from) context.moveTo(xOf(times[index]), y(value));
			else context.lineTo(xOf(times[index]), y(value));
		}
		for (let index = to; index >= from; index--) context.lineTo(xOf(times[index]), y(base[index - from]));
		context.closePath();
		context.globalAlpha = 0.85;
		context.fillStyle = item.color;
		context.fill();
		for (let index = from; index <= to; index++) base[index - from] += item.values[index] ?? 0;
	}
	context.globalAlpha = 1;
}

const drawLines = (context, { series, from, to, xOf, y, times }) => {
	context.lineWidth = 1.5;
	for (const item of series) {
		context.strokeStyle = item.color;
		context.beginPath();
		let isDrawing = false;
		for (let index = from; index <= to; index++) {
			const value = item.values[index];
			if (value === null || value === undefined) {
				isDrawing = false;
				continue;
			}
			if (isDrawing) context.lineTo(xOf(times[index]), y(value));
			else context.moveTo(xOf(times[index]), y(value));
			isDrawing = true;
		}
		context.stroke();
	}
}

export const drawTracks = () => {
	const bands = layout();
	const last = bands.at(-1);
	tracksCanvas.style.height = `${last ? last.top + last.height : RULER_HEIGHT}px`;
	const { context, width, height } = sizeCanvas(tracksCanvas);
	const { recording, view, hoverTime, collapsed } = state;
	const { times } = recording;
	const plotWidth = width - LABEL_WIDTH;
	const xOf = time => LABEL_WIDTH + (time - view.start) / (view.end - view.start) * plotWidth;
	const [from, to] = visibleRange();
	const font = token("--font-family-body");

	context.fillStyle = token("--base-color-bg-tertiary");
	context.fillRect(0, 0, LABEL_WIDTH, height);
	drawTicks(context, { left: LABEL_WIDTH, width: plotWidth, start: view.start, end: view.end, lineTop: RULER_HEIGHT, lineBottom: height, labelY: 15 });

	for (const { track, top, height: bandHeight } of bands) {
		context.strokeStyle = token("--base-color-border-light");
		context.beginPath();
		context.moveTo(0, top + 0.5);
		context.lineTo(width, top + 0.5);
		context.stroke();

		context.textAlign = "left";
		context.textBaseline = "middle";
		context.font = `500 12px ${font}`;
		context.fillStyle = token("--base-color-text-primary");
		context.fillText(`${collapsed.has(track.id) ? "▸" : "▾"}  ${track.title}`, 10, top + HEADER_HEIGHT / 2);
		if (collapsed.has(track.id)) continue;

		const plotTop = top + 6;
		const plotBottom = top + bandHeight - 4;
		const isStacked = track.kind === "stacked";
		const heights = isStacked
			? totalsOf(track.series, from, to)
			: track.series.flatMap(series => series.values.slice(from, to + 1).map(value => value ?? 0));
		const topValue = niceTop(peakOf(heights));
		const y = value => plotBottom - value / topValue * (plotBottom - plotTop);

		context.font = `11px ${font}`;
		context.fillStyle = token("--base-color-text-muted");
		context.fillText(track.unit(topValue), 10, top + HEADER_HEIGHT + 8);

		context.save();
		context.beginPath();
		context.rect(LABEL_WIDTH, plotTop, plotWidth, plotBottom - plotTop);
		context.clip();
		const draw = isStacked ? drawStacked : drawLines;
		draw(context, { series: track.series, from, to, xOf, y, times });
		context.restore();
	}

	if (hoverTime !== null) {
		const x = Math.round(xOf(times[nearestIndex(hoverTime)])) + 0.5;
		context.strokeStyle = token("--base-color-accent");
		context.setLineDash([3, 3]);
		context.beginPath();
		context.moveTo(x, RULER_HEIGHT);
		context.lineTo(x, height);
		context.stroke();
		context.setLineDash([]);
	}
}
