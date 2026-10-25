export const tokens = {
	font: "\"Inter Variable\", \"Inter\", system-ui, sans-serif",
	bgPrimary: "#07080C",
	bgSecondary: "#0E1016",
	bgTertiary: "#161922",
	borderLight: "#FFFFFF1A",
	borderFaint: "#FFFFFF0F",
	textPrimary: "#F4F5F8",
	textSecondary: "#9AA1B2",
	textMuted: "#5E6576",
	accent: "#FF7A1A",
	accentLight: "#FF9A4D",
	danger: "#FB7185",
	success: "#34D399",
	chartGrid: "#FFFFFF12",
	overviewMemory: "#8B7CFF",
	cardBackground: "linear-gradient(180deg, #12151D 0%, #0D0F15 100%)",
	cardShadow: "inset 0 1px 0 #FFFFFF0A, 0 12px 32px -18px #00000099"
}

const PALETTE = [
	"#8B7CFF", "#2DD4BF", "#F472B6", "#60A5FA", "#FBBF24", "#34D399", "#FB7185", "#A78BFA",
	"#38BDF8", "#F59E0B", "#4ADE80", "#E879F9", "#22D3EE", "#FDA4AF", "#818CF8", "#BEF264"
];

const colors = new Map<string, string>();
export const colorOf = (key: string) => {
	if (!colors.has(key)) colors.set(key, PALETTE[colors.size % PALETTE.length]);
	return colors.get(key)!;
}

export const withAlpha = (color: string, alpha: number) => {
	const hex = color.replace("#", "");
	const [red, green, blue] = [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
	return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}