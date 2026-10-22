<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Tag from "./Tag.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let active = $state(false);

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div class={["tags", className]} {style} {...scopeAttributes(attributes)}>
  <Tag label="plain" /><Tag label="wide" class="wide" style="margin-left: 8px"
  /><Tag
    label="toggled"
    class={["picked", { active }]}
    style="color: {active ? "rgb(200, 0, 0)" : undefined}"
  /><button type="button" onclick={() => (active = !active)}>Toggle</button>
</div>
