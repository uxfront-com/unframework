import Heading from "./Heading";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"main">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  return (
    <main class={className} style={style} {...attributes}>
      <Heading tag="h1" text="Guide" />
      <Heading tag="h2" text="Setup" />
      <Heading tag="h3" text="Requirements" />
    </main>
  );
});
