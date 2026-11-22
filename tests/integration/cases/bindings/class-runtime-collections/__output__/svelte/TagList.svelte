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
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["div"],
    "label" | "tags" | "states" | "extra" | "children" | "class" | "style" | "ref"
  > &
    TagListProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["div"] | null;
    };

  let {
    label,
    tags,
    states,
    extra,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  let expanded = $state(false);

  function expand() {
    expanded = !expanded;
  }
</script>

<div class={["tag-list", className]} {style} bind:this={ref} {...attributes}>
  <span class={["tag", tags, states, { "tag-open": expanded }]}>{label}</span
  ><span class={tags}>Plain</span
  ><span class={[extra, expanded ? ["tag-wide", "tag-tall"] : []]}>Extra</span
  ><button type="button" onclick={expand}>Expand</button>
</div>
