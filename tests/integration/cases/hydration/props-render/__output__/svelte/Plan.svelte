<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface PlanProps {
    name: string;
    price: number;
    href: string;
    featured?: boolean;
    note?: string;
  }
</script>

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = PlanProps & { class?: ClassValue; style?: string };

  let {
    name,
    price,
    href,
    featured = false,
    note,
    class: className,
    style,
    ...attributes
  }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<article
  class={[featured ? "plan featured" : "plan", className]}
  aria-label={name}
  {style}
  {...scopeAttributes(attributes)}
>
  <h2>{name}</h2
  ><p>{price} EUR a month</p
  >{#if note}
    <p class="note">{note}</p>
  {:else}
    <p class="note">No commitment.</p>
  {/if}<a {href}>Choose {name}</a>
</article>
