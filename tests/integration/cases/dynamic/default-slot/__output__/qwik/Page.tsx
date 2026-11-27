import Action from "./Action";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
} from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"section">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  const linked = useSignal(true);

  return (
    <section class={["page", className]} style={style} {...attributes}>
      <Action href="#docs" label="Docs">
        Read the docs
      </Action>
      <Action label="Save">Save the draft</Action>
      <Action href="#home" label="Home" />
      <Action label="Close" />
      <Action
        href={linked.value ? "#more" : undefined}
        label="More"
        icon$={() => <i aria-hidden="true">+</i>}
      >
        Learn more
      </Action>
      <button type="button" onClick$={() => (linked.value = !linked.value)}>
        Toggle
      </button>
    </section>
  );
});
