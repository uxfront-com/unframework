import Frame from "./Frame";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"div">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  return (
    <div class={className} style={style} {...attributes}>
      <Frame label="Card" wide={false} title$={() => "Sunset"} />
      <Frame label="Panel" wide={true} title$={() => "Dawn"} />
      <Frame label="Empty" wide={true} />
    </div>
  );
});
