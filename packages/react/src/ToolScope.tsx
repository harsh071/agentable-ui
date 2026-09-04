import { useContext, useEffect, useId, useRef, type ReactNode } from "react";
import { AgentableContext, GroupContext, ScopeContext } from "./context.js";

export interface ToolScopeProps {
  children?: ReactNode;
  /** Default group for capabilities declared inside. */
  group?: string;
  /** Human description of the group, shown in list_capabilities. */
  describe?: string;
  /** Milliseconds offscreen before the scope is demoted to tier 1. Default 5000. */
  demoteAfter?: number;
  /** IntersectionObserver rootMargin. Default "200px". */
  rootMargin?: string;
  /** Render a different element than div. */
  as?: keyof HTMLElementTagNameMap;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Scopes capabilities to a region of the page. When the region has been
 * offscreen for `demoteAfter`, its tools drop from tier 0 to tier 1 (they stay
 * listed and openable). Scrolling back promotes them again with no re-declare.
 */
export function ToolScope({ children, group, describe, demoteAfter = 5000, rootMargin = "200px", as: Tag = "div", className, style }: ToolScopeProps) {
  const agentable = useContext(AgentableContext);
  const parentGroup = useContext(GroupContext);
  const id = useId();
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!agentable || !group || !describe) return;
    agentable.describeGroup(group, describe);
  }, [agentable, group, describe]);

  useEffect(() => {
    const el = ref.current;
    if (!agentable || !el || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        if (visible) {
          if (timer) clearTimeout(timer);
          timer = undefined;
          agentable.showScope(id);
        } else if (!timer) {
          timer = setTimeout(() => {
            timer = undefined;
            agentable.hideScope(id);
          }, demoteAfter);
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
      agentable.showScope(id);
    };
  }, [agentable, id, demoteAfter, rootMargin]);

  const Element = Tag as unknown as "div";
  return (
    <ScopeContext.Provider value={id}>
      <GroupContext.Provider value={group ?? parentGroup}>
        <Element ref={ref as React.RefObject<HTMLDivElement>} data-agentable-scope={group ?? ""} className={className} style={style}>
          {children}
        </Element>
      </GroupContext.Provider>
    </ScopeContext.Provider>
  );
}
