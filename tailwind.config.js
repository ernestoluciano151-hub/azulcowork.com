/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B1220",
        ink2: "#101a2e",
        azul: {
          DEFAULT: "#2F6FED",
          dim: "#1E4FB8",
          glow: "#5C8FFF"
        },
        gold: {
          DEFAULT: "#D4AF37",
          soft: "#E8CD6E"
        },
        mist: "#94A3B8",
        paper: "#F5F7FA"
      },
      fontFamily: {
        display: ["var(--font-sora)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"]
      },
      backgroundImage: {
        "mesh": "radial-gradient(at 20% 0%, rgba(47,111,237,0.35) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(212,175,55,0.18) 0px, transparent 50%), radial-gradient(at 50% 100%, rgba(47,111,237,0.12) 0px, transparent 50%)"
      },
      boxShadow: {
        glow: "0 0 60px rgba(47,111,237,0.25)"
      }
    }
  },
  plugins: []
};
