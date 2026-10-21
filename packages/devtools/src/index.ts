import type { Agentable, Snapshot } from "@agentable-ui/core";

export interface DevtoolsOptions {
  /** Corner for the toggle button. Default "bottom-right". */
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  /** Start with the panel open. Default false. */
  open?: boolean;
  /** Keyboard shortcut to toggle. Default "alt+a". Set null to disable. */
  shortcut?: string | null;
  /** Mount target. Default document.body. */
  container?: HTMLElement;
}

export interface DevtoolsHandle {
  element: HTMLElement;
  open(): void;
  close(): void;
  toggle(): void;
  unmount(): void;
}

const STYLE = `
:host { all: initial; position: fixed; z-index: 2147483000; font: 12px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: #e6e6e6; --bg:#151618; --panel:#1d1f23; --line:#2d3037; --muted:#9aa0a6; --accent:#7cc4ff; --ok:#6fd38f; --warn:#ffcf6e; --bad:#ff7b72; }
:host([data-pos="bottom-right"]) { right: 16px; bottom: 16px; }
:host([data-pos="bottom-left"]) { left: 16px; bottom: 16px; }
:host([data-pos="top-right"]) { right: 16px; top: 16px; }
:host([data-pos="top-left"]) { left: 16px; top: 16px; }
* { box-sizing: border-box; }
button { font: inherit; cursor: pointer; }
.toggle { display: inline-flex; align-items: center; gap: 8px; background: var(--bg); color: #fff; border: 1px solid var(--line); border-radius: 999px; padding: 6px 12px; box-shadow: 0 6px 24px rgba(0,0,0,.35); }
.toggle .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); }
.toggle .dot.present { background: var(--ok); box-shadow: 0 0 0 3px rgba(111,211,143,.25); }
.toggle .n { font-variant-numeric: tabular-nums; color: var(--muted); }
.panel { display: none; width: min(560px, calc(100vw - 32px)); height: min(600px, calc(100vh - 80px)); background: var(--bg); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 16px 48px rgba(0,0,0,.5); overflow: hidden; flex-direction: column; margin-bottom: 8px; }
:host([data-open]) .panel { display: flex; }
:host([data-pos^="top"]) .panel { margin-bottom: 0; margin-top: 8px; }
:host([data-pos^="top"]) .wrap { flex-direction: column-reverse; }
.wrap { display: flex; flex-direction: column; align-items: flex-end; }
:host([data-pos$="left"]) .wrap { align-items: flex-start; }
header { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-bottom: 1px solid var(--line); background: var(--panel); }
header h1 { font-size: 13px; font-weight: 600; margin: 0; flex: 1; }
header .badge { color: var(--muted); }
nav { display: flex; gap: 2px; padding: 6px 8px 0; border-bottom: 1px solid var(--line); background: var(--panel); }
nav button { background: transparent; color: var(--muted); border: 0; border-bottom: 2px solid transparent; padding: 6px 10px; border-radius: 6px 6px 0 0; }
nav button[aria-selected="true"] { color: #fff; border-bottom-color: var(--accent); }
main { flex: 1; overflow: auto; padding: 12px; }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
.stat { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; }
.stat .k { color: var(--muted); font-size: 11px; }
.stat .v { font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; }
.bar { height: 6px; background: var(--line); border-radius: 3px; overflow: hidden; margin-top: 6px; }
.bar i { display: block; height: 100%; background: var(--accent); }
.bar i.hot { background: var(--warn); }
.bar i.full { background: var(--bad); }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 5px 6px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { color: var(--muted); font-weight: 500; font-size: 11px; }
td.num { text-align: right; font-variant-numeric: tabular-nums; }
code { font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
.tag { display: inline-block; padding: 1px 6px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); font-size: 10px; margin-left: 4px; }
.tag.t0 { color: var(--ok); border-color: rgba(111,211,143,.4); }
.tag.t1 { color: var(--warn); border-color: rgba(255,207,110,.4); }
.tag.t2 { color: var(--muted); }
.tag.meta { color: var(--accent); border-color: rgba(124,196,255,.4); }
.tag.fan { color: #d3a4ff; border-color: rgba(211,164,255,.4); }
.warn { color: var(--warn); }
.empty { color: var(--muted); padding: 20px; text-align: center; }
.console { display: grid; gap: 8px; }
.console select, .console textarea, .console input { width: 100%; background: var(--panel); color: #fff; border: 1px solid var(--line); border-radius: 6px; padding: 6px 8px; font: inherit; }
.console textarea { min-height: 80px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.console .row { display: flex; gap: 8px; align-items: center; }
.console .run { background: var(--accent); color: #041627; border: 0; border-radius: 6px; padding: 6px 12px; font-weight: 600; }
.console pre { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 8px; white-space: pre-wrap; word-break: break-word; margin: 0; max-height: 220px; overflow: auto; }
.console .meta { color: var(--muted); }
.desc { color: var(--muted); font-size: 11px; }
ul.warnings { margin: 0; padding-left: 18px; }
ul.warnings li { margin: 4px 0; color: var(--warn); }
.groups button { background: var(--panel); color: #fff; border: 1px solid var(--line); border-radius: 6px; padding: 2px 8px; margin-left: 6px; font-size: 11px; }
`;

