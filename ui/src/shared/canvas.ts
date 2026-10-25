import { tokens, withAlpha } from "./tokens";

export const sizeCanvas = (canvas: HTMLCanvasElement) => {
	const ratio = window.devicePixelRatio || 1;
	const width = canvas.clientWidth;
	const height = canvas.clientHeight;
	if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
		canvas.width = Math.round(width * ratio);
		canvas.height = Math.round(height * ratio);
	}

	const context = canvas.getContext("2d")!;
	context.setTransform(ratio, 0, 0, ratio, 0, 0);
	context.clearRect(0, 0, width, height);
	return { context, width, height }
}

type Point = [number, number];

const tangentsOf = (points: Point[]) => {
	const count = points.length;
	const slopes: number[] = [];
	const widths: number[] = [];
	for (let index = 0; index < count - 1; index++) {
		const width = points[index + 1][0] - points[index][0];
		widths.push(width);
		slopes.push(width === 0 ? 0 : (points[index + 1][1] - points[index][1]) / width);
	}

	const tangents = [slopes[0]];
	for (let index = 1; index < count - 1; index++) {
		const before = slopes[index - 1];
		const after = slopes[index];
		const blended = (before * widths[index] + after * widths[index - 1]) / (widths[index - 1] + widths[index] || 1);
		tangents.push((Math.sign(before) + Math.sign(after)) * Math.min(Math.abs(before), Math.abs(after), 0.5 * Math.abs(blended)));
	}
	tangents.push(slopes.at(-1)!);
	return tangents;
}

export const traceCurve = (context: CanvasRenderingContext2D, points: Point[], { isContinuing = false } = {}) => {
	if (points.length === 0) return;
	const [firstX, firstY] = points[0];
	if (isContinuing) context.lineTo(firstX, firstY);
	else context.moveTo(firstX, firstY);
	if (points.length === 1) return;

	const tangents = tangentsOf(points);
	for (let index = 0; index < points.length - 1; index++) {
		const [x0, y0] = points[index];
		const [x1, y1] = points[index + 1];
		const third = (x1 - x0) / 3;
		context.bezierCurveTo(x0 + third, y0 + tangents[index] * third, x1 - third, y1 - tangents[index + 1] * third, x1, y1);
	}
}

export const verticalFill = (context: CanvasRenderingContext2D, color: string, top: number, bottom: number, from = 0.32, to = 0) => {
	const gradient = context.createLinearGradient(0, top, 0, bottom);
	gradient.addColorStop(0, withAlpha(color, from));
	gradient.addColorStop(1, withAlpha(color, to));
	return gradient;
}

export const chartFont = (size: number, weight = 400) => `${weight} ${size}px ${tokens.font}`;