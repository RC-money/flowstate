# 🌌 **Flowstate**

> _"Your tasks, in motion."_

🌀 Flowstate – Stable Build v1.0.0 (flowstate-stable-v1)
...
Release Date: November 10, 2025
Commit: 5f253db
Branch: flowstate-stable-v1

✨ Overview

This is the first stable visual build of Flowstate — a reactive task board designed to embody the flow experience: clean, kinetic, and deeply satisfying to use.
This version focuses on the core feel — motion, glow, and responsive polish — before deeper functionality layers are added.

🎨 Features
🌊 Dynamic Background

FlowBackground reacts smoothly to mouse movement with ethereal glowing orbs.

Built using Framer Motion with spring physics for lifelike fluidity.

Gradient layers combine deep navy (#0F172A → #020617) with animated light orbs.

💡 Interactive Cards

Cards pop out and glow when hovered, with soft elevation and energy pulses.

Hover animations are instant and smooth — no lag or flicker.

Glow colors synchronize with their column’s category tone:

TO-DO → Cyan glow

IN PROGRESS → Indigo glow

DONE → Emerald glow

🧩 Modal System

Clicking a task opens a modal with dynamic action buttons:

TO-DO: “Move to In Progress”

IN PROGRESS: “Move to To-Do” or “Mark Complete” (with signature ether color glow)

DONE: “Move to To-Do” or “Move to In Progress”

Smooth pop-in and fade-out motion transitions for the modal window.

📦 Drag & Drop

Tasks are draggable across columns via @dnd-kit/core.

Columns highlight subtly when hovered during a drag.

Position transitions are animated for seamless visual continuity.

⚙️ System Polish

Background layers (GlowOverlay, NoiseOverlay) reintroduced with proper z-index layering.

Shadows, blurs, and border-opacity tuned for visual depth.

Tailwind CSS architecture maintained for full responsiveness.

🚀 Tech Stack
Layer	Tech
Framework	React + TypeScript
Animation	Framer Motion
Drag & Drop	@dnd-kit/core
Styling	Tailwind CSS
Build	Vite
🧱 Future Goals

 Add persistent local storage for tasks

 Add user authentication (Firebase or Supabase)

 Introduce task categories and due dates

 Enable dark/light adaptive theming

 Deploy via Vercel or GitHub Pages

💬 Developer Notes

This version represents a milestone of visual fidelity — all motion, glow, and UI feel are now in sync.
Next phases should focus on state persistence and data structure expansion, keeping this branch as your “feel baseline.”
