import type { ComponentType } from "react";
import type { JSONSchema } from "@agentable-ui/core";
import { uiCatalog, type CatalogEntry } from "@agentable-ui/ui";
import { SpringProgress, SpringStat, withEnter, type EnterStyle } from "./enter.js";
import { Device } from "./Device.js";
import { Flashcards } from "./Flashcards.js";
import { Quiz } from "./Quiz.js";
import { Rings } from "./Rings.js";
import { Accordion } from "./Accordion.js";
import { Carousel } from "./Carousel.js";
import { Compare } from "./Compare.js";
import { HoloCard } from "./HoloCard.js";
import { Headline } from "./Headline.js";
import { Segmented } from "./Segmented.js";
import { Ranking } from "./Ranking.js";
import { Terminal } from "./Terminal.js";
import { Lesson } from "./Lesson.js";
import { Animate, ENTER_PRESETS, INTERACT_PRESETS, LOOP_PRESETS } from "./Animate.js";
import { Scene } from "./Scene.js";
import { Orbit } from "./Orbit.js";
import { Layers } from "./Layers.js";

type Entry = CatalogEntry<never>;
type AnyCatalog = Record<string, { component: ComponentType<never>; description: string; props: unknown; childrenProp?: string; events?: Record<string, string> }>;

/** Layout containers stay still; their children do the entering. */
const STILL = new Set(["Stack", "Grid", "StatGroup", "Divider"]);
const VARIANT: Record<string, EnterStyle> = { Badge: "pop", Button: "pop", Callout: "slide", Image: "fade" };

/**
 * Give every component in a catalog a spring entrance. Nodes that mount
 * together (a first render, or one streamed line) cascade in; nodes already
 * on screen never re-animate. Schemas, events and children are unchanged.
 */
export function springCatalog<C extends AnyCatalog>(catalog: C, options: { still?: Iterable<string> } = {}): C {
  const still = new Set([...STILL, ...(options.still ?? [])]);
  const out: Record<string, unknown> = {};
  for (const [name, entry] of Object.entries(catalog)) {
    out[name] = still.has(name) ? entry : { ...entry, component: withEnter(entry.component as ComponentType<object>, VARIANT[name] ?? "rise") };
  }
  return out as C;
}

const str = (description?: string): JSONSchema => (description ? { type: "string", description } : { type: "string" });
const strs: JSONSchema = { type: "array", items: { type: "string" } };