type Tab = "overview" | "capabilities" | "console" | "warnings";

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function mountDevtools(agentable: Agentable, options: DevtoolsOptions = {}): DevtoolsHandle {
  if (typeof document === "undefined") throw new Error("Devtools need a DOM.");
  defineElement();
  const el = document.createElement("agentable-devtools") as DevtoolsElement;
  el.setAttribute("data-pos", options.position ?? "bottom-right");
  if (options.open) el.setAttribute("data-open", "");
  el.agentable = agentable;
  (options.container ?? document.body).appendChild(el);

  const shortcut = options.shortcut === undefined ? "alt+a" : options.shortcut;
  const onKey = (e: KeyboardEvent) => {
    if (!shortcut) return;
    const parts = shortcut.toLowerCase().split("+");
    const key = parts.pop();
    const needsAlt = parts.includes("alt");
    const needsCtrl = parts.includes("ctrl");
    const needsMeta = parts.includes("meta");
    const needsShift = parts.includes("shift");
    if (e.key.toLowerCase() === key && e.altKey === needsAlt && e.ctrlKey === needsCtrl && e.metaKey === needsMeta && e.shiftKey === needsShift) {
      e.preventDefault();
      el.toggle();
    }
  };
  if (shortcut) window.addEventListener("keydown", onKey);

  return {
    element: el,
    open: () => el.setAttribute("data-open", ""),
    close: () => el.removeAttribute("data-open"),
    toggle: () => el.toggle(),
    unmount: () => {
      window.removeEventListener("keydown", onKey);
      el.remove();
    },
  };
}

interface DevtoolsElement extends HTMLElement {
  agentable: Agentable | null;
  toggle(): void;
}

