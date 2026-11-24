import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface ContactCardProps {
  name: string;
  jobTitle?: string;
  team?: string;
  pronouns?: string;
  phone?: string | null;
}

export default function ContactCard(
  props: ContactCardProps &
    Omit<
      ComponentProps<"article">,
      "name" | "jobTitle" | "team" | "pronouns" | "phone" | "class" | "style"
    > & { class?: string; style?: JSX.CSSProperties },
) {
  const others = omit(props, "name", "jobTitle", "team", "pronouns", "phone", "class");

  return (
    <article
      class={props.class ? `contact-card ${props.class}` : "contact-card"}
      aria-label={props.name}
      data-team={props.team}
      {...others}
    >
      <h2 title={props.pronouns}>{props.name}</h2>
      <p>{props.jobTitle}</p>
      <p>Phone: {props.phone ?? "not listed"}</p>
    </article>
  );
}
