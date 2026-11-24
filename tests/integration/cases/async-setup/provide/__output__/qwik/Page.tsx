import Badge from "./Badge";
import Panel from "./Panel";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"main">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  return (
    <main class={className} style={style} {...attributes}>
      <Panel id="ada">
        <Badge />
      </Panel>
    </main>
  );
});
