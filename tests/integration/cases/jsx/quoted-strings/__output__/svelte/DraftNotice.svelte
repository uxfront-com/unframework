<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface DraftNoticeProps {
    author: string;
    saved: boolean;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "author" | "saved" | "children" | "class" | "style" | "ref"
  > &
    DraftNoticeProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let {
    author,
    saved,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<section
  class={["draft-notice", className]}
  aria-label="Draft"
  {style}
  bind:this={ref}
  {...attributes}
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
