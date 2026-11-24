import { useToggle } from "./useToggle";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"section">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  const { on, toggle, close } = useToggle(false);

  return (
    <section class={["disclosure", className]} aria-label="Shipping" style={style} {...attributes}>
      <button type="button" aria-expanded={on.value} onClick$={() => toggle()}>
        Shipping details
      </button>
      {on.value ? (
        <div class="panel">
          <p>Orders ship within two days.</p>
          <button type="button" onClick$={() => close()}>
            Close
          </button>
        </div>
      ) : null}
    </section>
  );
});
