import { Box, Stack, Typography } from "@mui/material";
import { PropsWithChildren, ReactNode } from "react";

interface SectionProps {
	title: string;
	value?: string;
	subtitle?: string;
	aside?: ReactNode;
	note?: string;
}

export const Section = ({ title, value, subtitle, aside, note, children }: PropsWithChildren<SectionProps>) => (
	<Box component="section" sx={{ px: 3, py: 2.5, borderBottom: 1, borderColor: "divider" }}>
		<Stack direction="row" spacing={1.5} sx={{ alignItems: "baseline", mb: 1.5 }}>
			<Typography sx={{ fontSize: 13, fontWeight: 600, color: "text.secondary" }}>{title}</Typography>
			{value && <Typography sx={{ fontSize: 20, fontWeight: 600, color: "text.primary", letterSpacing: "-0.01em" }}>{value}</Typography>}
			{subtitle && <Typography sx={{ fontSize: 11, color: "text.disabled" }}>{subtitle}</Typography>}
			{aside && <Box sx={{ ml: "auto !important" }}>{aside}</Box>}
		</Stack>
		{children}
		{note && <Typography sx={{ mt: 1.5, fontSize: 11, color: "text.disabled" }}>{note}</Typography>}
	</Box>
);