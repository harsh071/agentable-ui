import { useEffect, useMemo, useRef, useState } from "react";
import { Renderer } from "@agentable-ui/genui";
import { createLibrary } from "@agentable-ui/lang";
import { Device, Headline, motionCatalog } from "@agentable-ui/motion";

const library = createLibrary(motionCatalog);

/** What a model streams for "help me learn Spanish greetings". */
const STREAM = `root = Stack([hero, rings, deck, quiz])
hero = Headline("Spanish in 5 minutes", sub: "Today: greetings", eyebrow: "Day 3 streak", highlight: ["Spanish"], size: "md")
rings = Rings([{label: "Words", value: 18, max: 20}, {label: "Minutes", value: 4, max: 5}, {label: "Streak", value: 3, max: 7}])
deck = Flashcards([{front: "Hola", back: "Hello"}, {front: "Buenos días", back: "Good morning"}, {front: "¿Qué tal?", back: "How's it going?"}, {front: "Hasta luego", back: "See you later"}], title: "Greetings")
quiz = Quiz([{question: "How do you say good night?", choices: ["Buenas noches", "Buenos días", "Hola"], answer: 0, explain: "Noche is night; buenas noches works as hello and goodbye after dark."}], title: "Quick check")
`;

interface Example {
  id: string;
  title: string;
  blurb: string;
  program: string;
  data?: Record<string, unknown>;
  ui?: Record<string, unknown>;
  wide?: boolean;
}

