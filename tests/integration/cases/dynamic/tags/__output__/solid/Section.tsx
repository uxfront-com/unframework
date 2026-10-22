import { type JSX, createSignal } from "solid-js";
import { Dynamic } from "solid-js/web";

export default function Section(
  props: { title: string } & { class?: string; style?: JSX.CSSProperties },
) {
  const [nested, setNested] = createSignal(false);

  return (
    <article class={props.class} style={props.style} {...scopeAttributes(props)}>
      <Dynamic component={nested() ? "h3" : "h2"} class="title">
        {props.title}
      </Dynamic>
      <button type="button" onClick={() => setNested(!nested())}>
        {nested() ? "Lift" : "Nest"}
      </button>
    </article>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
