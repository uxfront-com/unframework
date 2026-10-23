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

  let {
    name,
    jobTitle,
    team,
    pronouns,
    phone,
    class: className,
    style,
    ...attributes
  }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<article
  class={["contact-card", className]}
  aria-label={name}
  data-team={team}
  {style}
  {...scopeAttributes(attributes)}
>
  <h2 title={pronouns}>{name}</h2
  ><p>{jobTitle}</p
  ><p>Phone: {phone ?? "not listed"}</p>
</article>
