/**
 * Tailwind preset (v3 config shape; v4 users can `@config` it or copy the
 * tokens). Adds theme tokens that mirror styles.css and variants for the
 * data-* state hooks so you can write `agent-active:ring-2`.
 */
export const agentablePreset = {
  theme: {
    extend: {
      colors: {
        "ag-accent": "var(--ag-accent)",
        "ag-agent": "var(--ag-agent)",
        "ag-line": "var(--ag-line)",
        "ag-panel": "var(--ag-panel)",
        "ag-muted": "var(--ag-muted)",
        "ag-danger": "var(--ag-danger)",
        "ag-success": "var(--ag-success)",
        "ag-warning": "var(--ag-warning)",
      },
      borderRadius: { ag: "var(--ag-radius)" },
      boxShadow: { ag: "var(--ag-shadow)" },
    },
  },
  plugins: [
    ({ addVariant }: { addVariant: (name: string, selector: string | string[]) => void }) => {
      addVariant("agent-active", "&[data-agent-active]");
      addVariant("agent-touched", "&[data-agent-touched]");
      addVariant("ag-selected", "&[data-selected]");
      addVariant("ag-open", "&[data-open]");
      addVariant("ag-invalid", "&[data-invalid]");
      addVariant("ag-active-tab", '&[data-state="active"]');
      addVariant("ag-busy", "&[data-busy]");
    },
  ],
};

export default agentablePreset;
