import Field from "./Field";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
} from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"form">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  const focuses = useSignal(0);

  return (
    <form aria-label="Sign up" class={className} style={style} {...attributes}>
      <p id="email-hint">We never share it.</p>
      <Field
        label="Email"
        id="email"
        aria-describedby="email-hint"
        placeholder="you@example.com"
        class={["wide"]}
        style={{ marginTop: "4px" }}
        onFocus$={() => focuses.value++}
      />
      <p>Focuses: {focuses.value}</p>
    </form>
  );
});
