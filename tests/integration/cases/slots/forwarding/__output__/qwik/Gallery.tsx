import Frame from "./Frame";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"div">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  return (
    <div class={className} style={style} {...attributes}>
      <Frame label="Filled" title$={() => "Sunset"}>
        <p>Taken at dusk.</p>
      </Frame>
      <Frame label="Empty" />
    </div>
  );
});
