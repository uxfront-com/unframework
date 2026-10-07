// UF2020 unwatchable-source: `watch(page, …)` passes the prop's value, which nothing can watch;
// the safe fix watches a getter, `() => page`.
import { defineEmits, watch } from "unframework";

export interface PaginationProps {
  page: number;
}

export default function Pagination({ page }: PaginationProps) {
  const emit = defineEmits<{ pageView: [page: number] }>();

  watch(page, (value) => {
    emit("pageView", value);
  });

  return (
    <nav class="pagination" aria-label="Pagination">
      <p>Page {page}</p>
    </nav>
  );
}
