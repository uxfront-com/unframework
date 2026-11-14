<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface Entry {
    id: string;
    label: string;
  }

  export interface ChecklistProps {
    entries: Entry[];
  }
</script>

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = ChecklistProps & { class?: ClassValue; style?: string };

  let { entries, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<ul class={["checklist", className]} {style} {...scopeAttributes(attributes)}>
  {#each entries as entry (entry.id)}
    <li>
      <label>{entry.label}<input name={`note-${entry.id}`} aria-label={`Note for ${entry.label}`} /></label>
    </li>
  {/each}
</ul>
