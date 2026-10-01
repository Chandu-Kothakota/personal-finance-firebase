import { createTheme } from "@mui/material/styles";

// Classic, restrained palette: navy on white, slate neutrals, muted semantic colors.
export const colors = {
  navy: "#1B365D",
  navyDark: "#12263F",
  navyTint: "#EAF0F7",
  canvas: "#F4F6F9",
  surface: "#FFFFFF",
  subtle: "#F8FAFC",
  border: "#DDE2EA",
  borderStrong: "#C5CDD8",
  text: "#1A2433",
  textSecondary: "#5B6676",
  textMuted: "#8A94A3",
  positive: "#1E7B4F",
  positiveTint: "#E9F5EE",
  negative: "#B42318",
  negativeTint: "#FCEDEB",
  warning: "#B54708",
  warningTint: "#FEF3E7",
  // Chart series (validated for color-vision deficiency and contrast).
  seriesBalance: "#2B5C9E",
  seriesLiability: "#D9772B",
};

export const appTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: colors.navy, dark: colors.navyDark, light: colors.navyTint, contrastText: "#FFFFFF" },
    secondary: { main: colors.textSecondary, contrastText: "#FFFFFF" },
    success: { main: colors.positive },
    warning: { main: colors.warning },
    error: { main: colors.negative },
    info: { main: colors.seriesBalance },
    background: { default: colors.canvas, paper: colors.surface },
    text: { primary: colors.text, secondary: colors.textSecondary, disabled: colors.textMuted },
    divider: colors.border,
  },
  shape: { borderRadius: 6 },
  typography: {
    fontFamily: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    fontSize: 14,
    h4: { fontSize: "1.5rem", fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.3 },
    h5: { fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.01em" },
    h6: { fontSize: "1rem", fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontSize: "0.8125rem", fontWeight: 600 },
    body2: { fontSize: "0.875rem" },
    caption: { fontSize: "0.75rem" },
    overline: { fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.06em", lineHeight: 1.6 },
    button: { textTransform: "none", fontWeight: 600, letterSpacing: 0 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: colors.canvas,
          WebkitFontSmoothing: "antialiased",
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { backgroundImage: "none" } },
    },
    MuiCard: {
      defaultProps: { variant: "outlined" },
      styleOverrides: { root: { borderColor: colors.border } },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 6, minHeight: 36, paddingInline: 14 },
        outlined: { borderColor: colors.borderStrong, color: colors.text, "&:hover": { borderColor: colors.textMuted, backgroundColor: colors.subtle } },
        sizeSmall: { minHeight: 30 },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { borderRadius: 6 } },
    },
    MuiTextField: { defaultProps: { size: "small" } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: colors.surface,
          "& .MuiOutlinedInput-notchedOutline": { borderColor: colors.borderStrong },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: colors.textMuted },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 4, fontWeight: 500, height: 22, fontSize: "0.75rem" },
        label: { paddingInline: 8 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: colors.border, paddingTop: 10, paddingBottom: 10 },
        head: {
          backgroundColor: colors.subtle,
          color: colors.textSecondary,
          fontSize: "0.75rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          whiteSpace: "nowrap",
        },
      },
    },
    MuiTableRow: {
      styleOverrides: { root: { "&.MuiTableRow-hover:hover": { backgroundColor: colors.subtle } } },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 8, border: `1px solid ${colors.border}` } },
    },
    MuiDialogTitle: {
      styleOverrides: { root: { fontSize: "1.0625rem", fontWeight: 600 } },
    },
    MuiAlert: {
      styleOverrides: { root: { borderRadius: 6 } },
    },
    MuiTooltip: {
      defaultProps: { arrow: true },
      styleOverrides: { tooltip: { backgroundColor: colors.text, fontSize: "0.75rem" }, arrow: { color: colors.text } },
    },
  },
});
