import Card from "./Card";
import Tip from "./Tip";
import { teleport } from "./_unframework/teleport";
import {
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
  const rows = useSignal<Row[]>([
    { id: 1, label: "Alpha" },
    { id: 2, label: "Beta" },
    { id: 3, label: "Gamma" },
  ]);
  const late = useSignal(false);

  const mounted = useSignal(false);
  useVisibleTask$(
    () => {
      mounted.value = true;
    },
    { strategy: "document-ready" },
  );

  return (
    <section class={["board", className]} aria-label="Board" style={style} {...attributes}>
      <button type="button" onClick$={() => (rows.value = [...rows.value].reverse())}>
        Reverse tips
      </button>
      <button type="button" onClick$={() => (late.value = true)}>
        Show late
      </button>
      {rows.value.map((row) => (
        <Tip key={row.id} label={row.label} />
      ))}
      <>
        {late.value
          ? mounted.value && (
              <>
                {""}
                <p ref={teleport("body")} data-teleported="true" class="tip" role="note">
                  Late tip
                </p>
              </>
            )
          : null}
      </>
      <Card>
        {mounted.value && (
          <>
            {""}
            <div ref={teleport("body")} data-teleported="true" class="slotted">
              Slotted
            </div>
          </>
        )}
      </Card>
    </section>
  );
});
