# ✨ FLOWSTATE UI GUIDELINES  
**Version 1.0 — November 2025**  
**Authors:** Ricardo Caicedo + Manus AI  
**Sources:** Refactoring UI (Wathan & Schoger), Flow by Mihaly Csikszentmihalyi, Systemantics by John Gall  

---

## 🎯 Purpose  
To make *deep work* visually and emotionally rewarding — an interface that feels alive, kinetic, and effortless.  
Flowstate’s visual language should feel like **focus made visible**: glowing gradients, clean geometry, and movement that breathes.

---

## 🎨 Core Aesthetic — “Ethereal Kinetic”  
A blend of **bold gradients**, **soft glows**, and **smooth motion**, inspired by cosmic palettes and meditative calm.

| Element | Visual Direction |
|----------|------------------|
| **Color Mood** | Cool spectral tones — purples, blues, lilacs — balanced by deep void backgrounds. |
| **Typography** | Modern and readable, never ornamental. Visual rhythm through weight, not decoration. |
| **Depth** | Layers of shadow and light suggest calm focus, not noise. |
| **Motion** | Gentle, elastic transitions that mimic breathing. |
| **Interaction** | Immediate, tactile, and reversible — users should feel in control. |

---

## 🪶 Color System  
These colors evoke serenity and momentum — inspired by space, nebulae, and electric gradients.

| Token | Hex | Usage |
|-------|-----|-------|
| `ether-500` | `#5b5cf0` | Primary accent (buttons, highlights) |
| `ether-300` | `#a5afff` | Secondary accent (cards, hover) |
| `space-700` | `#090a19` | Primary background |
| `space-500` | `#12142b` | Surface background |
| `glow` | `rgba(124,131,255,0.4)` | Shadows, outlines, focus rings |

Example gradient:  
```css
background: linear-gradient(135deg, #5b5cf0, #7c83ff 40%, #c9d0ff);
🔠 Typography
Font: Inter, system-ui, sans-serif

Weights: 400 / 500 / 700

Scale:

h1 – 2.25rem / 700

h2 – 1.5rem / 600

body – 1rem / 400

label – 0.875rem / 500

Letter spacing: +1 % for clarity

Color: Use high contrast on dark backgrounds; avoid pure white — prefer ether-100.

🌌 Motion & Animation
Flowstate’s motion should reinforce calm progress — never jarring, never chaotic.

Animation	Behavior	Duration	Notes
Float	Vertical oscillation	6s	Used for icons or accent orbs
PulseSoft	Opacity rhythm	3s	Applied to focus or selected cards
SlideIn	Ease-in-out x/y	250 ms	Column and modal transitions
FadeGrow	Scale + opacity	200 ms	For task creation feedback

CSS keyframes reference (used in Tailwind below):

css
Copy code
@keyframes float {
  0%,100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
@keyframes pulseSoft {
  0%,100% { opacity: 1; }
  50% { opacity: 0.6; }
}
🧱 Design Tokens (Tailwind Extension)
Place these in your tailwind.config.js:

js
Copy code
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ether: {
          50:  "#f5f7ff",
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
        'ether-gradient': 'linear-gradient(135deg, #5b5cf0, #7c83ff 40%, #c9d0ff)',
        'task-gradient': 'linear-gradient(135deg, #7c83ff, #a5afff, #e5e8ff)',
      },
      boxShadow: {
        glow: '0 0 20px rgba(124, 131, 255, 0.4)',
        soft: '0 4px 12px rgba(0, 0, 0, 0.15)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        pulseSoft: 'pulseSoft 3s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.6 },
        },
      },
    },
  },
  plugins: [],
}
🧩 Component Examples
Column Header
jsx
Copy code
<h2 className="text-ether-300 font-bold text-lg tracking-wide drop-shadow-glow">
  TO-DO
</h2>
Column Container
jsx
Copy code
<div className="bg-space-600 bg-ether-gradient p-4 rounded-2xl shadow-soft">
  {/* Tasks here */}
</div>
Task Card
jsx
Copy code
<div className="p-4 rounded-xl bg-space-500 shadow-glow hover:animate-pulseSoft transition">
  <h3 className="font-medium text-ether-200">Design homepage layout</h3>
</div>
🪄 Interaction Principles
Every user action should produce visual feedback (motion, color, light).

Use depth to emphasize focus.

Use gradients to express progress.

Avoid clutter: whitespace is your ally.

🧭 Design Pillars
Clarity over cleverness – every color and motion communicates function.

Fluid motion – actions should feel continuous.

Energy with restraint – gradients glow, not scream.

Structure over spectacle – systems first, aesthetics second.

Flow first – no UI element should interrupt momentum.

Flowstate is not static — it breathes.
Its visuals must move at the same rhythm as the user’s focus.
