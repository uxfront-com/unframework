import { createState } from "./_unframework/createState";
import { type ComponentProps, Dynamic, type JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Section(
  props: { title: string } & Omit<ComponentProps<"article">, "title" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "title");

  const [nested, setNested] = createState(false);

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
