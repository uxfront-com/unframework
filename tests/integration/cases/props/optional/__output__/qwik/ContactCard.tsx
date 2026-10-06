import { component$ } from "@qwik.dev/core";

export interface ContactCardProps {
  name: string;
  jobTitle?: string;
  team?: string;
  pronouns?: string;
  phone?: string | null;
}

export default component$<ContactCardProps>(({ name, jobTitle, team, pronouns, phone }) => {
  return (
    <article class="contact-card" aria-label={name} data-team={team}>
      <h2 title={pronouns}>{name}</h2>
      <p>{jobTitle}</p>
      <p>Phone: {phone ?? "not listed"}</p>
    </article>
  );
});
