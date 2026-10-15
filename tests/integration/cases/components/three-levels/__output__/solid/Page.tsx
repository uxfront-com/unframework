import Section from "./Section";
import type { JSX } from "solid-js";

export default function Page(
  props: { name: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <article aria-label="Profile" class={props.class} style={props.style}>
      <Section title={`About ${props.name}`} body="Three components deep." />
      <Section title="Contact" body={`Write to ${props.name}.`} />
    </article>
  );
}
