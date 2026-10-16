import Heading from "./Heading";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    return (
      <main class={className} style={style}>
        <Heading tag="h1" text="Guide" />
        <Heading tag="h2" text="Setup" />
        <Heading tag="h3" text="Requirements" />
      </main>
    );
  },
);
