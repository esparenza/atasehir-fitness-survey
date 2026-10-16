import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#c6ff3d",
          dark: "#9bd11f",
        },
        ink: {
          950: "#07080b",
          900: "#0d0f14",
          800: "#14171e",
          700: "#1c2029",
          600: "#2a2f3b",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-outfit)", "system-ui", "sans-serif"],
      },
      keyframes: {
        slideIn: {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pulseRing: {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(239,68,68,.5)" },
          "50%": { boxShadow: "0 0 0 10px rgba(239,68,68,0)" },
        },
      },
      animation: {
        slideIn: "slideIn .3s cubic-bezier(.22,1,.36,1)",
        fadeUp: "fadeUp .4s ease-out both",
        pulseRing: "pulseRing 2s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
