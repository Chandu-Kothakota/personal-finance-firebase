import { Box, Card, Grid, Skeleton, Stack } from "@mui/material";

/** Page-shaped placeholder shown while data loads for the first time. */
export function LoadingScreen({ label = "Loading your finances…" }: { label?: string }) {
  return (
    <Box role="status" aria-live="polite" aria-label={label}>
      <Stack sx={{ pb: 2.5, mb: 3, borderBottom: 1, borderColor: "divider" }}>
        <Skeleton variant="text" width={220} height={36} />
        <Skeleton variant="text" width={320} />
      </Stack>
      <Grid container spacing={2}>
        {[0, 1, 2, 3].map((i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, lg: 3 }}>
            <Card sx={{ p: 2.25 }}>
              <Skeleton variant="text" width="45%" />
              <Skeleton variant="text" width="70%" height={40} />
              <Skeleton variant="text" width="55%" />
            </Card>
          </Grid>
        ))}
        <Grid size={12}>
          <Card sx={{ p: 2.5 }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} variant="text" height={34} />
            ))}
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
