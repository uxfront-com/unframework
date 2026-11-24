import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";

export default function Terms(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [agreed, setAgreed] = createState(false);

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
