import { useMemo, useRef } from "react";
import { useAgentCapability } from "./useAgentCapability.js";
import type { AgentProp } from "./types.js";

export interface PaginationProps {
  /** 1-based current page. */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  agent?: AgentProp;
  /** What is being paged ("orders"). */
  noun?: string;
  className?: string;
  /** How many numbered buttons to show around the current page. Default 2. */
  siblings?: number;
}

/** Page controls. One tool: go to a page number, or "next"/"previous"/"first"/"last". */
export function Pagination({ page, pageCount, onPageChange, agent, noun = "results", className, siblings = 2 }: PaginationProps) {
  const latest = useRef({ page, pageCount, onPageChange });
  latest.current = { page, pageCount, onPageChange };

  useAgentCapability<{ page: number | string }, unknown>(
    "pagination",
    agent,
    useMemo(
      () => ({
        description: `Change the page of ${noun}. Pass a page number, or "next", "previous", "first", "last".`,
        inputSchema: { type: "object", properties: { page: { type: ["integer", "string"], description: "1-based page number or next/previous/first/last" } }, required: ["page"] },
        annotations: { readOnlyHint: false, consequentialHint: false },
        confirm: false,
        execute: (args) => {
          const { page, pageCount, onPageChange } = latest.current;
          let target: number;
          if (typeof args.page === "number") target = args.page;
          else {
            switch (String(args.page).toLowerCase()) {
              case "next":
                target = page + 1;
                break;
              case "previous":
              case "prev":
                target = page - 1;
                break;
              case "first":
                target = 1;
                break;
              case "last":
                target = pageCount;
                break;
              default:
                target = Number(args.page);
            }
          }
          if (!Number.isInteger(target) || target < 1 || target > pageCount) throw new Error(`Page must be between 1 and ${pageCount}.`);
          onPageChange(target);
          return { page: target, pageCount };
        },
      }),
      [noun],
    ),
  );

  const pages = useMemo(() => {
    const set = new Set<number>([1, pageCount]);
    for (let p = page - siblings; p <= page + siblings; p++) if (p >= 1 && p <= pageCount) set.add(p);
    return [...set].sort((a, b) => a - b);
  }, [page, pageCount, siblings]);

  if (pageCount <= 1) return null;

  return (
    <nav aria-label="Pagination" className={className} data-agentable-pagination="" data-agent={agent?.name}>
      <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1} data-agentable-button="" aria-label="Previous page">
        Previous
      </button>
      <ol>
        {pages.map((p, i) => (
          <li key={p}>
            {i > 0 && pages[i - 1]! < p - 1 ? <span aria-hidden="true">&hellip;</span> : null}
            <button type="button" onClick={() => onPageChange(p)} aria-current={p === page ? "page" : undefined} data-agentable-button={p === page ? "primary" : ""}>
              {p}
            </button>
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} data-agentable-button="" aria-label="Next page">
        Next
      </button>
    </nav>
  );
}
