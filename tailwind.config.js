/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ether: {
          50: "#f5f7ff",
          100: "#e5e8ff",
          200: "#c9d0ff",
          300: "#a5afff",
          400: "#7c83ff",
          500: "#5b5cf0",
          600: "#4a45d9",
          700: "#3a33b5",
          800: "#2c278f",
          900: "#1f1b6e",
        },
        space: {
          500: "#12142b",
          600: "#0d0f23",
          700: "#090a19",
        },
      },
      backgroundImage: {
        "ether-gradient":
          "linear-gradient(135deg, #5b5cf0, #7c83ff 40%, #c9d0ff)",
        "task-gradient":
          "linear-gradient(135deg, #7c83ff, #a5afff, #e5e8ff)",
      },
      boxShadow: {
        glow: "0 0 20px rgba(124,131,255,0.4)",
        soft: "0 4px 12px rgba(0,0,0,0.15)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        pulseSoft: "pulseSoft 3s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.6 },
        },
      },
    },
  },
  plugins: [],
};

