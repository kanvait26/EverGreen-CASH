import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          50: "#eef6f2",
          100: "#d5e8dd",
          200: "#a9d0bb",
          300: "#74b392",
          400: "#3d8f68",
          500: "#1b4d3e",
          600: "#164032",
          700: "#113328",
          800: "#0c241c",
          900: "#071610",
        },
        lime: {
          50: "#f4fbe8",
          100: "#e6f5c8",
          200: "#cde991",
          300: "#b4dc5b",
          400: "#8bc34a",
          500: "#6fa332",
          600: "#568226",
          700: "#3f611c",
          800: "#294012",
          900: "#16230a",
        },
      },
      fontFamily: {
        cairo: ["Cairo", "Tahoma", "sans-serif"],
      },
      minHeight: {
        touch: "56px",
      },
      minWidth: {
        touch: "56px",
      },
    },
  },
  plugins: [],
} satisfies Config;
