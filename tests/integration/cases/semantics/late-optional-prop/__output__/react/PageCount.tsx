import { type CSSProperties, useEffect, useEffectEvent, useMemo, useRef } from "react";

export interface PageCountProps {
  page?: number;
  total: number;
}

export interface PageCountEvents {
  onPageChange?: (page: number, previous: number) => void;
}

export interface PageCountAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function PageCount({
  page = 1,
  total,
  onPageChange,
  className,
  style,
}: PageCountProps & PageCountEvents & PageCountAttributes) {
  const label = useMemo(() => `Page ${page} of ${total}`, [page, total]);

  const previousPage = useRef(page);
  const onPageChange_1 = useEffectEvent((next: typeof page, previous: typeof page) => {
    onPageChange?.(next, previous);
  });
  useEffect(() => {
    const previous = previousPage.current;
    if (Object.is(previous, page)) return;
    previousPage.current = page;
    onPageChange_1(page, previous);
  }, [page]);

  return (
    <nav className={cx("page-count", className)} aria-label="Pages" style={style}>
      <p role="status">{label}</p>
      <p>Direct: {page}</p>
    </nav>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
