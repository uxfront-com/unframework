import type { JSX } from "solid-js";

export interface ContactCardProps {
  name: string;
  jobTitle?: string;
  team?: string;
  pronouns?: string;
  phone?: string | null;
}

export default function ContactCard(
  props: ContactCardProps & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <article
      class={props.class ? `contact-card ${props.class}` : "contact-card"}
      aria-label={props.name}
      data-team={props.team}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <h2 title={props.pronouns}>{props.name}</h2>
      <p>{props.jobTitle}</p>
      <p>Phone: {props.phone ?? "not listed"}</p>
    </article>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
