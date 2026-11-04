# @agentable-ui/motion

Spring-physics generative UI for Agentable, built on [react-spring](https://react-spring.dev). One import gives every `@agentable-ui/ui` component a spring entrance, and adds components that are hard to get from a plain catalog: device frames, flashcards, quizzes, lessons, activity rings, ranked bar races, holographic cards, carousels and more. Models write them in a line or two of Agentable Lang.

## Install

```bash
npm install @agentable-ui/motion @agentable-ui/genui @agentable-ui/ui @agentable-ui/react @agentable-ui/core
```

## Use it

Swap `uiCatalog` for `motionCatalog` and load the stylesheet after the ui one. Nothing else changes: same `Renderer`, same `AgentSurface`, same programs.

```tsx
import { Renderer } from "@agentable-ui/genui";
import { motionCatalog } from "@agentable-ui/motion";
import "@agentable-ui/ui/styles.css";
import "@agentable-ui/motion/styles.css";

const program = `root = Device("phone", children: [deck])
deck = Flashcards([{front: "Hola", back: "Hello"}, {front: "Gracias", back: "Thank you"}], title: "Spanish")`;

export default function Study() {
  return <Renderer components={motionCatalog} response={program} />;
}
```

Use the same catalog to build the model's prompt, so it knows the new components: `createLibrary(motionCatalog).prompt()`.

## What moves

- **Every node springs in once, on mount.** Nodes that mount together (a first render, or what one streamed line adds) cascade. Nodes already on screen never re-animate, so streaming stays calm. At rest the wrapper has no transform, so `position: fixed` content inside still works.
- **Stat** counts up to its value, keeping its formatting (`$48.2k`, `12,480`, `1.8s`). **Progress** springs to its value.
- **Reduced motion** is respected everywhere: values jump to where they land, idle loops stop and confetti is skipped.

## Components

| Component | What it's for |
| --- | --- |
| `Headline(text, sub?, eyebrow?, highlight?, size?)` | Hero line that rises in word by word; `highlight` words get the accent gradient. |
| `Device(kind?, url?, caption?, src?, finish?, float?, tilt?, time?, children)` | Phone, tablet, laptop, browser or watch frame with live UI (or a screenshot) on its screen. Reveals in 3D, tilts toward the pointer. |
| `Flashcards(cards, title?)` · events `grade`, `finish` | Swipeable study deck. Tap or Space flips; swipe or → when you knew it, ← to see it again. Missed cards come back. |
| `Quiz(questions, title?)` · events `answer`, `finish` | Multiple choice, one at a time. Wrong picks shake, explanations spring open, streaks count, score ring at the end. |
| `Lesson(steps, title?)` · events `step`, `complete` | Step-by-step explainer with a progress rail. |
| `Rings(rings, title?)` | Concentric activity rings; values past `max` lap the ring. |
| `Ranking(items, title?, limit?, ascending?)` · event `select` | Ranked bars. Bind to `$data.*` and rows spring to their new places when it changes. |
| `HoloCard(title, subtitle?, emblem?, stats?, tags?, footer?, image?, foil?)` | Collectible card with tilt, foil and glare. |
| `Carousel(title?, labels?, autoplay?, children)` · event `change` | Swipeable slides of any nodes. |
| `Accordion(items, multiple?, open?)` · event `toggle` | Sections that spring open. |
| `Segmented(options, value?, label?)` · event `change` | Segmented control with a sliding pill; bind `value` to `$ui.*`. |
| `Compare(before, after, beforeLabel?, afterLabel?)` | Before/after image slider. |
| `Terminal(lines, title?)` | Types `$ ` commands out and prints their output. |

`Flashcards` and `Carousel` also take an `agent` prop (like other Agentable components) that registers a tool, so a browser agent can flip, grade or change slides.

## Building blocks

`Enter`, `withEnter`, `springCatalog(catalog)` (spring entrances for your own catalog), `Ticker`, `Ring`, `Collapse`, `Confetti`, `useTilt`, `useInView`, `useReducedMotion` and the shared `springs` presets are exported too.

## Theming

Everything reads the `--ag-*` tokens from `@agentable-ui/ui/styles.css`, plus `--ag-motion-grad` (accent gradient) and `--ag-motion-radius`. Styles target `data-agentable-*` attributes, so you can replace the file.
