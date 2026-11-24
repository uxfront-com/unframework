import Panel from "./Panel";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  { name: string } & Omit<PropsOf<typeof Panel>, "name" | "class" | "style" | "title"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ name, class: className, style, ...attributes }) => {
  return (
    <>
      <Panel title="Welcome" class={className} style={style} {...attributes}>
        <p>
          Hello, <strong>{name}</strong>!
        </p>
        <p>Your children render in the panel.</p>
      </Panel>
    </>
  );
});
