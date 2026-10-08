import { ref } from "unframework";

import Field from "./Field.uf.tsx";

export default function Form({ city }: { city: string }) {
  const cleared = ref("nothing");
  function clear(label: string) {
    cleared.value = label;
  }
  return (
    <section aria-label="Address">
      <Field label="Street" onClear={clear} />
      <Field label={city} tone="warn" onClear={(label) => clear(label.toUpperCase())} />
      <output>Cleared: {cleared.value}</output>
    </section>
  );
}
