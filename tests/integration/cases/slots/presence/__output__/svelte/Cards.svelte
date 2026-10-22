<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Card from "./Card.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div class={["cards", className]} {style} {...scopeAttributes(attributes)}>
  <Card label="Full">
    <p>Sunny, 21°</p
    >{#snippet title()}
      <h3>Weather</h3>
    {/snippet}
  </Card
  ><Card label="Bare" />
</div>
