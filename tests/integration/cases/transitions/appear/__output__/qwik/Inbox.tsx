import Toast from "./Toast";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
} from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"section">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  const shown = useSignal(true);

  return (
    <section aria-label="Inbox" class={className} style={style} {...attributes}>
      <button type="button" onClick$={() => (shown.value = !shown.value)}>
        {shown.value ? "Hide" : "Show"}
      </button>
      {shown.value ? <Toast /> : null}
    </section>
  );
});
