import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

export function SummaryCard({
  label,
  value,
  caption,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  caption?: string;
  icon?: ReactNode;
  tone?: "neutral" | "positive" | "warning" | "negative";
}) {
  const tones = {
    neutral: { bg: "#EEF4F8", fg: "#0B1F33" },
    positive: { bg: "#EAF8F0", fg: "#15803D" },
    warning: { bg: "#FFF5E7", fg: "#B45309" },
    negative: { bg: "#FDECEC", fg: "#B42318" },
  }[tone];

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary" fontWeight={650}>
              {label}
            </Typography>
            <Typography variant="h5" sx={{ mt: 0.8, fontVariantNumeric: "tabular-nums" }}>
              {value}
            </Typography>
            {caption && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                {caption}
              </Typography>
            )}
          </Box>
          {icon && (
            <Box sx={{ width: 42, height: 42, borderRadius: 2.5, display: "grid", placeItems: "center", bgcolor: tones.bg, color: tones.fg, flexShrink: 0 }}>
              {icon}
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
