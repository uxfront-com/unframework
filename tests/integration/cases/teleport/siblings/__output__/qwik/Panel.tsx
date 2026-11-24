import { teleport } from "./_unframework/teleport";
import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
  useVisibleTask$,
} from "@qwik.dev/core";

interface Row {
  id: number;
  label: string;
}

export default component$<
  Omit<PropsOf<"section">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  const note = useSignal(false);
  const extras = useSignal<string[]>([]);
  const rows = useSignal<Row[]>([
    { id: 1, label: "Alpha" },
    { id: 2, label: "Beta" },
  ]);

  const addExtra = $(() => {
    extras.value = [...extras.value, `Extra ${extras.value.length + 1}`];
  });

  const mounted = useSignal(false);
  useVisibleTask$(
    () => {
      mounted.value = true;
    },
    { strategy: "document-ready" },
  );

  return (
    <section class={["panel", className]} aria-label="Panel" style={style} {...attributes}>
      <button type="button" onClick$={() => (note.value = true)}>
        Show note
      </button>
      <button type="button" onClick$={addExtra}>
        Add extra
      </button>
      <button type="button" onClick$={() => (rows.value = [...rows.value].reverse())}>
        Reverse rows
      </button>
      <>{note.value ? <p class="note">Note</p> : null}</>
      {extras.value.map((extra) => (
        <span key={extra}>{extra}</span>
      ))}
      {mounted.value && (
        <>
          {""}
          <div ref={teleport("body")} data-teleported="true" class="first">
            First
          </div>
        </>
      )}
      {mounted.value && (
        <>
          {""}
          <div ref={teleport("body")} data-teleported="true" class="second">
            Second
          </div>
        </>
      )}
      <ul>
        {rows.value.map((row) => (
          <li key={row.id}>
            {row.label}
            {mounted.value && (
              <>
                {""}
                <p ref={teleport("body")} data-teleported="true" class="tip">
                  {row.label} tip
                </p>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
});
