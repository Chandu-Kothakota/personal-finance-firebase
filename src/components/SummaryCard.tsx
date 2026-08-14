import { Card, CardContent, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

export function SummaryCard({
  label,
  value,
  caption,
  icon,
}: {
  label: string;
  value: string;
  caption?: string;
  icon?: ReactNode;
}) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <div>
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
            <Typography variant="h5" fontWeight={800} sx={{ mt: 0.75 }}>
              {value}
            </Typography>
            {caption && (
              <Typography variant="caption" color="text.secondary">
                {caption}
              </Typography>
            )}
          </div>
          {icon}
        </Stack>
      </CardContent>
    </Card>
  );
}
