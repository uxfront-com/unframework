import { clearedRef } from "./_unframework/clearedRef";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit, untrack } from "solid-js";

export default function SearchField(
  props: { label: string } & Omit<ComponentProps<"label">, "label" | "ref" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
      ref?: (api: { focus: () => void }) => void;
    },
) {
  const others = omit(props, "label", "ref", "class");

  let input: HTMLInputElement | null = null;

  function focus() {
    input?.focus();
  }

  untrack(() => props.ref?.({ focus }));

  return (
    <label class={props.class ? `search ${props.class}` : "search"} {...others}>
      {props.label}
      <input
        ref={clearedRef(
          (element) => {
            input = element;
          },
          () => {
            input = null;
          },
        )}
        type="search"
      />
    </label>
  );
}
