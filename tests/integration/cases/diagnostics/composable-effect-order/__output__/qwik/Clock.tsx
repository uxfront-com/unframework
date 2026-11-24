import { useClock } from "./useClock";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
  useVisibleTask$,
} from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"p">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  const ready = useSignal(false);

  useVisibleTask$(
    () => {
      ready.value = true;
    },
    { strategy: "document-ready" },
  );

  const { started } = useClock();

  return (
    <p class={["clock", className]} style={style} {...attributes}>
      {ready.value ? "Ready" : "Waiting"}, {started.value ? "started" : "stopped"}
    </p>
  );
});
