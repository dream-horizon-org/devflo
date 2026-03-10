/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          0: "#0d1117",
          1: "#161b22",
          2: "#1c2128",
          3: "#21262d",
          border: "#30363d",
        },
        accent: {
          blue: "#58a6ff",
          green: "#3fb950",
          yellow: "#d29922",
          red: "#f85149",
          purple: "#bc8cff",
        },
        text: {
          primary: "#e6edf3",
          secondary: "#8b949e",
          muted: "#484f58",
        },
      },
      animation: {
        "pulse-slow": "pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};
