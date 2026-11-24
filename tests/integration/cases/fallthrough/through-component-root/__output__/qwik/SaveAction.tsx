import Pressable from "./Pressable";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  { text: string } & Omit<PropsOf<typeof Pressable>, "text" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ text, class: className, style, ...attributes }) => {
  return (
    <>
      <Pressable text={text} class={["save", className]} style={style} {...attributes} />
    </>
  );
});
