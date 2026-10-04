export interface ContactCardProps {
  name: string;
  jobTitle?: string;
  team?: string;
  pronouns?: string;
  phone?: string | null;
}

export default function ContactCard(props: ContactCardProps) {
  return (
    <article class="contact-card" aria-label={props.name} data-team={props.team}>
      <h2 title={props.pronouns}>{props.name}</h2>
      <p>{props.jobTitle}</p>
      <p>Phone: {props.phone ?? "not listed"}</p>
    </article>
  );
}
