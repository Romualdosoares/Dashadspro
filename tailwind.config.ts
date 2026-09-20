import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./contexts/**/*.{js,ts,jsx,tsx}",
    "./*.tsx",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        neon: {
          DEFAULT: "#39FF14",
          dim: "#2bcc10",
          dark: "#1a8a0a",
        },
      },
      fontFamily: {
        sans: ["Fira Sans", "system-ui", "sans-serif"],
        mono: ["Fira Code", "monospace"],
      },
      boxShadow: {
        neon: "0 0 10px rgba(57, 255, 20, 0.15), 0 0 30px rgba(57, 255, 20, 0.05)",
        "neon-strong": "0 0 15px rgba(57, 255, 20, 0.3), 0 0 40px rgba(57, 255, 20, 0.1)",
      },
    },
  },
  plugins: [],
};

export default config;
