import { type JSX, Show, mergeProps } from "solid-js";

export interface PlanProps {
  name: string;
  price: number;
  href: string;
  featured?: boolean;
  note?: string;
}

export default function Plan(rawProps: PlanProps & { class?: string; style?: JSX.CSSProperties }) {
  const props = mergeProps({ featured: false } satisfies Partial<PlanProps>, rawProps);
  return (
    <article
      class={cx(props.featured ? "plan featured" : "plan", props.class)}
      aria-label={props.name}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <h2>{props.name}</h2>
      <p>{props.price} EUR a month</p>
      <Show when={props.note} fallback={<p class="note">No commitment.</p>}>
        {(note) => <p class="note">{note()}</p>}
      </Show>
      <a href={props.href}>Choose {props.name}</a>
    </article>
  );
}

/** Joins class names: strings as they are, and the names of an object's truthy entries. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") names.push(part);
    else if (part && typeof part === "object") {
      for (const [name, on] of Object.entries(part)) if (on) names.push(name);
    }
  }
  return names.join(" ");
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
