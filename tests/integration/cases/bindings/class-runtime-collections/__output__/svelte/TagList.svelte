<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  type TagStates = { selected?: boolean; muted?: boolean };

  export interface TagListProps {
    label: string;
    tags: string[];
    states: TagStates;
    extra?: string[];
  }
</script>

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = TagListProps & { class?: ClassValue; style?: string };

  let { label, tags, states, extra, class: className, style, ...attributes }: Props = $props();

  let expanded = $state(false);

  function expand() {
    expanded = !expanded;
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div class={["tag-list", className]} {style} {...scopeAttributes(attributes)}>
  <span class={["tag", tags, states, { "tag-open": expanded }]}>{label}</span
  ><span class={tags}>Plain</span
  ><span class={[extra, expanded ? ["tag-wide", "tag-tall"] : []]}>Extra</span
  ><button type="button" onclick={expand}>Expand</button>
</div>
