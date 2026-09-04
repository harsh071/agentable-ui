import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useAgentCapability } from "./useAgentCapability.js";
import type { AgentProp } from "./types.js";

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  agent?: AgentProp;
  /** Text the agent sees about what the dialog is for. Defaults to the title when it is a string. */
  describe?: string;
  className?: string;
  /** Rendered when closed, e.g. the trigger button. */
  trigger?: (open: () => void) => ReactNode;
  closeLabel?: string;
}

/**
 * A modal built on <dialog>. One tool: open or close it. Contents mount only
 * while open, so tools declared inside come and go with it.
 */
export function Dialog({ open: controlled, defaultOpen = false, onOpenChange, title, description, children, agent, describe, className, trigger, closeLabel = "Close" }: DialogProps) {
  const [inner, setInner] = useState(defaultOpen);
  const open = controlled ?? inner;
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const setOpen = (v: boolean) => {
    if (controlled === undefined) setInner(v);
    onOpenChange?.(v);
  };
  const setOpenRef = useRef(setOpen);
  setOpenRef.current = setOpen;
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      if (typeof el.showModal === "function") el.showModal();
      else el.setAttribute("open", "");
    } else if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      setOpenRef.current(false);
    };
    const onClick = (e: MouseEvent) => {
      if (e.target === el) setOpenRef.current(false);
    };
    el.addEventListener("cancel", onCancel);
    el.addEventListener("click", onClick);
    return () => {
      el.removeEventListener("cancel", onCancel);
      el.removeEventListener("click", onClick);
    };
  }, []);

  const what = describe ?? (typeof title === "string" ? title : "dialog");

  useAgentCapability<{ open: boolean }, unknown>(
    "dialog",
    agent,
    useMemo(
      () => ({
        description: `Open or close the "${what}" dialog. Open it to reach the tools inside.`,
        inputSchema: { type: "object", properties: { open: { type: "boolean" } }, required: ["open"] },
        annotations: { readOnlyHint: false, consequentialHint: false },
        confirm: false,
        execute: (args) => {
          setOpenRef.current(args.open);
          return { open: args.open };
        },
      }),
      [what],
    ),
  );

  return (
    <>
      {trigger ? trigger(() => setOpen(true)) : null}
      <dialog ref={ref} className={className} aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-desc` : undefined} data-agentable-dialog="" data-agent={agent?.name}>
        {open ? (
          <div data-agentable-dialog-panel="">
            <header data-agentable-dialog-header="">
              <h2 id={`${id}-title`}>{title}</h2>
              <button type="button" aria-label={closeLabel} onClick={() => setOpen(false)} data-agentable-dialog-close="">
                &times;
              </button>
            </header>
            {description ? (
              <p id={`${id}-desc`} data-agentable-dialog-description="">
                {description}
              </p>
            ) : null}
            <div data-agentable-dialog-body="">{children}</div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
