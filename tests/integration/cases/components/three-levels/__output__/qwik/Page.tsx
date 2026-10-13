import Section from "./Section";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ name: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ name, class: className, style }) => {
    return (
      <article aria-label="Profile" class={className} style={style}>
        <Section title={`About ${name}`} body="Three components deep." />
        <Section title="Contact" body={`Write to ${name}.`} />
      </article>
    );
  },
);
