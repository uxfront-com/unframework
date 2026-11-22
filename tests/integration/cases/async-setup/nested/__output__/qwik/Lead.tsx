import Member from "./Member";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  { id: string } & Omit<PropsOf<typeof Member>, "id" | "class" | "style" | "ref"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ id, class: className, style, ...attributes }) => {
  return (
    <>
      <Member id={id} class={className} style={style} {...attributes} />
    </>
  );
});
