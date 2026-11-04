import { ref } from "unframework";

import Panel from "./Panel.uf.tsx";

export default function Board() {
  const showA = ref(true);
  const showB = ref(true);
  const entries = ref<string[]>([]);

  function record(entry: string) {
    entries.value = [...entries.value, entry];
  }

  return (
    <div class="board">
      {showA.value && <Panel name="a" onClosed={record} />}
      {showB.value && <Panel name="b" onClosed={record} />}
      <button type="button" onClick={() => (showA.value = false)}>
        Hide a
      </button>
      <button type="button" onClick={() => (showB.value = false)}>
        Hide b
      </button>
      <output>{entries.value.join(", ")}</output>
    </div>
  );
}
