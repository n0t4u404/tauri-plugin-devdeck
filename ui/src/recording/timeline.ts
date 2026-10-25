import { chartFont, sizeCanvas, traceCurve, verticalFill } from "#/shared/canvas";
import { formatSpan } from "#/shared/format";
import { niceStep, Series } from "#/shared/samples";
import { tokens, withAlpha } from "#/shared/tokens";
import { lowerIndex, nearestIndex, Recording, Track } from "./recording";

export const LABEL_WIDTH = 168;
const RULER_HEIGHT = 22;
const HEADER_HEIGHT = 22;
const OVERVIEW_RULER = 16;
const EDGE = 6;
const TIME_STEPS = [10, 20, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000, 300000, 600000];

export interface TimelineView {
	start: number;
	end: number;
}

export interface TimelineHover {
	x: number;
	y: number;
	title: string;
	rows: { name: string; color: string; value: string }[];
}

interface Band {
	track: Track;
	top: number;
	height: number;
}

type Gesture =
	| { type: "pan"; x: number; width: number; start: number; end: number }
	| { type: "resize-start" }
	| { type: "resize-end" }
	| { type: "move"; offset: number }
	| { type: "select"; anchor: number; x: number; isMoved: boolean }

interface DrawArea {
	series: Series[];
	from: number;
	to: number;
	xOf: (time: number) => number;
	y: (value: number) => number;
	times: number[];
	plotTop: number;
	plotBottom: number;
}

const peakOf = (values: number[]) => values.reduce((peak, value) => Math.max(peak, value), 1e-9);

const niceTop = (peak: number) => {
	const step = niceStep(peak, 2);
	return Math.max(step, Math.ceil(peak / step) * step);
}

const totalsOf = (series: Series[], from: number, to: number) => {
	const totals: number[] = [];
	for (let index = from; index <= to; index++) totals.push(series.reduce((sum, item) => sum + (item.values[index] ?? 0), 0));
	return totals;
}

