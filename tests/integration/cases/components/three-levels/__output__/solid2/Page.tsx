import Section from "./Section";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Page(
  props: { name: string } & Omit<ComponentProps<"article">, "name" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "name");

  return (
    <article aria-label="Profile" {...others}>
      <Section title={`About ${props.name}`} body="Three components deep." />
      <Section title="Contact" body={`Write to ${props.name}.`} />
    </article>
  );
}
