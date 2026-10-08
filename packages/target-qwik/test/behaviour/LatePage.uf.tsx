import { computed, defineEmits, watch } from "unframework";

export interface LatePageProps {
  page?: number;
  total: number;
}

// An optional prop read by a computed and a watcher (`late-prop`, unsupported on Qwik): followed
// when the parent passes it from the mount, `undefined` at first; not when it passes it only later.
export default function LatePage({ page = 1, total }: LatePageProps) {
  const emit = defineEmits<{ pageChange: [page: number, previous: number] }>();

  const label = computed(() => `Page ${page} of ${total}`);

  watch(
    () => page,
    (next, previous) => {
      emit("pageChange", next, previous);
    },
  );

  return (
    <nav aria-label="Pages">
      <p role="status">{label.value}</p>
      <p>Direct: {page}</p>
    </nav>
  );
}
