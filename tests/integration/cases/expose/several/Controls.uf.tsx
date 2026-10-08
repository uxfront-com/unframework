import { useTemplateRef } from "unframework";

import Counter from "./Counter.uf.tsx";

export default function Controls() {
  const counter = useTemplateRef<{ increment(): void; reset(): void }>();
  return (
    <div class="controls">
      <Counter ref={counter} start={10} />
      <button type="button" onClick={() => counter.value?.increment()}>
        More
      </button>
      <button type="button" onClick={() => counter.value?.reset()}>
        Reset
      </button>
    </div>
  );
}
