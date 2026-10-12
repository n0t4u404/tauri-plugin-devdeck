const PALETTE = [
	"#73bf69", "#f2cc0c", "#8ab8ff", "#ff780a", "#f2495c", "#5794f2", "#b877d9", "#6ed0e0",
	"#fade2a", "#37872d", "#e0b400", "#c4162a", "#1f60c4", "#8f3bb8", "#ff9830", "#447ebc"
];

export const MINUTE = 60;

const colors = new Map();
export const colorOf = key => {
	if (!colors.has(key)) colors.set(key, PALETTE[colors.size % PALETTE.length]);
	return colors.get(key);
}

export const token = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

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