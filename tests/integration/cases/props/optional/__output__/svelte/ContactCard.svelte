<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface ContactCardProps {
    name: string;
    jobTitle?: string;
    team?: string;
    pronouns?: string;
    phone?: string | null;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["article"],
    "name" | "jobTitle" | "team" | "pronouns" | "phone" | "children" | "class" | "style" | "ref"
  > &
    ContactCardProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["article"] | null;
    };

  let {
    name,
    jobTitle,
    team,
    pronouns,
    phone,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<article
  class={["contact-card", className]}
  aria-label={name}
  data-team={team}
  {style}
  bind:this={ref}
  {...attributes}
>
  <h2 title={pronouns}>{name}</h2
  ><p>{jobTitle}</p
  ><p>Phone: {phone ?? "not listed"}</p>
</article>
