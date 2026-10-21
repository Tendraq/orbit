import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Orbit violet
        brand: {
          50: "#f4f2ff",
          100: "#e9e5ff",
          200: "#d3ccff",
          300: "#b5a9ff",
          400: "#9580fb",
          500: "#7a5af6",
          600: "#6a3eea",
          700: "#5a2fd0",
          800: "#4a28a8",
          900: "#3b2186",
        },
      },
      fontFamily: {
        sans: [
          "Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI",
          "Roboto", "Helvetica Neue", "Arial", "sans-serif",
        ],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(16,24,40,.04), 0 6px 18px -6px rgba(16,24,40,.08)",
        lift: "0 2px 4px rgba(16,24,40,.05), 0 16px 32px -12px rgba(16,24,40,.16)",
        glow: "0 18px 50px -14px rgba(106,62,234,.55)",
      },
      keyframes: {
        fadeUp: { from: { opacity: "0", transform: "translateY(10px)" }, to: { opacity: "1", transform: "none" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
      },
      animation: {
        "fade-up": "fadeUp .5s ease-out both",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
