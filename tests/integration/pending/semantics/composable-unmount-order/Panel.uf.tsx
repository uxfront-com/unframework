import { defineEmits } from "unframework";

import { useTeardown } from "./useTeardown.uf.ts";

export default function Panel({ name }: { name: string }) {
  const emit = defineEmits<{ closed: [entry: string] }>();
  const { title } = useTeardown(
    () => name,
    (entry) => emit("closed", entry),
  );

  return (
    <section class="panel" aria-label={title.value}>
      <h2>{title.value}</h2>
    </section>
  );
}
