import { type JSX, Show, children } from "solid-js";

export interface CardSlots {
  title?: JSX.Element;
  children?: JSX.Element;
}

export default function Card(
  props: { label: string } & CardSlots & { class?: string; style?: JSX.CSSProperties },
) {
  const title = children(() => props.title);
  const content = children(() => props.children);
  return (
    <section
      class={props.class ? `card ${props.class}` : "card"}
      aria-label={props.label}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <Show when={title()}>
        <header class="title">{title()}</header>
      </Show>
      <Show when={content()} fallback={<p>Empty card</p>}>
        <div class="body">{content()}</div>
      </Show>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
