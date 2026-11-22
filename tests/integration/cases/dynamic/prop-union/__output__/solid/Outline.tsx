import Heading from "./Heading";
import type { ComponentProps, JSX } from "solid-js";

export default function Outline(
  props: Omit<ComponentProps<"main">, "style"> & { style?: JSX.CSSProperties },
) {
  return (
    <main {...props}>
      <Heading tag="h1" text="Guide" />
      <Heading tag="h2" text="Setup" />
      <Heading tag="h3" text="Requirements" />
    </main>
  );
}
