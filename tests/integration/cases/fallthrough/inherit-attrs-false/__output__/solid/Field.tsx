import type { ComponentProps } from "solid-js";

export default function Field(props: { label: string } & Pick<ComponentProps<"label">, "ref">) {
  return (
    <label class="field" ref={props.ref}>
      {props.label} <input name={props.label.toLowerCase()} />
    </label>
  );
}
