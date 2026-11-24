import { $, type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

function charge() {
  throw new Error("The card was declined");
}

export default component$<
  Omit<PropsOf<"button">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, onClick$, ...attributes }) => {
  return (
    <button
      type="button"
      onClick$={[$(charge), onClick$]}
      class={className}
      style={style}
      {...attributes}
    >
      Charge
    </button>
  );
});
