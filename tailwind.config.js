/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0E1625",
        panel: "#151D2E",
        text: "#F4F4F4",
        sub: "#B6C3D1",
        accent: "#00E6D2",
      },
      boxShadow: {
        glow: "0 10px 30px rgba(0,230,210,0.22)",
        depth: "0 6px 18px rgba(0,0,0,0.35)",
        insetCyan: "inset 0 0 0 1px rgba(0,230,210,0.12)",
      },
      borderRadius: {
        lg: "20px",
        xl: "24px",
      }
    },
  },
  plugins: [],
};

