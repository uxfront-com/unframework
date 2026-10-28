<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface DraftNoticeProps {
    author: string;
    saved: boolean;
  }
</script>

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = DraftNoticeProps & { class?: ClassValue; style?: string };

  let { author, saved, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["draft-notice", className]}
  aria-label="Draft"
  {style}
  {...scopeAttributes(attributes)}
>
  <img
    src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' fill='%23345'/%3E%3C/svg%3E"
    alt={`${author}'s avatar`}
    width="32"
    height="32"
  /><p title={saved ? "Saved" : "Don't forget to save"}>{saved ? "Saved" : 'Not "saved" yet'}</p
  ><p
    title={saved ? "Nothing to save" : `Press "Save" to keep ${author}'s changes`}
  >{saved ? `${author}'s draft is safe.` : `${author} says: "I'll save it later."`}</p>
</section>
