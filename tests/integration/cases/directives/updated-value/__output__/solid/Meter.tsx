import { vRecord } from "./vRecord";
import { type ComponentProps, type JSX, createSignal, splitProps } from "solid-js";

export default function Meter(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  const [level, setLevel] = createSignal(1);
  const [renders, setRenders] = createSignal(0);

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
