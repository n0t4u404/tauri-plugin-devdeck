import { Box, Button, Typography } from "@mui/material";
import { Component, PropsWithChildren } from "react";

interface ErrorBoundaryState {
	error: Error | null;
}

export class ErrorBoundary extends Component<PropsWithChildren<{ name: string }>, ErrorBoundaryState> {
	state: ErrorBoundaryState = { error: null }

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { error }
	}

	componentDidCatch(error: Error) {
		console.error(`[devdeck] ${this.props.name}`, error);
	}

	render() {
		if (!this.state.error) return this.props.children;
		return (
			<Box sx={{ px: 3, py: 2.5, borderBottom: 1, borderColor: "divider" }}>
				<Typography sx={{ fontSize: 13, fontWeight: 600, color: "error.main" }}>{`${this.props.name} stopped: ${this.state.error.message}`}</Typography>
				<Button sx={{ mt: 1, ml: -1.25 }} onClick={() => this.setState({ error: null })}>Try again</Button>
			</Box>
		);
	}
}