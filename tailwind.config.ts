import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f7f8fb",
          100: "#eef0f6",
          200: "#dce0ea",
          300: "#b9c1d4",
          400: "#8894b3",
          500: "#607095",
          600: "#4a5878",
          700: "#3a4560",
          800: "#252d42",
          900: "#161c2c",
          950: "#0d111c"
        },
        brand: {
          50: "#eef7f5",
          100: "#d6ede8",
          200: "#aedbd3",
          300: "#7cc2b8",
          400: "#4aa399",
          500: "#2f8880",
          600: "#226d68",
          700: "#1e5754",
          800: "#1b4544",
          900: "#183a39"
        },
        accent: {
          50: "#fff6ed",
          100: "#ffe9d4",
          200: "#ffcfA8",
          300: "#ffad71",
          400: "#fd7f38",
          500: "#fb5f12",
          600: "#ec4408",
          700: "#c33109",
          800: "#9b2910",
          900: "#7d2510"
        },
        danger: {
          50: "#fef2f2",
          100: "#fee2e2",
          500: "#dc2626",
          600: "#b91c1c",
          700: "#991b1b"
        }
      },
      fontFamily: {
        sans: [
          "Atkinson Hyperlegible",
          "Segoe UI",
          "system-ui",
          "-apple-system",
          "sans-serif"
        ]
      },
      boxShadow: {
        card: "0 1px 2px rgba(22,28,44,.05), 0 8px 24px -12px rgba(22,28,44,.18)",
        float: "0 12px 40px -12px rgba(22,28,44,.35)"
      },
      borderRadius: {
        xl2: "1.25rem"
      },
      minHeight: {
        tap: "44px"
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "fade-in": "fade-in .25s ease-out both"
      }
    }
  },
  plugins: []
};

export default config;
