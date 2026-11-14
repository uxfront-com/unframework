import { ref } from "@uxfront/unframework";

import Panel from "./Panel.uf.tsx";

export default function Board() {
  const shown = ref(true);

  return (
    <main class="board">
      <button type="button" onClick={() => (shown.value = false)}>
        Remove panel
      </button>
      {shown.value && <Panel />}
    </main>
  );
}
