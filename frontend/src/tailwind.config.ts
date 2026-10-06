import type { Config } from "tailwindcss"

/** DEPRECATED — DO NOT USE. Live Tailwind config is frontend/tailwind.config.ts. */

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
