import { alpha, createTheme } from "@mui/material/styles";
import { tokens } from "./tokens";

const focusRing = `0 0 0 2px ${tokens.bgPrimary}, 0 0 0 4px ${tokens.accentLight}`;

export const theme = createTheme({
	palette: {
		mode: "dark",
		primary: { main: tokens.accent },
		error: { main: tokens.danger },
		success: { main: tokens.success },
		background: { default: tokens.bgPrimary, paper: tokens.bgTertiary },
		text: { primary: tokens.textPrimary, secondary: tokens.textSecondary, disabled: tokens.textMuted },
		divider: tokens.borderFaint
	},
	typography: {
		fontFamily: tokens.font,
		fontSize: 12,
		button: { textTransform: "none", fontWeight: 600 }
	},
	shape: { borderRadius: 8 },
	components: {
		MuiCssBaseline: {
			styleOverrides: {
				body: { fontVariantNumeric: "tabular-nums", backgroundColor: tokens.bgPrimary }
			}
		},
		MuiButtonBase: {
			defaultProps: { disableRipple: true },
			styleOverrides: {
				root: { "&.Mui-focusVisible": { boxShadow: focusRing } }
			}
		},
		MuiMenuItem: {
			styleOverrides: {
				root: { "&.Mui-focusVisible": { boxShadow: "none" } }
			}
		},
		MuiSelect: {
			styleOverrides: {
				select: { paddingLeft: 8, borderRadius: 6, "&:focus": { backgroundColor: "transparent" }, "&:focus-visible": { boxShadow: focusRing } }
			}
		},
		MuiTableSortLabel: {
			styleOverrides: {
				root: { borderRadius: 4 }
			}
		},
		MuiPaper: {
			defaultProps: { elevation: 0 },
			styleOverrides: {
				root: { backgroundImage: "none", border: `1px solid ${tokens.borderLight}` }
			}
		},
		MuiButton: {
			defaultProps: { variant: "text", size: "small", disableElevation: true },
			styleOverrides: {
				root: {
					minWidth: 0,
					paddingInline: 10,
					color: tokens.textSecondary,
					"&:hover": { color: tokens.textPrimary },
					"&.Mui-focusVisible": { color: tokens.textPrimary, boxShadow: focusRing }
				}
			}
		},
		MuiTabs: {
			styleOverrides: {
				root: { minHeight: 48, overflow: "visible" },
				scroller: { overflow: "visible !important" },
				indicator: { height: 2, backgroundColor: tokens.accent }
			}
		},
		MuiTab: {
			styleOverrides: {
				root: {
					minHeight: 48,
					minWidth: 0,
					paddingInline: 4,
					marginRight: 20,
					fontSize: 13,
					fontWeight: 500,
					textTransform: "none",
					color: tokens.textSecondary,
					position: "relative",
					overflow: "visible",
					transition: "color 0.15s ease",
					"&::after": {
						position: "absolute",
						right: 0,
						bottom: 0,
						left: 0,
						height: 2,
						borderRadius: 1,
						content: "\"\"",
						backgroundColor: alpha(tokens.textPrimary, 0.24),
						opacity: 0,
						transition: "opacity 0.15s ease"
					},
					"&::before": {
						position: "absolute",
						inset: "8px -6px",
						content: "\"\"",
						borderRadius: 8,
						boxShadow: `inset 0 0 0 2px ${tokens.accentLight}`,
						opacity: 0,
						pointerEvents: "none"
					},
					"&:hover": { color: tokens.textPrimary },
					"&.Mui-focusVisible": { color: tokens.textPrimary, boxShadow: "none" },
					"&.Mui-focusVisible::before": { opacity: 1 },
					"&:not(.Mui-selected):hover::after": { opacity: 1 },
					"&.Mui-selected": { color: tokens.textPrimary }
				}
			}
		},
		MuiTableCell: {
			styleOverrides: {
				root: { padding: "5px 8px", borderColor: tokens.borderFaint, fontSize: 12, whiteSpace: "nowrap" },
				head: {
					fontSize: 10,
					fontWeight: 500,
					color: tokens.textMuted,
					textTransform: "uppercase",
					letterSpacing: "0.06em"
				}
			}
		},
		MuiTableRow: {
			styleOverrides: {
				root: { "&:last-child td": { borderBottom: 0 } }
			}
		},
		MuiChip: {
			styleOverrides: {
				root: { fontWeight: 600, borderRadius: 6 }
			}
		},
		MuiOutlinedInput: {
			styleOverrides: {
				notchedOutline: { borderColor: tokens.borderLight }
			}
		},
		MuiDivider: {
			styleOverrides: {
				root: { borderColor: tokens.borderFaint }
			}
		},
		MuiTooltip: {
			styleOverrides: {
				tooltip: { backgroundColor: tokens.bgTertiary, border: `1px solid ${alpha(tokens.textPrimary, 0.1)}` }
			}
		}
	}
});