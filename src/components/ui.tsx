import { Box, Card, CardActionArea, Chip, Divider, Stack, Typography, type SxProps, type Theme } from "@mui/material";
import type { ReactNode } from "react";
import { colors } from "../theme/theme";

/** Page title row: title, one-line description, and actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      justifyContent="space-between"
      alignItems={{ xs: "flex-start", sm: "flex-end" }}
      gap={2}
      sx={{ pb: 2.5, mb: 3, borderBottom: 1, borderColor: "divider" }}
    >
      <Box>
        <Typography variant="h4" component="h1">{title}</Typography>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {description}
          </Typography>
        )}
      </Box>
      {actions && <Stack direction="row" gap={1} flexWrap="wrap">{actions}</Stack>}
    </Stack>
  );
}

/** Bordered section with a header bar. Use `flush` for tables that run edge to edge. */
export function Panel({
  title,
  subtitle,
  action,
  flush = false,
  children,
  sx,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  flush?: boolean;
  children: ReactNode;
  sx?: SxProps<Theme>;
}) {
  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column", ...sx }}>
      {title && (
        <>
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2} sx={{ px: 2.5, py: 1.75 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" component="h2">{title}</Typography>
              {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
            </Box>
            {action}
          </Stack>
          <Divider />
        </>
      )}
      <Box sx={{ flex: 1, ...(flush ? {} : { p: 2.5 }) }}>{children}</Box>
    </Card>
  );
}

export type Trend = { label: string; tone: "positive" | "negative" | "neutral" };

/** A single headline figure with a label, optional trend and supporting line. */
export function StatCard({
  label,
  value,
  caption,
  trend,
  tone = "default",
  onClick,
}: {
  label: string;
  value: string;
  caption?: string;
  trend?: Trend;
  tone?: "default" | "positive" | "negative";
  onClick?: () => void;
}) {
  const valueColor = tone === "positive" ? colors.positive : tone === "negative" ? colors.negative : colors.text;
  const trendColor = trend?.tone === "positive" ? colors.positive : trend?.tone === "negative" ? colors.negative : colors.textSecondary;
  const body = (
    <>
      <Typography variant="overline" color="text.secondary" component="p">{label}</Typography>
      <Typography sx={{ mt: 0.5, fontSize: { xs: "1.2rem", sm: "1.5rem" }, fontWeight: 600, color: valueColor, fontVariantNumeric: "tabular-nums" }} noWrap>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p" noWrap>
        {trend && <Box component="span" sx={{ color: trendColor, fontWeight: 600, mr: 0.75 }}>{trend.label}</Box>}
        {caption}
      </Typography>
    </>
  );
  return (
    <Card sx={{ height: "100%" }}>
      {onClick ? (
        <CardActionArea onClick={onClick} sx={{ p: { xs: 1.75, sm: 2.25 }, height: "100%" }}>{body}</CardActionArea>
      ) : (
        <Box sx={{ p: { xs: 1.75, sm: 2.25 } }}>{body}</Box>
      )}
    </Card>
  );
}

/** Percent change between two amounts, phrased for a stat card. `upIsGood` sets the color. */
export function trendBetween(current: number, previous: number, previousLabel: string, upIsGood: boolean): Trend | undefined {
  if (previous <= 0 && current <= 0) return undefined;
  if (previous <= 0) return { label: "New", tone: "neutral" };
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 0.5) return { label: `Same as ${previousLabel}`, tone: "neutral" };
  const up = change > 0;
  return {
    label: `${up ? "▲" : "▼"} ${Math.abs(change).toFixed(0)}% vs ${previousLabel}`,
    tone: up === upIsGood ? "positive" : "negative",
  };
}

const STATUS = {
  positive: { fg: colors.positive, bg: colors.positiveTint },
  negative: { fg: colors.negative, bg: colors.negativeTint },
  warning: { fg: colors.warning, bg: colors.warningTint },
  info: { fg: colors.navy, bg: colors.navyTint },
  neutral: { fg: colors.textSecondary, bg: "#EEF1F5" },
};

/** Small square status badge with text (never color alone). */
export function StatusBadge({ label, status }: { label: string; status: keyof typeof STATUS }) {
  const s = STATUS[status];
  return <Chip size="small" label={label} sx={{ color: s.fg, bgcolor: s.bg, fontWeight: 600 }} />;
}

/** Centered empty-state message inside a panel. */
export function EmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <Stack alignItems="center" textAlign="center" sx={{ px: 3, py: 6 }}>
      <Typography variant="subtitle1">{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 420 }}>{message}</Typography>
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Stack>
  );
}

/** Signed, colored amount for ledger rows. */
export function Amount({ value, positive }: { value: string; positive: boolean }) {
  return (
    <Typography
      component="span"
      variant="body2"
      sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: positive ? colors.positive : colors.text }}
    >
      {positive ? "+" : "−"}{value}
    </Typography>
  );
}

export const labelOf = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Segmented-control styling for full-width ToggleButtonGroups in forms. */
export const toggleSx = {
  "& .MuiToggleButton-root": { flex: 1, textTransform: "none", fontWeight: 600, py: 0.75 },
  "& .MuiToggleButton-root.Mui-selected, & .MuiToggleButton-root.Mui-selected:hover": {
    bgcolor: "primary.main",
    color: "#fff",
  },
};