const EXAMPLES: Example[] = [
  {
    id: "scene",
    title: "Scene: the model draws",
    blurb: "A stage the model composes freely: shapes, glyphs, text and lines placed by x/y, each with a depth and its own spring motion. Move your pointer; the stage tilts in 3D.",
    wide: true,
    program: `root = Scene([{shape: "ring", x: 50, y: 52, w: 150, h: 93, color: "line", z: -20}, {shape: "ring", x: 50, y: 52, w: 250, h: 155, color: "line", z: -20}, {shape: "ring", x: 50, y: 52, w: 360, h: 223, color: "line", z: -20}, {shape: "circle", x: 50, y: 52, size: 64, color: "#f2b441", motion: "pulse", speed: 0.6, z: 10}, {shape: "circle", x: 50, y: 52, size: 10, color: "#a8a39a", motion: "orbit", radius: 75, speed: 2.2, z: 30}, {shape: "circle", x: 50, y: 52, size: 16, color: "#d9b38c", motion: "orbit", radius: 125, speed: 1.2, z: 40}, {shape: "circle", x: 50, y: 52, size: 18, color: "#5b8def", motion: "orbit", radius: 180, speed: 0.8, z: 50}, {kind: "text", x: 50, y: 66, text: "Sun", size: 12, color: "muted", weight: 500}, {kind: "line", x: 6, y: 20, x2: 32, y2: 20, color: "line"}, {kind: "text", x: 19, y: 13, text: "Inner planets", size: 15, color: "ink", weight: 600, z: 40}, {kind: "text", x: 81, y: 92, text: "One year = one Earth lap", size: 12, color: "muted", weight: 400, z: 40}], height: 380, background: "ink", tilt: true, label: "The inner planets orbiting the sun", caption: "Orbits drawn to feel right, not to scale.")`,
  },
  {
    id: "layers",
    title: "Layers in 3D",
    blurb: "An exploded stack that pulls apart when you look at it. Pick a layer to read it.",
    program: `root = Layers([{title: "Your app", detail: "React components that render generated UI.", tag: "UI"}, {title: "Agentable", detail: "Every component is also a tool an agent can call.", tag: "WebMCP"}, {title: "Browser", detail: "Runs it, and exposes tools through navigator.modelContext.", tag: "Chrome"}, {title: "Model", detail: "Writes the program, one line per node, as it streams.", tag: "LLM"}], title: "Where a generated view comes from")`,
  },
  {
    id: "orbit",
    title: "Orbit",
    blurb: "Any cards on a 3D ring. Drag to spin; it settles on the nearest card.",
    program: `root = Orbit(width: 200, labels: ["Starter", "Team", "Scale", "Custom"], children: [a, b, c, d])
a = Card("Starter", "For one person", [as])
as = Stat("Per month", "$0")
b = Card("Team", "Up to 10 people", [bs])
bs = Stat("Per month", "$48")
c = Card("Scale", "Unlimited seats", [cs])
cs = Stat("Per month", "$240")
d = Card("Custom", "Talk to us", [ds])
ds = Stat("Per month", "Let's talk")`,
  },
  {
    id: "animate",
    title: "Animate anything",
    blurb: "Wrap any node: entrances on scroll, gentle loops, or a response to the pointer. Hover the cards.",
    wide: true,
    program: `root = Grid(3, [a, b, c])
a = Animate("tilt", children: [ca])
ca = Card("Tilt", "Follows the pointer in 3D", [sa])
sa = Stat("Latency", "42 ms", "-8 ms", "down")
b = Animate("float", children: [cb])
cb = Card("Float", "A slow loop, for the one thing that matters", [sb])
sb = Stat("Uptime", "99.98%")
c = Animate("magnet", children: [cc])
cc = Card("Magnet", "Leans toward your cursor", [sc])
sc = Stat("Deploys", "1,204", "+38", "up")`,
  },
  {
    id: "devices",
    title: "Devices",
    blurb: "Put any generated UI on a phone, laptop, browser, tablet or watch. A Segmented control bound to $ui switches the frame; hover to tilt.",
    wide: true,
    ui: { kind: "phone", finish: "midnight" },
    program: `root = Stack([pick, finish, frame])
pick = Segmented(["phone", "laptop", "browser", "tablet", "watch"], $ui.kind, change: @Set($ui.kind, $event))
finish = Segmented(["midnight", "silver", "starlight", "sierra", "rose"], $ui.finish, change: @Set($ui.finish, $event))
frame = Device($ui.kind, url: "bits.local/today", caption: "Generated UI, live on the screen", finish: $ui.finish, float: true, children: [card])
card = Card("Good morning", "Tuesday · 3 things today", [stats, todo])
stats = StatGroup([s1, s2])
s1 = Stat("Focus", "2h 40m", "+18m", "up")
s2 = Stat("Inbox", "12", "-9", "down")
todo = Checklist([{id: 1, text: "Ship the motion package", done: true}, {id: 2, text: "Record the launch film"}, {id: 3, text: "Reply to Maya"}])`,
  },
  {
    id: "lesson",
    title: "Lessons",
    blurb: "Explain a concept one step at a time. Steps slide in the direction you move.",
    program: `root = Lesson([{title: "A spring has two dials", body: "Tension pulls toward the target. Friction slows it down."}, {title: "No duration", body: "A spring settles when the physics says so, so an interrupted animation never jumps.", code: "{ tension: 280, friction: 24 }"}, {title: "Feels alive", body: "Overshoot and settle reads as physical, which is why it feels good."}], title: "How springs work")`,
  },
  {
    id: "quiz",
    title: "Quizzes",
    blurb: "Wrong answers shake, right ones pop, explanations spring open and streaks count up.",
    program: `root = Quiz([{question: "Which planet has the most moons?", choices: ["Jupiter", "Saturn", "Uranus", "Neptune"], answer: 1, explain: "Saturn passed 140 confirmed moons in 2023."}, {question: "What does a spring's friction do?", choices: ["Speeds it up", "Slows it down"], answer: 1}, {question: "HTTP 418 means…", choices: ["I'm a teapot", "Gone", "Too early"], answer: 0, explain: "An April Fools' RFC that refused to die."}], title: "Warm-up")`,
  },
  {
    id: "race",
    title: "Data that moves",
    blurb: "Ranking is bound to $data. When the data changes, rows spring to their new places, like a bar-chart race. Stats count up.",
    data: { langs: [] },
    program: `root = Stack([stats, race])
stats = StatGroup([a, b])
a = Stat("Stars this week", "12,480", "+8.2%", "up")
b = Stat("Median build", "1.8s", "-0.4s", "down")
race = Ranking($data.langs, title: "Most-used languages (live)")`,
  },
  {
    id: "rings",
    title: "Rings",
    blurb: "Concentric rings for goals and habits. Past 100% they lap themselves.",
    program: `root = Rings([{label: "Move", value: 520, max: 400, detail: "520/400 kcal"}, {label: "Exercise", value: 24, max: 30, detail: "24/30 min"}, {label: "Stand", value: 9, max: 12, detail: "9/12 h"}], title: "Today")`,
  },
  {
    id: "holo",
    title: "Holo cards",
    blurb: "A shareable, collectible summary. Move your pointer over it.",
    program: `root = Grid(2, [c1, c2])
c1 = HoloCard("Night owl", "Most commits after midnight", stats: [{label: "Commits", value: 412}, {label: "Streak", value: "21d"}], tags: ["TypeScript", "Rust"], footer: "2026 wrapped · No. 0412")
c2 = HoloCard("First PR merged", "agentable-ui #28", stats: [{label: "Reviews", value: 3}, {label: "Lines", value: "+1.2k"}], footer: "Nov 2026", foil: "gold")`,
  },
  {
    id: "carousel",
    title: "Carousel",
    blurb: "Swipe, drag (with rubber-banding at the ends), arrows, dots or ←/→. Each child is a slide.",
    program: `root = Carousel(title: "Trip ideas", labels: ["Lisbon", "Kyoto", "Oaxaca"], children: [a, b, c])
a = Card("Lisbon", "Trams, tiles, pastéis", [ad, ab])
ad = Stat("Flights from", "$412")
ab = Badge("4 days")
b = Card("Kyoto", "Temples at dawn", [bd, bb])
bd = Stat("Flights from", "$968")
bb = Badge("6 days")
c = Card("Oaxaca", "Mole and mezcal", [cd, cb])
cd = Stat("Flights from", "$289")
cb = Badge("5 days")`,
  },
  {
    id: "accordion",
    title: "Accordion",
    blurb: "Details on demand that spring open.",
    program: `root = Accordion([{title: "Does it respect reduced motion?", body: "Yes. Every spring jumps straight to where it lands, and idle loops stop."}, {title: "Do I need to change my renderer?", body: "No. Pass motionCatalog to the Renderer you already use."}, {title: "Can an agent drive it?", body: "Flashcards and Carousel take an agent prop that registers a tool."}], open: 0)`,
  },
  {
    id: "terminal",
    title: "Terminal",
    blurb: "Commands type themselves out when they scroll into view.",
    program: `root = Terminal(["$ pnpm add @agentable-ui/motion", "+ @agentable-ui/motion 0.1.0", "$ echo \\"import { motionCatalog } from '@agentable-ui/motion'\\"", "import { motionCatalog } from '@agentable-ui/motion'"], title: "~/my-app")`,
  },
];

