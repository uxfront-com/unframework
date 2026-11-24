import Level from "./Level";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<typeof Level>, "class" | "style" | "title"> & {
    class?: ClassList;
    style?: CSSProperties;
  }
>(({ class: className, style, ...attributes }) => {
  return (
    <>
      <Level title="Book" class={className} style={style} {...attributes}>
        <Level title="Part">
          <Level title="Chapter" />
        </Level>
        <Level title="Appendix" />
      </Level>
    </>
  );
});
