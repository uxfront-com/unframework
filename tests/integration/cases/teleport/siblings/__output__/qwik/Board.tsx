import Panel from "./Panel";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
} from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"main">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  const shown = useSignal(true);

  return (
    <main class={["board", className]} style={style} {...attributes}>
      <button type="button" onClick$={() => (shown.value = false)}>
        Remove panel
      </button>
      {shown.value ? <Panel /> : null}
    </main>
  );
});
