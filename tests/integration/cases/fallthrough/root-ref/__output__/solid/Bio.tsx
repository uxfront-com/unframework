import type { ComponentProps } from "solid-js";

export default function Bio(props: { label: string } & Pick<ComponentProps<"input">, "ref">) {
  return <input name="bio" aria-label={props.label} ref={props.ref} />;
}
