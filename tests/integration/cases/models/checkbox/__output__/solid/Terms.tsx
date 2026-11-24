import { type ComponentProps, type JSX, createSignal } from "solid-js";

export default function Terms(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [agreed, setAgreed] = createSignal(false);

  return (
    <section aria-label="Terms" {...props}>
      <label>
        <input
          type="checkbox"
          checked={agreed()}
          onChange={(event) => setAgreed(event.currentTarget.checked)}
        />{" "}
        I agree
      </label>
      <output>{agreed() ? "Agreed" : "Not agreed"}</output>
      <button type="button" onClick={() => setAgreed(!agreed())}>
        Toggle
      </button>
    </section>
  );
}
