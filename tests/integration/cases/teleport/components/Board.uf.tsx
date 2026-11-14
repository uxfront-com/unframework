import { Teleport, ref } from "@uxfront/unframework";

import Card from "./Card.uf.tsx";
import Tip from "./Tip.uf.tsx";

interface Row {
  id: number;
  label: string;
}

export default function Board() {
  const rows = ref<Row[]>([
    { id: 1, label: "Alpha" },
    { id: 2, label: "Beta" },
  ]);

  return (
    <section class="board" aria-label="Board">
      <button type="button" onClick={() => (rows.value = [...rows.value].reverse())}>
        Reverse tips
      </button>
      {rows.value.map((row) => (
        <Tip key={row.id} label={row.label} />
      ))}
      <Card>
        <Teleport to="body">
          <div data-teleported class="slotted">
            Slotted
          </div>
        </Teleport>
      </Card>
    </section>
  );
}
