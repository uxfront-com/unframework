import { createState } from "./_unframework/createState";
import { vRecord } from "./vRecord";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Meter(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [level, setLevel] = createState(1);
  const [renders, setRenders] = createState(0);

  return (
    <section class={props.class ? `meter ${props.class}` : "meter"} aria-label="Meter" {...others}>
      <output class="level" ref={vRecord(() => level())}>
        Level {level()}
      </output>
      <p>Rendered again {renders()} times</p>
      <button type="button" onClick={() => setLevel(level() + 1)}>
        Raise
      </button>
      <button type="button" onClick={() => setRenders(renders() + 1)}>
        Render again
      </button>
    </section>
  );
}
