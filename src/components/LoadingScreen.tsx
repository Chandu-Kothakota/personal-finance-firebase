import { Box, CircularProgress, Typography } from "@mui/material";

export function LoadingScreen({ label = "Loading your finances…" }: { label?: string }) {
  return (
    <Box
      sx={{
        minHeight: "60vh",
        display: "grid",
        placeItems: "center",
        textAlign: "center",
      }}
    >
      <Box>
        <CircularProgress size={34} />
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          {label}
        </Typography>
      </Box>
    </Box>
  );
}
