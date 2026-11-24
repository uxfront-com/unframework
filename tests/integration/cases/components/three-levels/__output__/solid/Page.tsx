import Section from "./Section";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function Page(
  props: { name: string } & Omit<ComponentProps<"article">, "name" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["name"]);

  return (
    <article aria-label="Profile" {...others}>
      <Section title={`About ${props.name}`} body="Three components deep." />
      <Section title="Contact" body={`Write to ${props.name}.`} />
    </article>
  );
}
