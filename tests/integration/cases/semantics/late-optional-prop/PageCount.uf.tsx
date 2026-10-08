import { computed, defineEmits, watch } from "unframework";

export interface PageCountProps {
  page?: number;
  total: number;
}

export default function PageCount({ page = 1, total }: PageCountProps) {
  const emit = defineEmits<{ pageChange: [page: number, previous: number] }>();

  const label = computed(() => `Page ${page} of ${total}`);

  watch(
    () => page,
    (next, previous) => {
      emit("pageChange", next, previous);
    },
  );

  return (
    <nav class="page-count" aria-label="Pages">
      <p role="status">{label.value}</p>
      <p>Direct: {page}</p>
    </nav>
  );
}
