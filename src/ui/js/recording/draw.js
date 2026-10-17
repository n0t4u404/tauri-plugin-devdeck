import { niceStep, sizeCanvas, token, traceCurve, verticalFill, withAlpha } from "#/shared/chart.js";
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
	context.strokeStyle = token("--chart-grid");
	context.fillStyle = token("--base-color-text-muted");
	context.lineWidth = 1;
	context.setLineDash([2, 6]);
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
	context.setLineDash([]);
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
		const points = totals.map((value, index) => [xOf(times[index]), y(value)]);
		if (isFilled) {
			context.beginPath();
			traceCurve(context, points);
			context.lineTo(points.at(-1)[0], plotBottom);
			context.lineTo(points[0][0], plotBottom);
			context.closePath();
			context.fillStyle = verticalFill(context, color, plotTop, plotBottom, 0.35, 0.02);
			context.fill();
		}
		context.beginPath();
		traceCurve(context, points);
		context.strokeStyle = color;
		context.lineWidth = 1.5;
		context.stroke();
	}
	const accent = token("--base-color-accent");
	const memoryColor = token("--overview-memory");
	drawTotal(tracks.find(track => track.id === "cpu"), accent, true);
	drawTotal(tracks.find(track => track.id === "memory"), memoryColor, false);

	context.font = `600 10px ${token("--font-family-body")}`;
	context.textBaseline = "middle";
	context.textAlign = "left";
	const legend = [["CPU", accent], ["Memory", memoryColor]];
	let legendX = width - 8 - legend.reduce((sum, [label]) => sum + context.measureText(label).width + 22, 0);
	for (const [label, color] of legend) {
		context.beginPath();
		context.arc(legendX + 4, plotTop + 6, 3.5, 0, Math.PI * 2);
		context.fillStyle = color;
		context.fill();
		context.fillStyle = token("--base-color-text-secondary");
		context.fillText(label, legendX + 12, plotTop + 6.5);
		legendX += context.measureText(label).width + 22;
	}

	const left = xOf(view.start);
	const right = xOf(view.end);
	const bandTop = OVERVIEW_RULER + 2;
	const bandHeight = height - bandTop - 2;
	context.fillStyle = `rgba(${token("--base-color-bg-primary-rgb")}, 0.6)`;
	context.fillRect(0, OVERVIEW_RULER, left, height - OVERVIEW_RULER);
	context.fillRect(right, OVERVIEW_RULER, width - right, height - OVERVIEW_RULER);
	context.beginPath();
	context.roundRect(left + 0.5, bandTop + 0.5, Math.max(1, right - left - 1), bandHeight - 1, 8);
	context.fillStyle = withAlpha(accent, 0.06);
	context.fill();
	context.strokeStyle = withAlpha(accent, 0.7);
	context.lineWidth = 1;
	context.stroke();
	const middle = bandTop + bandHeight / 2;
	for (const edge of [left, right]) {
		context.beginPath();
		context.roundRect(edge - 3, middle - 10, 6, 20, 3);
		context.fillStyle = token("--base-color-text-primary");
		context.fill();
	}
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

const drawStacked = (context, { series, from, to, xOf, y, times, plotTop, plotBottom }) => {
	let base = new Array(to - from + 1).fill(0);
	for (const item of series) {
		const tops = base.map((value, offset) => value + (item.values[from + offset] ?? 0));
		const upper = tops.map((value, offset) => [xOf(times[from + offset]), y(value)]);
		const lower = base.map((value, offset) => [xOf(times[from + offset]), y(value)]).reverse();
		context.beginPath();
		traceCurve(context, upper);
		traceCurve(context, lower, { isContinuing: true });
		context.closePath();
		context.fillStyle = verticalFill(context, item.color, plotTop, plotBottom, 0.55, 0.14);
		context.fill();
		context.beginPath();
		traceCurve(context, upper);
		context.strokeStyle = item.color;
		context.lineWidth = 1.25;
		context.stroke();
		base = tops;
	}
}

const drawLines = (context, { series, from, to, xOf, y, times, plotTop, plotBottom }) => {
	for (const item of series) {
		const runs = [[]];
		for (let index = from; index <= to; index++) {
			const value = item.values[index];
			if (value === null || value === undefined) {
				if (runs.at(-1).length) runs.push([]);
				continue;
			}
			runs.at(-1).push([xOf(times[index]), y(value)]);
		}
		for (const points of runs.filter(run => run.length)) {
			context.beginPath();
			traceCurve(context, points);
			context.lineTo(points.at(-1)[0], plotBottom);
			context.lineTo(points[0][0], plotBottom);
			context.closePath();
			context.fillStyle = verticalFill(context, item.color, plotTop, plotBottom, 0.18, 0);
			context.fill();
			context.beginPath();
			traceCurve(context, points);
			context.strokeStyle = item.color;
			context.lineWidth = 1.75;
			context.stroke();
		}
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

	context.fillStyle = `rgba(${token("--base-color-text-primary-rgb")}, 0.025)`;
	context.fillRect(0, 0, LABEL_WIDTH, height);
	context.fillStyle = token("--base-color-border-faint");
	context.fillRect(LABEL_WIDTH - 1, 0, 1, height);
	drawTicks(context, { left: LABEL_WIDTH, width: plotWidth, start: view.start, end: view.end, lineTop: RULER_HEIGHT, lineBottom: height, labelY: 15 });

	for (const { track, top, height: bandHeight } of bands) {
		context.strokeStyle = token("--base-color-border-faint");
		context.beginPath();
		context.moveTo(0, top + 0.5);
		context.lineTo(width, top + 0.5);
		context.stroke();

		context.textAlign = "left";
		context.textBaseline = "middle";
		context.font = `600 12px ${font}`;
		context.fillStyle = token("--base-color-text-primary");
		context.fillText(`${collapsed.has(track.id) ? "▸" : "▾"}  ${track.title}`, 12, top + HEADER_HEIGHT / 2 + 2);
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
		context.fillText(track.unit(topValue), 26, top + HEADER_HEIGHT + 10);

		context.save();
		context.beginPath();
		context.rect(LABEL_WIDTH, plotTop, plotWidth, plotBottom - plotTop);
		context.clip();
		const draw = isStacked ? drawStacked : drawLines;
		draw(context, { series: track.series, from, to, xOf, y, times, plotTop, plotBottom });
		context.restore();
	}

	if (hoverTime !== null) {
		const x = Math.round(xOf(times[nearestIndex(hoverTime)])) + 0.5;
		context.strokeStyle = withAlpha(token("--base-color-text-primary"), 0.4);
		context.beginPath();
		context.moveTo(x, RULER_HEIGHT);
		context.lineTo(x, height);
		context.stroke();
	}
}