const drawTicks = (context: CanvasRenderingContext2D, { left, width, start, end, lineTop, lineBottom, labelY }: { left: number; width: number; start: number; end: number; lineTop: number; lineBottom: number; labelY: number }) => {
	const span = end - start;
	const step = TIME_STEPS.find(candidate => candidate / span * width >= 70) ?? TIME_STEPS.at(-1)!;
	context.strokeStyle = tokens.chartGrid;
	context.fillStyle = tokens.textMuted;
	context.lineWidth = 1;
	context.setLineDash([2, 6]);
	context.font = chartFont(11);
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

const drawStacked = (context: CanvasRenderingContext2D, { series, from, to, xOf, y, times, plotTop, plotBottom }: DrawArea) => {
	let base = new Array<number>(to - from + 1).fill(0);
	for (const item of series) {
		const tops = base.map((value, offset) => value + (item.values[from + offset] ?? 0));
		const upper = tops.map((value, offset): [number, number] => [xOf(times[from + offset]), y(value)]);
		const lower = base.map((value, offset): [number, number] => [xOf(times[from + offset]), y(value)]).reverse();
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

const drawLines = (context: CanvasRenderingContext2D, { series, from, to, xOf, y, times, plotTop, plotBottom }: DrawArea) => {
	for (const item of series) {
		const runs: [number, number][][] = [[]];
		for (let index = from; index <= to; index++) {
			const value = item.values[index];
			if (value === null || value === undefined) {
				if (runs.at(-1)!.length) runs.push([]);
				continue;
			}
			runs.at(-1)!.push([xOf(times[index]), y(value)]);
		}

		for (const points of runs.filter(run => run.length)) {
			context.beginPath();
			traceCurve(context, points);
			context.lineTo(points.at(-1)![0], plotBottom);
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

export class Timeline {
	private recording: Recording | null = null;
	private view: TimelineView = { start: 0, end: 1 }
	private hoverTime: number | null = null;
	private collapsed = new Set<string>();
	private gesture: Gesture | null = null;
	private frame = 0;
	private readonly cleanups: (() => void)[] = [];

	constructor(
		private readonly overview: HTMLCanvasElement,
		private readonly tracks: HTMLCanvasElement,
		private readonly onView: (view: TimelineView) => void,
		private readonly onHover: (hover: TimelineHover | null) => void
	) {
		const observer = new ResizeObserver(() => this.requestDraw());
		observer.observe(overview);
		observer.observe(tracks);
		this.cleanups.push(() => observer.disconnect());
		this.listen(tracks, "mousedown", event => this.tracksDown(event));
		this.listen(tracks, "mousemove", event => this.tracksMove(event));
		this.listen(tracks, "mouseleave", () => this.hideHover());
		this.listen(tracks, "wheel", event => this.wheel(event), { passive: false });
		this.listen(tracks, "dblclick", event => {
			if (this.recording && this.pointer(tracks, event).x >= LABEL_WIDTH) this.setView(0, this.recording.duration);
		});
		this.listen(overview, "mousedown", event => this.overviewDown(event));
		this.listen(overview, "mousemove", event => this.overviewMove(event));
		this.listen(window, "mousemove", event => this.drag(event));
		this.listen(window, "mouseup", () => this.release());
	}

	destroy() {
		cancelAnimationFrame(this.frame);
		for (const cleanup of this.cleanups) cleanup();
	}

	setRecording(recording: Recording | null) {
		this.recording = recording;
		this.hoverTime = null;
		if (recording) this.setView(0, recording.duration);
	}

	private listen<K extends keyof HTMLElementEventMap>(target: HTMLElement | Window, type: K, handler: (event: HTMLElementEventMap[K]) => void, options?: AddEventListenerOptions) {
		const listener = handler as EventListener;
		target.addEventListener(type, listener, options);
		this.cleanups.push(() => target.removeEventListener(type, listener, options));
	}

	private requestDraw() {
		if (this.frame || !this.recording) return;
		this.frame = requestAnimationFrame(() => {
			this.frame = 0;
			this.drawOverview();
			this.drawTracks();
		});
	}

	private setView(start: number, end: number) {
		if (!this.recording) return;
		const { duration, interval } = this.recording;
		const minSpan = Math.min(duration, Math.max(interval * 4, 200));
		const span = Math.min(duration, Math.max(minSpan, end - start));
		const from = Math.min(Math.max(0, start), duration - span);
		this.view = { start: from, end: from + span }
		this.onView(this.view);
		this.requestDraw();
	}

	private layout(): Band[] {
		let top = RULER_HEIGHT;
		return (this.recording?.tracks ?? []).map(track => {
			const height = this.collapsed.has(track.id) ? HEADER_HEIGHT : track.height;
			const band = { track, top, height }
			top += height;
			return band;
		});
	}

	private visibleRange(): [number, number] {
		const { times } = this.recording!;
		return [
			Math.max(0, lowerIndex(times, this.view.start) - 1),
			Math.min(times.length - 1, lowerIndex(times, this.view.end))
		];
	}

	private drawOverview() {
		const { context, width, height } = sizeCanvas(this.overview);
		const { times, duration, tracks } = this.recording!;
		const xOf = (time: number) => time / duration * width;
		const plotTop = OVERVIEW_RULER + 4;
		const plotBottom = height - 2;
		drawTicks(context, { left: 0, width, start: 0, end: duration, lineTop: OVERVIEW_RULER, lineBottom: height, labelY: 11 });

		const drawTotal = (track: Track | undefined, color: string, isFilled: boolean) => {
			if (!track) return;
			const totals = totalsOf(track.series, 0, times.length - 1);
			const top = peakOf(totals);
			const y = (value: number) => plotBottom - value / top * (plotBottom - plotTop);
			const points = totals.map((value, index): [number, number] => [xOf(times[index]), y(value)]);
			if (isFilled) {
				context.beginPath();
				traceCurve(context, points);
				context.lineTo(points.at(-1)![0], plotBottom);
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
		drawTotal(tracks.find(track => track.id === "cpu"), tokens.accent, true);
		drawTotal(tracks.find(track => track.id === "memory"), tokens.overviewMemory, false);

		context.font = chartFont(10, 600);
		context.textBaseline = "middle";
		context.textAlign = "left";
		const legend: [string, string][] = [["CPU", tokens.accent], ["Memory", tokens.overviewMemory]];
		let legendX = width - 8 - legend.reduce((sum, [label]) => sum + context.measureText(label).width + 22, 0);
		for (const [label, color] of legend) {
			context.beginPath();
			context.arc(legendX + 4, plotTop + 6, 3.5, 0, Math.PI * 2);
			context.fillStyle = color;
			context.fill();
			context.fillStyle = tokens.textSecondary;
			context.fillText(label, legendX + 12, plotTop + 6.5);
			legendX += context.measureText(label).width + 22;
		}

		const left = xOf(this.view.start);
		const right = xOf(this.view.end);
		const bandTop = OVERVIEW_RULER + 2;
		const bandHeight = height - bandTop - 2;
		context.fillStyle = withAlpha(tokens.bgPrimary, 0.6);
		context.fillRect(0, OVERVIEW_RULER, left, height - OVERVIEW_RULER);
		context.fillRect(right, OVERVIEW_RULER, width - right, height - OVERVIEW_RULER);
		context.beginPath();
		context.roundRect(left + 0.5, bandTop + 0.5, Math.max(1, right - left - 1), bandHeight - 1, 8);
		context.fillStyle = withAlpha(tokens.accent, 0.06);
		context.fill();
		context.strokeStyle = withAlpha(tokens.accent, 0.7);
		context.lineWidth = 1;
		context.stroke();
		const middle = bandTop + bandHeight / 2;
		for (const edge of [left, right]) {
			context.beginPath();
			context.roundRect(edge - 3, middle - 10, 6, 20, 3);
			context.fillStyle = tokens.textPrimary;
			context.fill();
		}
	}

	private drawTracks() {
		const bands = this.layout();
		const last = bands.at(-1);
		this.tracks.style.height = `${last ? last.top + last.height : RULER_HEIGHT}px`;
		const { context, width, height } = sizeCanvas(this.tracks);
		const { times } = this.recording!;
		const { view } = this;
		const plotWidth = width - LABEL_WIDTH;
		const xOf = (time: number) => LABEL_WIDTH + (time - view.start) / (view.end - view.start) * plotWidth;
		const [from, to] = this.visibleRange();

		context.fillStyle = withAlpha(tokens.textPrimary, 0.025);
		context.fillRect(0, 0, LABEL_WIDTH, height);
		context.fillStyle = tokens.borderFaint;
		context.fillRect(LABEL_WIDTH - 1, 0, 1, height);
		drawTicks(context, { left: LABEL_WIDTH, width: plotWidth, start: view.start, end: view.end, lineTop: RULER_HEIGHT, lineBottom: height, labelY: 15 });

		for (const { track, top, height: bandHeight } of bands) {
			context.strokeStyle = tokens.borderFaint;
			context.beginPath();
			context.moveTo(0, top + 0.5);
			context.lineTo(width, top + 0.5);
			context.stroke();

			context.textAlign = "left";
			context.textBaseline = "middle";
			context.font = chartFont(12, 600);
			context.fillStyle = tokens.textPrimary;
			context.fillText(`${this.collapsed.has(track.id) ? "▸" : "▾"}  ${track.title}`, 12, top + HEADER_HEIGHT / 2 + 2);
			if (this.collapsed.has(track.id)) continue;

			const plotTop = top + 6;
			const plotBottom = top + bandHeight - 4;
			const isStacked = track.kind === "stacked";
			const heights = isStacked
				? totalsOf(track.series, from, to)
				: track.series.flatMap(series => series.values.slice(from, to + 1).map(value => value ?? 0));
			const topValue = niceTop(peakOf(heights));
			const y = (value: number) => plotBottom - value / topValue * (plotBottom - plotTop);

			context.font = chartFont(11);
			context.fillStyle = tokens.textMuted;
			context.fillText(track.unit(topValue), 26, top + HEADER_HEIGHT + 10);

			context.save();
			context.beginPath();
			context.rect(LABEL_WIDTH, plotTop, plotWidth, plotBottom - plotTop);
			context.clip();
			(isStacked ? drawStacked : drawLines)(context, { series: track.series, from, to, xOf, y, times, plotTop, plotBottom });
			context.restore();
		}

		if (this.hoverTime !== null) {
			const x = Math.round(xOf(times[nearestIndex(times, this.hoverTime)])) + 0.5;
			context.strokeStyle = withAlpha(tokens.textPrimary, 0.4);
			context.beginPath();
			context.moveTo(x, RULER_HEIGHT);
			context.lineTo(x, height);
			context.stroke();
		}
	}

	private pointer(canvas: HTMLCanvasElement, event: MouseEvent) {
		const rect = canvas.getBoundingClientRect();
		return { x: event.clientX - rect.left, y: event.clientY - rect.top, width: rect.width }
	}

	private timeAtTracks(x: number, width: number) {
		return this.view.start + (x - LABEL_WIDTH) / (width - LABEL_WIDTH) * (this.view.end - this.view.start);
	}

	private hideHover() {
		this.hoverTime = null;
		this.onHover(null);
		this.requestDraw();
	}

	private tracksDown(event: MouseEvent) {
		if (!this.recording) return;
		const { x, y, width } = this.pointer(this.tracks, event);
		if (x < LABEL_WIDTH) {
			const band = this.layout().find(item => y >= item.top && y < item.top + HEADER_HEIGHT);
			if (!band) return;
			if (this.collapsed.has(band.track.id)) this.collapsed.delete(band.track.id);
			else this.collapsed.add(band.track.id);
			this.requestDraw();
			return;
		}

		this.gesture = { type: "pan", x: event.clientX, width: width - LABEL_WIDTH, start: this.view.start, end: this.view.end }
		this.tracks.style.cursor = "grabbing";
	}

	private tracksMove(event: MouseEvent) {
		if (!this.recording || this.gesture) return;
		const { x, y, width } = this.pointer(this.tracks, event);
		this.tracks.style.cursor = x < LABEL_WIDTH ? "pointer" : "grab";
		const band = this.layout().find(item => y >= item.top && y < item.top + item.height);
		if (x < LABEL_WIDTH || !band) {
			this.hideHover();
			return;
		}

		this.hoverTime = this.timeAtTracks(x, width);
		if (this.collapsed.has(band.track.id)) {
			this.onHover(null);
		} else {
			const index = nearestIndex(this.recording.times, this.hoverTime);
			this.onHover({
				x: event.clientX,
				y: event.clientY,
				title: `${band.track.title} · ${formatSpan(this.recording.times[index])}`,
				rows: band.track.series
					.map(series => ({ series, value: series.values[index] }))
					.filter((item): item is { series: Series; value: number } => item.value !== null && item.value !== undefined && item.value !== 0)
					.sort((a, b) => b.value - a.value)
					.slice(0, 12)
					.map(({ series, value }) => ({ name: series.name, color: series.color, value: band.track.unit(value) }))
			});
		}
		this.requestDraw();
	}

	private wheel(event: WheelEvent) {
		if (!this.recording) return;
		event.preventDefault();
		const { view } = this;
		const { x, width } = this.pointer(this.tracks, event);
		const span = view.end - view.start;
		if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
			const shift = (event.deltaX || event.deltaY) / (width - LABEL_WIDTH) * span;
			this.setView(view.start + shift, view.end + shift);
			return;
		}

		const anchor = x < LABEL_WIDTH ? (view.start + view.end) / 2 : this.timeAtTracks(x, width);
		const nextSpan = span * Math.exp(event.deltaY * 0.0015);
		const start = anchor - (anchor - view.start) * nextSpan / span;
		this.setView(start, start + nextSpan);
	}

	private overviewTime(event: MouseEvent) {
		const { duration } = this.recording!;
		const { x, width } = this.pointer(this.overview, event);
		return { x, time: Math.min(duration, Math.max(0, x / width * duration)), width }
	}

	private selectionEdges(width: number) {
		const { duration } = this.recording!;
		return { left: this.view.start / duration * width, right: this.view.end / duration * width }
	}

	private overviewDown(event: MouseEvent) {
		if (!this.recording) return;
		const { x, time, width } = this.overviewTime(event);
		const { left, right } = this.selectionEdges(width);
		if (Math.abs(x - left) <= EDGE) this.gesture = { type: "resize-start" }
		else if (Math.abs(x - right) <= EDGE) this.gesture = { type: "resize-end" }
		else if (x > left && x < right) this.gesture = { type: "move", offset: time - this.view.start }
		else this.gesture = { type: "select", anchor: time, x: event.clientX, isMoved: false }
	}

	private overviewMove(event: MouseEvent) {
		if (!this.recording || this.gesture) return;
		const { x, width } = this.overviewTime(event);
		const { left, right } = this.selectionEdges(width);
		this.overview.style.cursor = Math.abs(x - left) <= EDGE || Math.abs(x - right) <= EDGE ? "ew-resize" : x > left && x < right ? "grab" : "crosshair";
	}

	private drag(event: MouseEvent) {
		const { gesture, view } = this;
		if (!gesture || !this.recording) return;
		if (gesture.type === "pan") {
			const shift = -(event.clientX - gesture.x) / gesture.width * (gesture.end - gesture.start);
			this.setView(gesture.start + shift, gesture.end + shift);
			return;
		}

		const { time } = this.overviewTime(event);
		if (gesture.type === "resize-start") this.setView(Math.min(time, view.end), view.end);
		else if (gesture.type === "resize-end") this.setView(view.start, Math.max(time, view.start));
		else if (gesture.type === "move") {
			const span = view.end - view.start;
			this.setView(time - gesture.offset, time - gesture.offset + span);
		} else {
			gesture.isMoved ||= Math.abs(event.clientX - gesture.x) > 3;
			if (gesture.isMoved) this.setView(Math.min(gesture.anchor, time), Math.max(gesture.anchor, time));
		}
	}

	private release() {
		const { gesture } = this;
		if (gesture?.type === "select" && !gesture.isMoved) {
			const span = this.view.end - this.view.start;
			this.setView(gesture.anchor - span / 2, gesture.anchor + span / 2);
		}

		this.gesture = null;
		this.tracks.style.cursor = "grab";
	}
}