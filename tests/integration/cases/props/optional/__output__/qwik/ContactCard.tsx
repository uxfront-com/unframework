import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface ContactCardProps {
  name: string;
  jobTitle?: string;
  team?: string;
  pronouns?: string;
  phone?: string | null;
}

export default component$<ContactCardProps & { class?: ClassList; style?: CSSProperties }>(
  ({ name, jobTitle, team, pronouns, phone, class: className, style }) => {
    return (
      <article class={["contact-card", className]} aria-label={name} data-team={team} style={style}>
        <h2 title={pronouns}>{name}</h2>
        <p>{jobTitle}</p>
        <p>Phone: {phone ?? "not listed"}</p>
      </article>
    );
  },
);
