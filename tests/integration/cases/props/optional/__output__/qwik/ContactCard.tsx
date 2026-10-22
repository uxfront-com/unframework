import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface ContactCardProps {
  name: string;
  jobTitle?: string;
  team?: string;
  pronouns?: string;
  phone?: string | null;
}

export default component$<ContactCardProps & { class?: ClassList; style?: CSSProperties }>(
  ({ name, jobTitle, team, pronouns, phone, class: className, style, ...attributes }) => {
    return (
      <article
        class={["contact-card", className]}
        aria-label={name}
        data-team={team}
        {...scopeAttributes(attributes)}
        style={style}
      >
        <h2 title={pronouns}>{name}</h2>
        <p>{jobTitle}</p>
        <p>Phone: {phone ?? "not listed"}</p>
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
