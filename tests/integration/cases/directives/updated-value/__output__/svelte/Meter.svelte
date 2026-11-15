<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { vRecord } from "./vRecord.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let level = $state(1);
  let renders = $state(0);

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section class={["meter", className]} aria-label="Meter" {style} {...scopeAttributes(attributes)}>
  <output class="level" {@attach vRecord(() => level)}>Level {level}</output
  ><p>Rendered again {renders} times</p
  ><button type="button" onclick={() => level++}>Raise</button
  ><button type="button" onclick={() => renders++}>Render again</button>
</section>
