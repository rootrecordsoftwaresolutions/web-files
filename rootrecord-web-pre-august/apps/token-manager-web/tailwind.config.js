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
        /* Core palette aligned with Weather Manager web. */
        bg: {
          base: "#060d14",
          surface: "#0c1824",
          elevated: "#122a3d",
          raised: "#1a3a52",
        },
        ink: {
          primary: "#e8f4ef",
          secondary: "rgba(232,244,239,0.55)",
          tertiary: "rgba(232,244,239,0.38)",
        },
        phos: {
          DEFAULT: "#5ee9b0",
          dim: "#3db88c",
          deep: "#0d2820",
          glow: "rgba(94,233,176,0.18)",
        },
        magenta: {
          DEFAULT: "#94a3b8",
          dim: "#64748b",
          glow: "rgba(148,163,184,0.18)",
        },
        amber: { DEFAULT: "#FFB020" },
        rose: { DEFAULT: "#FF5577" },
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
      },
      boxShadow: {
        card: "0 2px 10px rgba(0,0,0,0.35)",
        phos: "0 0 0 1px rgba(94,233,176,0.25), 0 6px 24px rgba(94,233,176,0.12)",
      },
    },
  },
  plugins: [],
};
