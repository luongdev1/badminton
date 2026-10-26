import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17211d",
        muted: "#75817b",
        line: "#e8eeea",
        brand: "#16794a",
        "brand-dark": "#105e39",
        mint: "#e9f5ee",
      },
      boxShadow: {
        card: "0 12px 30px rgba(24, 56, 39, 0.05)",
      },
      fontFamily: {
        sans: ["Arial", "Helvetica", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
