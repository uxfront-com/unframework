import Heading from "./Heading";
import type { JSX } from "solid-js";

export default function Outline(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <main class={props.class} style={props.style}>
      <Heading tag="h1" text="Guide" />
      <Heading tag="h2" text="Setup" />
      <Heading tag="h3" text="Requirements" />
    </main>
  );
}
