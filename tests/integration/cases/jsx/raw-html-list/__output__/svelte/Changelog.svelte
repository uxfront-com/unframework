<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface Entry {
    id: number;
    html: string;
  }

  export interface ChangelogProps {
    entries: Entry[];
  }
</script>

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = ChangelogProps & { class?: ClassValue; style?: string };

  let { entries, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<ul class={["changelog", className]} {style} {...scopeAttributes(attributes)}>
  {#each entries as entry (entry.id)}
    <li>{@html entry.html}</li>
  {/each}
</ul>