let defined = false;
function defineElement(): void {
  if (defined || typeof customElements === "undefined") return;
  defined = true;
  if (customElements.get("agentable-devtools")) return;

  class AgentableDevtools extends HTMLElement implements DevtoolsElement {
    private _agentable: Agentable | null = null;
    private unsubscribe?: () => void;
    private snapshot: Snapshot | null = null;
    private tab: Tab = "overview";
    private root: ShadowRoot;
    private main!: HTMLElement;
    private consoleState = { tool: "", input: "{}", output: "", ms: 0, running: false };
    private toggleBtn!: HTMLButtonElement;

    constructor() {
      super();
      this.root = this.attachShadow({ mode: "open" });
    }

    get agentable() {
      return this._agentable;
    }
    set agentable(a: Agentable | null) {
      this.unsubscribe?.();
      this._agentable = a;
      if (a && this.isConnected) this.subscribe();
    }

    connectedCallback() {
      this.root.innerHTML = `
        <style>${STYLE}</style>
        <div class="wrap">
          <section class="panel" role="dialog" aria-label="Agentable devtools">
            <header><h1>Agentable</h1><span class="badge" data-badge></span><button class="toggle" data-close aria-label="Close">×</button></header>
            <nav role="tablist"></nav>
            <main></main>
          </section>
          <button class="toggle" data-toggle aria-expanded="false"><span class="dot"></span><span>Agent</span><span class="n"></span></button>
        </div>`;
      this.main = this.root.querySelector("main")!;
      this.toggleBtn = this.root.querySelector("[data-toggle]")!;
      this.toggleBtn.addEventListener("click", () => this.toggle());
      this.root.querySelector("[data-close]")!.addEventListener("click", () => this.removeAttribute("data-open"));
      this.renderTabs();
      if (this._agentable) this.subscribe();
      this.render();
    }

    disconnectedCallback() {
      this.unsubscribe?.();
      this.unsubscribe = undefined;
    }

    toggle() {
      if (this.hasAttribute("data-open")) this.removeAttribute("data-open");
      else this.setAttribute("data-open", "");
      this.toggleBtn.setAttribute("aria-expanded", String(this.hasAttribute("data-open")));
    }

    private subscribe() {
      this.unsubscribe = this._agentable!.subscribe((s) => {
        this.snapshot = s;
        this.render();
      });
    }

    private renderTabs() {
      const nav = this.root.querySelector("nav")!;
      const tabs: Array<[Tab, string]> = [
        ["overview", "Overview"],
        ["capabilities", "Capabilities"],
        ["console", "Console"],
        ["warnings", "Warnings"],
      ];
      nav.innerHTML = tabs.map(([id, label]) => `<button role="tab" data-tab="${id}" aria-selected="${id === this.tab}">${label}</button>`).join("");
      nav.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((b) =>
        b.addEventListener("click", () => {
          this.tab = b.dataset.tab as Tab;
          this.renderTabs();
          this.render();
        }),
      );
    }

    private render() {
      const s = this.snapshot;
      const badge = this.root.querySelector("[data-badge]");
      const n = this.root.querySelector(".n");
      const dot = this.root.querySelector(".dot");
      if (!s) {
        this.main.innerHTML = `<div class="empty">No registry attached.</div>`;
        return;
      }
      if (badge) badge.textContent = `${s.budget.used}/${s.budget.max} resident · ~${s.estimatedTokens} tokens`;
      if (n) n.textContent = `${s.budget.used}/${s.budget.max}`;
      dot?.classList.toggle("present", s.agentPresent);
      const label = this.root.querySelector("nav [data-tab='warnings']");
      if (label) label.textContent = s.warnings.length ? `Warnings (${s.warnings.length})` : "Warnings";

      switch (this.tab) {
        case "overview":
          this.main.innerHTML = this.overview(s);
          this.main.querySelectorAll<HTMLButtonElement>("[data-open-group]").forEach((b) =>
            b.addEventListener("click", () => {
              const g = b.dataset.openGroup!;
              if (this._agentable!.isOpen(g)) this._agentable!.demote(g);
              else this._agentable!.promote(g);
            }),
          );
          this.main.querySelector("[data-clear-cache]")?.addEventListener("click", () => this._agentable!.clearCache());
          break;
        case "capabilities":
          this.main.innerHTML = this.capabilities(s);
          break;
        case "console":
          this.renderConsole(s);
          break;
        case "warnings":
          this.main.innerHTML = s.warnings.length
            ? `<ul class="warnings">${s.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>`
            : `<div class="empty">No warnings. Character limits and budget are healthy.</div>`;
          break;
      }
    }

    private overview(s: Snapshot): string {
      const pct = s.budget.max ? s.budget.used / s.budget.max : 0;
      const cls = pct >= 1 ? "full" : pct >= 0.8 ? "hot" : "";
      const total = s.cache.hits + s.cache.misses;
      const hitRate = total ? Math.round((s.cache.hits / total) * 100) : 0;
      const ranked = [...s.resident].sort((a, b) => b.schemaChars - a.schemaChars);
      // Show a group's description (from ToolScope describe) where one exists; keep the id as a tooltip.
      const groupLabel = (name?: string) => {
        if (!name) return "";
        const d = s.groups.find((g) => g.name === name)?.description;
        return d ? `<span title="${esc(name)}">${esc(d)}</span>` : esc(name);
      };
      const rows = ranked
        .map(
          (t) =>
            `<tr><td><code>${esc(t.name)}</code>${t.kind === "meta" ? '<span class="tag meta">meta</span>' : t.kind === "fan-in" ? `<span class="tag fan">fan-in ×${t.capabilityIds.length}</span>` : ""}</td><td>${groupLabel(t.group)}</td><td class="num">${t.schemaChars}</td><td class="num">~${Math.ceil(t.schemaChars / 4)}</td></tr>`,
        )
        .join("");
      const groups = s.groups
        .map(
          (g) =>
            `<span>${groupLabel(g.name)} <span class="tag">${g.size}</span>${g.hidden ? '<span class="tag t1">offscreen</span>' : ""}<button data-open-group="${esc(g.name)}">${g.open ? "close" : "open"}</button></span>`,
        )
        .join(" ");
      return `
        <div class="stats">
          <div class="stat"><div class="k">Resident tools</div><div class="v">${s.budget.used} / ${s.budget.max}</div><div class="bar"><i class="${cls}" style="width:${Math.min(100, pct * 100)}%"></i></div></div>
          <div class="stat"><div class="k">Est. context</div><div class="v">~${s.estimatedTokens}</div><div class="desc">tokens of schemas</div></div>
          <div class="stat"><div class="k">Cache hit rate</div><div class="v">${hitRate}%</div><div class="desc">${s.cache.hits} hits · ${s.cache.misses} misses · ${s.cache.size} entries <button data-clear-cache class="tag">clear</button></div></div>
          <div class="stat"><div class="k">Agent</div><div class="v">${s.agentPresent ? "present" : "not seen"}</div><div class="desc">${s.adapters.map((a) => `${esc(a.id)}${a.available ? "" : " (off)"}`).join(", ") || "no adapters"}</div></div>
        </div>
        <div class="groups" style="margin-bottom:12px">${groups || '<span class="desc">No groups declared.</span>'}</div>
        <table><thead><tr><th>Resident tool (by schema size)</th><th>Group</th><th class="num">Chars</th><th class="num">Tokens</th></tr></thead><tbody>${rows || `<tr><td colspan="4" class="empty">Nothing registered.</td></tr>`}</tbody></table>`;
    }

    private capabilities(s: Snapshot): string {
      const rows = [...s.capabilities]
        .sort((a, b) => a.effectiveTier - b.effectiveTier || (a.group ?? "").localeCompare(b.group ?? "") || a.id.localeCompare(b.id))
        .map((c) => {
          const tier = `<span class="tag t${c.effectiveTier}">tier ${c.effectiveTier}${c.declaredTier !== c.effectiveTier ? ` (declared ${c.declaredTier})` : ""}</span>`;
          const why = c.reason && c.reason !== "tier" ? `<span class="tag">${esc(c.reason)}</span>` : "";
          return `<tr><td><code>${esc(c.id)}</code>${c.hasRender ? '<span class="tag">render</span>' : ""}</td><td><code>${esc(c.toolName ?? "")}</code>${c.fanIn ? `<span class="tag fan">→ ${esc(c.fanIn)}</span>` : ""}</td><td>${esc(c.group ?? "")}</td><td>${tier}${why}</td><td class="num">${c.priority}</td><td class="num">${c.refCount}</td></tr>`;
        })
        .join("");
      return `<table><thead><tr><th>Capability</th><th>Tool</th><th>Group</th><th>State</th><th class="num">Prio</th><th class="num">Refs</th></tr></thead><tbody>${rows || `<tr><td colspan="6" class="empty">No capabilities declared.</td></tr>`}</tbody></table>`;
    }

    private renderConsole(s: Snapshot) {
      const st = this.consoleState;
      if (!s.resident.some((t) => t.name === st.tool)) st.tool = s.resident[0]?.name ?? "";
      const tools = this._agentable!.getResident();
      const current = tools.find((t) => t.name === st.tool);
      const props = current ? Object.keys((current.inputSchema.properties as object) ?? {}) : [];
      this.main.innerHTML = `
        <div class="console">
          <div class="desc">Invoke a resident tool exactly as a browser agent would. No agent or Chrome flag needed.</div>
          <select data-tool>${s.resident.map((t) => `<option value="${esc(t.name)}" ${t.name === st.tool ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select>
          <div class="desc">${current ? esc(current.description) : ""}${props.length ? `<br>params: <code>${esc(props.join(", "))}</code>` : ""}</div>
          <textarea data-input spellcheck="false">${esc(st.input)}</textarea>
          <div class="row"><button class="run" data-run ${st.running ? "disabled" : ""}>${st.running ? "Running…" : "Run"}</button><span class="meta">${st.ms ? `${st.ms} ms · ${st.output.length} chars` : ""}</span></div>
          <pre data-output>${esc(st.output)}</pre>
        </div>`;
      const select = this.main.querySelector<HTMLSelectElement>("[data-tool]")!;
      const input = this.main.querySelector<HTMLTextAreaElement>("[data-input]")!;
      select.addEventListener("change", () => {
        st.tool = select.value;
        st.output = "";
        st.ms = 0;
        this.renderConsole(this.snapshot!);
      });
      input.addEventListener("input", () => (st.input = input.value));
      this.main.querySelector("[data-run]")!.addEventListener("click", async () => {
        st.running = true;
        this.renderConsole(this.snapshot!);
        const t0 = performance.now();
        try {
          st.output = await this._agentable!.invoke(st.tool, st.input, { adapter: "devtools" });
        } catch (e) {
          st.output = `Error: ${e instanceof Error ? e.message : String(e)}`;
        }
        st.ms = Math.round(performance.now() - t0);
        st.running = false;
        this.renderConsole(this.snapshot!);
      });
    }
  }

  customElements.define("agentable-devtools", AgentableDevtools);
}
