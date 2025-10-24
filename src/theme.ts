import { extendTheme, type ThemeConfig } from "@chakra-ui/react";
import { mode } from "@chakra-ui/theme-tools";

const config: ThemeConfig = {
  initialColorMode: "dark",
  useSystemColorMode: false,
};

const theme = extendTheme({
  config,
  styles: {
    global: (props) => ({
      body: {
        bg: mode("#f8f9fb", "#0c0c0f")(props),
        color: mode("#111112", "#e5e7eb")(props),
      },
    }),
  },
  colors: {
    brand: {
      50: "#eef2ff",
      100: "#e0e7ff",
      500: "#6366f1",
      600: "#4f46e5",
      700: "#4338ca",
    },
    success: {
      400: "#22c55e",
      500: "#16a34a",
      600: "#15803d",
    },
    danger: {
      400: "#f87171",
      500: "#ef4444",
      600: "#dc2626",
    },
    neutral: {
      50: "#f8f9fb",
      100: "#f1f3f5",
      200: "#e3e5e8",
      700: "#2a2a2e",
      800: "#1c1c1f",
      900: "#0f0f12",
    },
  },
  fonts: {
    heading: `'Geist Sans', 'Inter', sans-serif`,
    body: `'Inter', 'Geist Sans', sans-serif`,
  },
  radii: {
    sm: "6px",
    md: "10px",
    lg: "16px",
  },
  shadows: {
    sm: "0 1px 3px rgba(0,0,0,0.12)",
    md: mode(
      "0 4px 10px rgba(0,0,0,0.08)",
      "0 4px 16px rgba(0,0,0,0.4)"
    ),
    xl: mode(
      "0 8px 24px rgba(0,0,0,0.12)",
      "0 8px 32px rgba(0,0,0,0.45)"
    ),
  },
  semanticTokens: {
    colors: {
      bg: {
        default: "neutral.50",
        _dark: "neutral.900",
      },
      surface: {
        default: "neutral.100",
        _dark: "neutral.800",
      },
      border: {
        default: "neutral.200",
        _dark: "neutral.700",
      },
      text: {
        default: "neutral.800",
        _dark: "neutral.50",
      },
      muted: {
        default: "neutral.600",
        _dark: "neutral.400",
      },
      accent: {
        default: "brand.600",
        _dark: "brand.500",
      },
      success: {
        default: "success.500",
        _dark: "success.400",
      },
      danger: {
        default: "danger.500",
        _dark: "danger.400",
      },
    },
  },
  components: {
    Card: {
      baseStyle: (props) => ({
        bg: mode("neutral.100", "neutral.800")(props),
        border: "1px solid",
        borderColor: mode("neutral.200", "neutral.700")(props),
        borderRadius: "lg",
        boxShadow: mode(
          "0 2px 6px rgba(0,0,0,0.05)",
          "0 4px 12px rgba(0,0,0,0.35)"
        )(props),
      }),
    },
    Button: {
      variants: {
        solid: (props) => ({
          bg: mode("brand.600", "brand.500")(props),
          color: "white",
          _hover: {
            bg: mode("brand.700", "brand.600")(props),
          },
        }),
        ghost: (props) => ({
          color: mode("brand.600", "brand.400")(props),
          _hover: {
            bg: mode("neutral.100", "neutral.800")(props),
          },
        }),
      },
    },
  },
});

export default theme;