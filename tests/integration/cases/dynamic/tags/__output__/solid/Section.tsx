import { type JSX, createSignal } from "solid-js";
import { Dynamic } from "solid-js/web";

export default function Section(
  props: { title: string } & { class?: string; style?: JSX.CSSProperties },
) {
  const [nested, setNested] = createSignal(false);

  return (
    <article class={props.class} style={props.style}>
      <Dynamic component={nested() ? "h3" : "h2"} class="title">
        {props.title}
      </Dynamic>
      <button type="button" onClick={() => setNested(!nested())}>
        {nested() ? "Lift" : "Nest"}
      </button>
    </article>
  );
}
