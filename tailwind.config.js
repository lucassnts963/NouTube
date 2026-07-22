/** @type {import('tailwindcss').Config} */
// elucas.dev / GuriTube brand tokens: dark base with a single red accent.
// Source: elucas.dev Design System (dark-only, one accent — red for actions,
// titles/numbers and signals only).
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#0C0C0F",
        card: "#16161A",
        popover: "#16161A",
        foreground: "#ECECEF",
        "card-foreground": "#ECECEF",
        "secondary-foreground": "#B4B4BC",
        "muted-foreground": "#87878F",
        primary: {
          DEFAULT: "#E5484D",
          foreground: "#FFFFFF",
        },
        // Brand specials for the signature accent pill / emphasis surfaces
        // (Tailwind opacity modifiers don't apply cleanly to these).
        "accent-tint": "rgba(229,72,77,0.12)",
        "accent-tint-border": "rgba(229,72,77,0.30)",
        "accent-soft": "#F08A8D",
        "accent-hover": "#F25A5F",
      },
      fontFamily: {
        // Loaded via @expo-google-fonts/ibm-plex-* in app/_layout.tsx.
        "mono-brand": ["IBMPlexMono_500Medium", "monospace"],
        sans: ["IBMPlexSans_400Regular"],
        mono: ["IBMPlexMono_500Medium", "monospace"],
      },
    },
  },
  plugins: [],
};
