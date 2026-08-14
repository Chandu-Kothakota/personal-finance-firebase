import { alpha, createTheme } from "@mui/material/styles";

const navy = "#0B1F33";
const teal = "#0F766E";
const emerald = "#16A34A";
const amber = "#D97706";
const red = "#DC2626";

export const appTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: teal, dark: "#0B5D56", light: "#DFF7F3", contrastText: "#FFFFFF" },
    secondary: { main: navy, contrastText: "#FFFFFF" },
    success: { main: emerald },
    warning: { main: amber },
    error: { main: red },
    background: { default: "#F3F6F9", paper: "#FFFFFF" },
    text: { primary: "#17202A", secondary: "#667085" },
    divider: "#E4E7EC",
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h3: { fontWeight: 800, letterSpacing: "-0.035em" },
    h4: { fontWeight: 800, letterSpacing: "-0.028em" },
    h5: { fontWeight: 800, letterSpacing: "-0.02em" },
    h6: { fontWeight: 750, letterSpacing: "-0.012em" },
    subtitle1: { fontWeight: 650 },
    button: { textTransform: "none", fontWeight: 700, letterSpacing: 0 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: "#F3F6F9" },
        "*": { boxSizing: "border-box" },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: "1px solid #E6EAF0",
          boxShadow: "0 1px 2px rgba(16,24,40,0.03), 0 10px 30px rgba(16,24,40,0.04)",
          backgroundImage: "none",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 14 },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 10, minHeight: 40, paddingInline: 16 },
        containedPrimary: {
          boxShadow: `0 4px 12px ${alpha(teal, 0.18)}`,
          "&:hover": { boxShadow: `0 6px 16px ${alpha(teal, 0.24)}` },
        },
      },
    },
    MuiTextField: {
      defaultProps: { size: "small" },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: "#FFFFFF",
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#98A2B3" },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 18, border: "1px solid #E6EAF0" },
      },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 650 } },
    },
    MuiTooltip: {
      defaultProps: { arrow: true },
    },
  },
});
