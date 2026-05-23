/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        orange: {
          DEFAULT: "#F37002",
          soft: "#FFF6EF",
        },
        dark: {
          DEFAULT: "#181818",
          2: "#242424",
          3: "#2E2E2E",
        },
        grey: {
          DEFAULT: "#6B6B6B",
          2: "#A0A0A0",
          3: "#E5E5E5",
        },
        light: "#FAFAF7",
        green: {
          DEFAULT: "#1F8A4C",
          soft: "#E8F5EE",
        },
        amber: {
          DEFAULT: "#C77700",
          soft: "#FFF3DD",
        },
        red: {
          DEFAULT: "#B43A2D",
          soft: "#FBE9E6",
        },
        border: "#E8E6E1",
      },
      fontFamily: {
        serif: ["Fraunces", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      screens: {
        mobile: { max: "820px" },
      },
      maxWidth: {
        app: "1180px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
