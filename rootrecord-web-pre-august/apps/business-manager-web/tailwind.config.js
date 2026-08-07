module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        heading: ["Outfit", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["Outfit", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        /* Aligned with Weather Manager web (`Web/apps/weather-manager-web/tailwind.config.js`). */
        bg: { base: "#060d14", surface: "#0c1824", elevated: "#122a3d" },
        ink: {
          primary: "#e8f4ef",
          secondary: "rgba(232,244,239,0.55)",
          tertiary: "rgba(232,244,239,0.38)",
        },
        brand: {
          DEFAULT: "#5ee9b0",
          light: "#7ef0c0",
          dark: "#4ad198",
          subtle: "rgba(94,233,176,0.18)",
        },
        income: "#10B981",
        expense: "#F43F5E",
        warn: "#F59E0B",
        info: "#3B82F6",
      },
      borderColor: {
        subtle: "rgba(255,255,255,0.06)",
        strong: "rgba(255,255,255,0.12)",
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
      },
      boxShadow: {
        card: "0 2px 8px rgba(0,0,0,0.25)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
