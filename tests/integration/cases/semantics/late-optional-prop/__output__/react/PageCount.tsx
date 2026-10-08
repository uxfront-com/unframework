import { useEffect, useEffectEvent, useMemo, useRef } from "react";

export interface PageCountProps {
  page?: number;
  total: number;
}

export interface PageCountEvents {
  onPageChange?: (page: number, previous: number) => void;
}

export default function PageCount({
  page = 1,
  total,
  onPageChange,
}: PageCountProps & PageCountEvents) {
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
    <nav className="page-count" aria-label="Pages">
      <p role="status">{label}</p>
      <p>Direct: {page}</p>
    </nav>
  );
}
