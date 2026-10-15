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
    >
      <h2 title={props.pronouns}>{props.name}</h2>
      <p>{props.jobTitle}</p>
      <p>Phone: {props.phone ?? "not listed"}</p>
    </article>
  );
}
