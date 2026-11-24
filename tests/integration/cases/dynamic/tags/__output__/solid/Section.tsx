import { type ComponentProps, type JSX, createSignal, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";

export default function Section(
  props: { title: string } & Omit<ComponentProps<"article">, "title" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["title"]);

  const [nested, setNested] = createSignal(false);

  return (
    <article {...others}>
      <Dynamic component={nested() ? "h3" : "h2"} class="title">
        {props.title}
      </Dynamic>
      <button type="button" onClick={() => setNested(!nested())}>
        {nested() ? "Lift" : "Nest"}
      </button>
    </article>
  );
}
