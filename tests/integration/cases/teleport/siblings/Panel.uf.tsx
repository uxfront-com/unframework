import { Teleport, ref } from "@uxfront/unframework";

interface Row {
  id: number;
  label: string;
}

export default function Panel() {
  const note = ref(false);
  const extras = ref<string[]>([]);
  const rows = ref<Row[]>([
    { id: 1, label: "Alpha" },
    { id: 2, label: "Beta" },
  ]);

  function addExtra() {
    extras.value = [...extras.value, `Extra ${extras.value.length + 1}`];
  }

  return (
    <section class="panel" aria-label="Panel">
      <button type="button" onClick={() => (note.value = true)}>
        Show note
      </button>
      <button type="button" onClick={addExtra}>
        Add extra
      </button>
      <button type="button" onClick={() => (rows.value = [...rows.value].reverse())}>
        Reverse rows
      </button>
      {note.value && <p class="note">Note</p>}
      {extras.value.map((extra) => (
        <span key={extra}>{extra}</span>
      ))}
      <Teleport to="body">
        <div data-teleported class="first">
          First
        </div>
      </Teleport>
      <Teleport to="body">
        <div data-teleported class="second">
          Second
        </div>
      </Teleport>
      <ul>
        {rows.value.map((row) => (
          <li key={row.id}>
            {row.label}
            <Teleport to="body">
              <p data-teleported class="tip">
                {row.label} tip
              </p>
            </Teleport>
          </li>
        ))}
      </ul>
    </section>
  );
}
