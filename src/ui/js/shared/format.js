export const megabytes = bytes => bytes / 1024 / 1024;

export const formatNumber = value => {
	const abs = Math.abs(value);
	if (abs >= 1e6) return `${(value / 1e6).toFixed(1)} M`;
	if (abs >= 1e4) return `${(value / 1e3).toFixed(1)} K`;
	if (Number.isInteger(value)) return String(value);
	return value.toFixed(abs >= 100 ? 0 : 2);
}

export const formatMegabytes = value => value >= 1024 ? `${(value / 1024).toFixed(2)} GB` : `${value.toFixed(1)} MB`;
export const formatPercent = value => `${value.toFixed(1)}%`;
export const signed = (value, format) => value > 0 ? `+${format(value)}` : value < 0 ? `−${format(-value)}` : "0";

export const clock = time => new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export const duration = milliseconds => {
	const seconds = Math.floor(milliseconds / 1000);
	const pad = value => String(value).padStart(2, "0");
	if (seconds < 3600) return `${Math.floor(seconds / 60)}:${pad(seconds % 60)}`;
	return `${Math.floor(seconds / 3600)}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
}

export const formatSpan = milliseconds => {
	if (Math.abs(milliseconds) < 1000) return `${Math.round(milliseconds)} ms`;
	if (Math.abs(milliseconds) < 60_000) return `${String(Math.round(milliseconds / 100) / 10)} s`;
	return duration(milliseconds);
}