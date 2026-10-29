/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        paper: "#FAF9F6",
        surface: "#FFFFFF",
        ink: {
          DEFAULT: "#18181B",
          2: "#52525B",
          3: "#A1A1AA",
          4: "#D4D4D8",
        },
        fill: "#F4F4F5",
        accent: "#F97316",
      },
    },
  },
  plugins: [],
};