/** The new spring-physics components, as catalog entries. */
export const motionComponents = {
  Headline: {
    component: Headline,
    description: "Hero headline that rises in word by word; highlight paints chosen words with a gradient.",
    props: { type: "object", properties: { text: str(), sub: str("Supporting line"), eyebrow: str("Small label above"), highlight: { ...strs, description: "Words to highlight" }, size: { type: "string", enum: ["md", "lg", "xl"] } }, required: ["text"] },
  },
  Device: {
    component: Device,
    description: "A pretty phone/tablet/laptop/browser/watch frame with children (or a screenshot src) on its screen; 3D tilt on hover. Use to show a mockup or app preview.",
    props: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["phone", "tablet", "laptop", "browser", "watch"] },
        url: str("Address bar (browser) or app title"),
        caption: str(),
        src: str("https screenshot instead of children"),
        finish: { type: "string", enum: ["midnight", "silver", "starlight", "sierra", "rose"] },
        float: { type: "boolean", description: "Bob gently while idle" },
        tilt: { type: "boolean" },
        time: str("Status bar time"),
      },
    },
    childrenProp: "children",
  },
  Flashcards: {
    component: Flashcards,
    description: "Swipeable study deck: tap flips, swipe right = knew it, left = again (missed cards come back). Use for learning/memorizing.",
    props: { type: "object", properties: { cards: { type: "array", items: { type: "object", properties: { front: str(), back: str(), hint: str() }, required: ["front", "back"] } }, title: str() }, required: ["cards"] },
    events: { grade: "onGrade", finish: "onFinish" },
  },
  Quiz: {
    component: Quiz,
    description: "Multiple-choice quiz, one question at a time, with explanations, streaks and a score ring. answer is the 0-based correct choice.",
    props: {
      type: "object",
      properties: {
        questions: { type: "array", items: { type: "object", properties: { question: str(), choices: strs, answer: { type: "integer" }, explain: str() }, required: ["question", "choices", "answer"] } },
        title: str(),
      },
      required: ["questions"],
    },
    events: { answer: "onAnswer", finish: "onFinish" },
  },
  Lesson: {
    component: Lesson,
    description: "Step-by-step explainer: one step at a time with progress; each step {title, body, code?, emoji?}.",
    props: { type: "object", properties: { steps: { type: "array", items: { type: "object", properties: { title: str(), body: str(), code: str(), emoji: str() }, required: ["title", "body"] } }, title: str() }, required: ["steps"] },
    events: { step: "onStep", complete: "onComplete" },
  },
  Rings: {
    component: Rings,
    description: "Concentric activity rings (up to 5) that spring closed; values over max lap the ring. Goals, habits, fitness.",
    props: { type: "object", properties: { rings: { type: "array", items: { type: "object", properties: { label: str(), value: { type: "number" }, max: { type: "number" }, detail: str("e.g. 420/600 kcal") }, required: ["label", "value"] } }, title: str() }, required: ["rings"] },
  },
  Ranking: {
    component: Ranking,
    description: "Ranked bars that re-sort with springs when values change (bar-chart race). Bind items to data.* to watch it move.",
    props: {
      type: "object",
      properties: {
        items: { type: "array", items: { type: "object", properties: { label: str(), value: { type: "number" }, icon: str("Emoji"), display: str("Formatted value"), id: { type: ["string", "number"] } }, required: ["label", "value"] } },
        title: str(),
        limit: { type: "integer" },
        ascending: { type: "boolean" },
      },
      required: ["items"],
    },
    events: { select: "onSelect" },
  },
  HoloCard: {
    component: HoloCard,
    description: "Collectible holographic card with tilt and foil shine. Achievements, profiles, shareable summaries.",
    props: {
      type: "object",
      properties: {
        title: str(),
        subtitle: str(),
        emblem: str("Big emoji or glyph"),
        stats: { type: "array", items: { type: "object", properties: { label: str(), value: { type: ["string", "number"] } }, required: ["label", "value"] } },
        tags: strs,
        footer: str(),
        image: str("https URL"),
        foil: { type: "string", enum: ["silver", "gold", "aurora", "rainbow"] },
      },
      required: ["title"],
    },
  },
  Carousel: {
    component: Carousel,
    description: "Swipeable slides; each child is one slide. labels name the slides.",
    props: { type: "object", properties: { title: str(), labels: strs, autoplay: { type: "number", description: "Seconds per slide" } } },
    childrenProp: "children",
    events: { change: "onChange" },
  },
  Accordion: {
    component: Accordion,
    description: "Expandable sections that spring open. FAQs, details on demand.",
    props: { type: "object", properties: { items: { type: "array", items: { type: "object", properties: { title: str(), body: str() }, required: ["title", "body"] } }, multiple: { type: "boolean" }, open: { type: "integer", description: "Index open at first" } }, required: ["items"] },
    events: { toggle: "onToggle" },
  },
  Segmented: {
    component: Segmented,
    description: "Segmented control with a sliding pill. Bind value to ui.* and set it on change; pair with when to switch views.",
    props: { type: "object", properties: { options: { type: "array", items: { type: ["string", "object"] } }, value: str(), label: str() }, required: ["options"] },
    events: { change: "onChange" },
  },
  Compare: {
    component: Compare,
    description: "Before/after image slider (drag to reveal).",
    props: { type: "object", properties: { before: str("https URL"), after: str("https URL"), beforeLabel: str(), afterLabel: str(), alt: str() }, required: ["before", "after"] },
  },
  Terminal: {
    component: Terminal,
    description: 'Terminal window that types commands out. Lines starting "$ " are commands; others are output.',
    props: { type: "object", properties: { lines: strs, title: str() }, required: ["lines"] },
  },
  Animate: {
    component: Animate,
    description: "Wrap any nodes in motion: an entrance on scroll (rise, pop, flip, unfold…), a gentle loop (float, breathe, sway, spin…) or a pointer response (tilt, lift, magnet). Use one per idea, not on everything.",
    props: {
      type: "object",
      properties: {
        preset: { type: "string", enum: [...ENTER_PRESETS, ...LOOP_PRESETS, ...INTERACT_PRESETS] },
        delay: { type: "number", description: "ms" },
        speed: { type: "number", description: "0.25-3" },
        amount: { type: "number", description: "Loop strength 0.25-3" },
      },
    },
    childrenProp: "children",
  },
  Scene: {
    component: Scene,
    description:
      "Your canvas for illustrations and explainers in 2D/3D: place shapes, glyphs, text, images and lines by x/y (0-100%), give each a depth z (-100..100, parallax) and a motion (float, bob, spin, pulse, orbit around x/y, drift, sway). tilt makes the stage 3D. Colors: theme tokens (accent, ink, muted, line, success, warning, danger, s1-s5) or hex. Draw solar systems, atoms, flows, maps, hero art.",
    props: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["shape", "text", "glyph", "image", "line"] },
              shape: { type: "string", enum: ["circle", "square", "ring", "pill", "triangle", "diamond"] },
              x: { type: "number" },
              y: { type: "number" },
              x2: { type: "number" },
              y2: { type: "number" },
              size: { type: "number" },
              w: { type: "number" },
              h: { type: "number" },
              z: { type: "number" },
              rotate: { type: "number" },
              color: str(),
              opacity: { type: "number" },
              text: str(),
              src: str(),
              weight: { type: "number" },
              motion: { type: "string", enum: ["none", "float", "bob", "spin", "pulse", "orbit", "drift", "sway"] },
              speed: { type: "number" },
              delay: { type: "number" },
              radius: { type: "number" },
            },
            required: ["x", "y"],
          },
        },
        height: { type: "number" },
        background: { type: "string", enum: ["none", "panel", "ink", "grid", "dots"] },
        tilt: { type: "boolean" },
        label: str("What it shows, for screen readers"),
        caption: str(),
      },
      required: ["items"],
    },
  },
  Orbit: {
    component: Orbit,
    description: "Children as cards on a 3D ring; drag to spin, click to bring forward. Options, products, people, moments.",
    props: { type: "object", properties: { width: { type: "number" }, autoplay: { type: "number", description: "Seconds per card; 0 off" }, tilt: { type: "number" }, labels: strs } },
    childrenProp: "children",
    events: { change: "onChange" },
  },
  Layers: {
    component: Layers,
    description: "Exploded 3D stack of planes (top first) that pulls apart on hover; pick one to read its detail. Architectures, protocols, anything layered.",
    props: { type: "object", properties: { layers: { type: "array", items: { type: "object", properties: { title: str(), detail: str(), tag: str(), color: str() }, required: ["title"] } }, title: str() }, required: ["layers"] },
    events: { select: "onSelect" },
  },
} satisfies Record<string, Entry>;

/** New components that bring their own entrance. */
const OWN_ENTRANCE = ["Headline", "Device", "Animate", "Scene", "Layers"];

/**
 * The full motion catalog: every @agentable-ui/ui component with spring
 * entrances (Stat counts up, Progress springs), plus the motion components.
 * Pass to <Renderer components={motionCatalog}> or createLibrary(motionCatalog).
 */
export const motionCatalog = {
  ...springCatalog({
    ...uiCatalog,
    Stat: { ...uiCatalog.Stat, component: SpringStat },
    Progress: { ...uiCatalog.Progress, component: SpringProgress },
  }),
  ...springCatalog(motionComponents, { still: OWN_ENTRANCE }),
};
