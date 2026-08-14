import { Alert, Box, Button, Typography } from "@mui/material";
import { Component, type ErrorInfo, type ReactNode } from "react";

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled application error", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ maxWidth: 700, mx: "auto", py: 8, px: 2 }}>
          <Alert severity="error">
            <Typography fontWeight={800}>The dashboard encountered an unexpected error.</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Reload the page. Your saved Firestore data is not removed.
            </Typography>
            <Button sx={{ mt: 2 }} variant="outlined" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </Alert>
        </Box>
      );
    }

    return this.props.children;
  }
}
