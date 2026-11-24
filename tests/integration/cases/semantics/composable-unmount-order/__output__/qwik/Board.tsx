import Panel from "./Panel";
import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
} from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"div">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  const showA = useSignal(true);
  const showB = useSignal(true);
  const entries = useSignal<string[]>([]);

  const record = $((entry: string) => {
    entries.value = [...entries.value, entry];
  });

  return (
    <div class={["board", className]} style={style} {...attributes}>
      <>{showA.value ? <Panel name="a" onClosed$={record} /> : null}</>
      <>{showB.value ? <Panel name="b" onClosed$={record} /> : null}</>
      <button type="button" onClick$={() => (showA.value = false)}>
        Hide a
      </button>
      <button type="button" onClick$={() => (showB.value = false)}>
        Hide b
      </button>
      <output>{entries.value.join(", ")}</output>
    </div>
  );
});
