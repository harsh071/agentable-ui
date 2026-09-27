import { useEffect, useRef } from "react";
import type { ConfirmRequest } from "@agentable-ui/core";

export interface ConfirmDialogProps {
  request: ConfirmRequest;
  onDecide: (ok: boolean) => void;
}

/**
 * Default, unstyled confirmation. Style through the data-agentable-confirm
 * attributes, or replace it with `renderConfirm` on the provider.
 */
export function ConfirmDialog({ request, onDecide }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof el.showModal === "function" && !el.open) el.showModal();
    const onCancel = (e: Event) => {
      e.preventDefault();
      onDecide(false);
    };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, [onDecide]);

  const args = request.args && typeof request.args === "object" && Object.keys(request.args as object).length ? JSON.stringify(request.args, null, 1) : null;

  return (
    <dialog ref={ref} data-agentable-confirm="" aria-labelledby="agentable-confirm-title">
      <form method="dialog" data-agentable-confirm-form="" onSubmit={(e) => e.preventDefault()}>
        <p data-agentable-confirm-eyebrow="">An agent wants to act on this page</p>
        <h2 id="agentable-confirm-title" data-agentable-confirm-title="">
          {request.title}
        </h2>
        <p data-agentable-confirm-message="">{request.message}</p>
        {args ? <pre data-agentable-confirm-args="">{args}</pre> : null}
        <div data-agentable-confirm-actions="">
          <button type="button" data-agentable-confirm-deny="" onClick={() => onDecide(false)} autoFocus>
            Don't allow
          </button>
          <button type="button" data-agentable-confirm-allow="" onClick={() => onDecide(true)}>
            Allow
          </button>
        </div>
      </form>
    </dialog>
  );
}
