import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  { step: string } & Omit<PropsOf<"p">, "step" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ step, class: className, style, ...attributes }) => {
  return (
    <p class={["step", className]} style={style} {...attributes}>
      Step: {step}
    </p>
  );
});
