<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface DeliveryProps {
    speeds: string[];
    extras: string[];
  }
</script>

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = DeliveryProps & { class?: ClassValue; style?: string };

  let { speeds, extras, class: className, style, ...attributes }: Props = $props();

  let speed = $state("express");
  let chosen = $state.raw<string[]>(["insurance"]);

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section aria-label="Delivery" class={className} {style} {...scopeAttributes(attributes)}>
  <fieldset>
    <legend>Speed</legend
    >{#each speeds as value (value)}
      <label><input type="radio" name="speed" {value} bind:group={speed} /> {value}</label>
    {/each}
  </fieldset
  ><fieldset>
    <legend>Extras</legend
    >{#each extras as extra (extra)}
      <label><input type="checkbox" value={extra} bind:group={chosen} /> {extra}</label>
    {/each}
  </fieldset
  ><output>Speed: {speed}, extras: {chosen.join(", ") || "none"}</output>
</section>
