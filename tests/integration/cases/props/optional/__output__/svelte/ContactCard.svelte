<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export interface ContactCardProps {
    name: string;
    jobTitle?: string;
    team?: string;
    pronouns?: string;
    phone?: string | null;
  }

  let { name, jobTitle, team, pronouns, phone }: ContactCardProps = $props();
</script>

<article class="contact-card" aria-label={name} data-team={team}>
  <h2 title={pronouns}>{name}</h2
  ><p>{jobTitle}</p
  ><p>Phone: {phone ?? "not listed"}</p>
</article>