const LANGS = [
  { id: "ts", label: "TypeScript" },
  { id: "py", label: "Python" },
  { id: "rs", label: "Rust" },
  { id: "go", label: "Go" },
  { id: "kt", label: "Kotlin" },
];

/** Values that drift so the ranking keeps re-sorting. */
function useLangRace() {
  const [vals, setVals] = useState(() => LANGS.map((_, i) => 60 - i * 9));
  useEffect(() => {
    const t = setInterval(() => setVals((v) => v.map((x) => Math.max(5, Math.round(x + (Math.random() - 0.45) * 22)))), 1800);
    return () => clearInterval(t);
  }, []);
  return useMemo(() => LANGS.map((l, i) => ({ id: l.id, label: l.label, value: vals[i]!, display: `${vals[i]}k` })), [vals]);
}

function StreamDemo() {
  const [text, setText] = useState("");
  const [run, setRun] = useState(0);
  const streaming = text.length < STREAM.length;
  const src = useRef<HTMLPreElement>(null);
  useEffect(() => {
    setText("");
    let i = 0;
    const t = setInterval(() => {
      i = Math.min(STREAM.length, i + 4 + Math.floor(Math.random() * 6));
      setText(STREAM.slice(0, i));
      if (i >= STREAM.length) clearInterval(t);
    }, 28);
    return () => clearInterval(t);
  }, [run]);
  useEffect(() => {
    if (src.current) src.current.scrollTop = src.current.scrollHeight;
  }, [text]);
  const tokens = Math.round(text.length / 4);
  return (
    <div className="motion-stream">
      <div className="motion-stream-src">
        <div className="motion-stream-head">
          <span className={`dot ${streaming ? "live" : ""}`} /> {streaming ? "Model is streaming…" : "Done"} <span className="muted">~{tokens} tokens</span>
          <button type="button" data-agentable-button="" onClick={() => setRun((r) => r + 1)} disabled={streaming}>
            Replay
          </button>
        </div>
        <pre ref={src}>
          {text}
          {streaming ? <span className="caret" /> : null}
        </pre>
      </div>
      <Device kind="phone" finish="midnight" caption="Each line renders the moment it's complete">
        <Renderer key={run} components={motionCatalog} library={library} response={text} isStreaming={streaming} />
      </Device>
    </div>
  );
}

function ExampleCard({ ex, data }: { ex: Example; data?: Record<string, unknown> }) {
  const [showCode, setShowCode] = useState(false);
  return (
    <section className={`motion-example ${ex.wide ? "wide" : ""}`} id={`motion-${ex.id}`}>
      <header>
        <div>
          <h3>{ex.title}</h3>
          <p>{ex.blurb}</p>
        </div>
        <button type="button" data-agentable-button="ghost" onClick={() => setShowCode((s) => !s)} aria-expanded={showCode}>
          {showCode ? "Hide program" : "Program"}
        </button>
      </header>
      {showCode ? <pre className="motion-code">{ex.program}</pre> : null}
      <div className="motion-live">
        <Renderer components={motionCatalog} library={library} response={ex.program} data={data ?? ex.data} initialUi={ex.ui} />
      </div>
    </section>
  );
}

export function MotionPage() {
  const langs = useLangRace();
  return (
    <div className="motion-page">
      <section className="motion-hero">
        <Headline eyebrow="@agentable-ui/motion" text="Generative UI that moves like it means it" highlight={["moves"]} sub="Spring physics for every Agentable component, plus devices, flashcards, quizzes, lessons, rings, holo cards and races. Models write it in a few lines, people swipe and tap it, and agents can drive it." size="xl" />
        <pre className="motion-install">
          <code>{`import { motionCatalog } from "@agentable-ui/motion";
import "@agentable-ui/motion/styles.css";

<Renderer components={motionCatalog} response={program} />`}</code>
        </pre>
      </section>

      <section className="motion-section">
        <h2>Watch a model build it</h2>
        <p className="muted">The model writes an Agentable Lang program. Each line validates and springs onto the screen as it arrives; nothing waits for the whole answer.</p>
        <StreamDemo />
      </section>

      <section className="motion-section">
        <h2>Gallery</h2>
        <p className="muted">Everything below is drawn from a program a model could write. Open "Program" to see it.</p>
        <div className="motion-grid">
          {EXAMPLES.map((ex) => (
            <ExampleCard key={ex.id} ex={ex} data={ex.id === "race" ? { langs } : undefined} />
          ))}
        </div>
      </section>
    </div>
  );
}
