import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: "class", // فعال‌سازی تم دارک با کلاس
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IRANSans"', "ui-sans-serif", "system-ui"],
      },
    },
  },
  plugins: [],
}
export default config
