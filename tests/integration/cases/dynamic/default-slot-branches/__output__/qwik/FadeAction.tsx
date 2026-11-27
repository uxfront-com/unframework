import { type TransitionState, transition } from "./_unframework/transition";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  Slot,
  component$,
  useConstant,
} from "@qwik.dev/core";

export default component$<
  { href?: string; label: string } & Omit<
    PropsOf<"a"> & PropsOf<"button">,
    "href" | "label" | "class" | "style"
  > & { class?: ClassList; style?: CSSProperties }
>(({ href, label, class: className, style, ...attributes }) => {
  const fadeState = useConstant((): TransitionState => ({
    current: 0,
    elements: [],
    entering: [],
  }));

  const Tag = href ? "a" : "button";

  return (
    <>
      <Tag href={Tag === "a" ? href : undefined} class={className} style={style} {...attributes}>
        <span ref={transition(fadeState, "fade", 0, false)}>
          <Slot>{label}</Slot>
        </span>
      </Tag>
    </>
  );
});
