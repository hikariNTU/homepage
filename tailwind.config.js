/* eslint-disable no-undef */

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "selector",
  theme: {
    extend: {
      colors: {
        main: {
          100: "rgb(249, 246, 242)",
          200: "#d48cb4",
          800: "rgb(138, 68, 107)",
          900: "#20244A",
        },
      },
      screens: {
        xs: "568px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
