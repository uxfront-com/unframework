<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface ContactCardProps {
    name: string;
    jobTitle?: string;
    team?: string;
    pronouns?: string;
    phone?: string | null;
  }

  type Props = ContactCardProps & { class?: ClassValue; style?: string };

  let { name, jobTitle, team, pronouns, phone, class: className, style }: Props = $props();
</script>

<article class={["contact-card", className]} aria-label={name} data-team={team} {style}>
  <h2 title={pronouns}>{name}</h2
  ><p>{jobTitle}</p
  ><p>Phone: {phone ?? "not listed"}</p>
</article>
