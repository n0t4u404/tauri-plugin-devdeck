const PALETTE = [
	"#8B7CFF", "#2DD4BF", "#F472B6", "#60A5FA", "#FBBF24", "#34D399", "#FB7185", "#A78BFA",
	"#38BDF8", "#F59E0B", "#4ADE80", "#E879F9", "#22D3EE", "#FDA4AF", "#818CF8", "#BEF264"
];

export const MINUTE = 60;

const colors = new Map();
export const colorOf = key => {
	if (!colors.has(key)) colors.set(key, PALETTE[colors.size % PALETTE.length]);
	return colors.get(key);
}

export const token = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const withAlpha = (color, alpha) => {
	const hex = color.replace("#", "");
	const [red, green, blue] = [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
	return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export const niceStep = (range, count) => {
	const raw = range / count;
	const power = 10 ** Math.floor(Math.log10(raw || 1));
	return [1, 2, 2.5, 5, 10].map(multiple => multiple * power).find(candidate => candidate >= raw) ?? power * 10;
}

export const sizeCanvas = canvas => {
	const ratio = window.devicePixelRatio || 1;
	const width = canvas.clientWidth;
	const height = canvas.clientHeight;
	if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
		canvas.width = Math.round(width * ratio);
		canvas.height = Math.round(height * ratio);
	}

	const context = canvas.getContext("2d");
	context.setTransform(ratio, 0, 0, ratio, 0, 0);
	context.clearRect(0, 0, width, height);
	return { context, width, height }
}

const tangentsOf = points => {
	const count = points.length;
	const slopes = [];
	const widths = [];
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
	tangents.push(slopes.at(-1));
	return tangents;
}

export const traceCurve = (context, points, { isContinuing = false } = {}) => {
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

export const verticalFill = (context, color, top, bottom, from = 0.32, to = 0) => {
	const gradient = context.createLinearGradient(0, top, 0, bottom);
	gradient.addColorStop(0, withAlpha(color, from));
	gradient.addColorStop(1, withAlpha(color, to));
	return gradient;
}

export const drawDot = (context, x, y, color) => {
	context.beginPath();
	context.arc(x, y, 7, 0, Math.PI * 2);
	context.fillStyle = withAlpha(color, 0.2);
	context.fill();
	context.beginPath();
	context.arc(x, y, 3.5, 0, Math.PI * 2);
	context.fillStyle = color;
	context.fill();
	context.lineWidth = 1.5;
	context.strokeStyle = token("--base-color-bg-secondary");
	context.stroke();
}

export const drawGrid = (context, { left, right, y, labels, unit }) => {
	context.font = `11px ${token("--font-family-body")}`;
	context.fillStyle = token("--base-color-text-muted");
	context.strokeStyle = token("--chart-grid");
	context.lineWidth = 1;
	context.textAlign = "right";
	context.textBaseline = "middle";
	context.setLineDash([2, 6]);
	for (const value of labels) {
		const lineY = Math.round(y(value)) + 0.5;
		context.beginPath();
		context.moveTo(left, lineY);
		context.lineTo(right, lineY);
		context.stroke();
		context.fillText(unit(value), left - 12, lineY);
	}
	context.setLineDash([]);
}

export const statsOf = (values, extra = {}) => {
	const present = values.filter(value => value !== null && value !== undefined);
	const sum = present.reduce((total, value) => total + value, 0);
	return {
		min: present.length ? Math.min(...present) : 0,
		max: present.length ? Math.max(...present) : 0,
		avg: present.length ? sum / present.length : 0,
		current: present.at(-1) ?? 0,
		...extra
	}
}

export const minuteChange = values => (values.at(-1) ?? 0) - (values.at(-1 - MINUTE) ?? values[0] ?? 0);

export const fitPeak = values => {
	const sorted = values.filter(value => value > 0).sort((a, b) => a - b);
	if (sorted.length === 0) return 1e-9;
	const max = sorted.at(-1);
	const usual = sorted[Math.floor((sorted.length - 1) * 0.98)];
	return usual > 0 && max > usual * 1.5 ? usual * 1.2 : max;
}