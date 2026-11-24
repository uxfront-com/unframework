import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export interface ContactCardProps {
  name: string;
  jobTitle?: string;
  team?: string;
  pronouns?: string;
  phone?: string | null;
}

export default component$<
  ContactCardProps &
    Omit<
      PropsOf<"article">,
      "name" | "jobTitle" | "team" | "pronouns" | "phone" | "class" | "style"
    > & { class?: ClassList; style?: CSSProperties }
>(({ name, jobTitle, team, pronouns, phone, class: className, style, ...attributes }) => {
  return (
    <article
      class={["contact-card", className]}
      aria-label={name}
      data-team={team}
      style={style}
      {...attributes}
    >
      <h2 title={pronouns}>{name}</h2>
      <p>{jobTitle}</p>
      <p>Phone: {phone ?? "not listed"}</p>
    </article>
  );
});
