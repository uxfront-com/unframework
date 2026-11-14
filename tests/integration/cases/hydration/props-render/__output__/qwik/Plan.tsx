import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface PlanProps {
  name: string;
  price: number;
  href: string;
  featured?: boolean;
  note?: string;
}

export default component$<PlanProps & { class?: ClassList; style?: CSSProperties }>(
  ({ name, price, href, featured = false, note, class: className, style, ...attributes }) => {
    return (
      <article
        class={[featured ? "plan featured" : "plan", className]}
        aria-label={name}
        {...scopeAttributes(attributes)}
        style={style}
      >
        <h2>{name}</h2>
        <p>{price} EUR a month</p>
        <>{note ? <p class="note">{note}</p> : <p class="note">No commitment.</p>}</>
        <a href={href}>Choose {name}</a>
      </article>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
