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
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["article"],
    "name" | "price" | "href" | "featured" | "note" | "children" | "class" | "style" | "ref"
  > &
    PlanProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["article"] | null;
    };

  let {
    name,
    price,
    href,
    featured = false,
    note,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<article
  class={[featured ? "plan featured" : "plan", className]}
  aria-label={name}
  {style}
  bind:this={ref}
  {...attributes}
>
  <h2>{name}</h2
  ><p>{price} EUR a month</p
  >{#if note}
    <p class="note">{note}</p>
  {:else}
    <p class="note">No commitment.</p>
  {/if}<a {href}>Choose {name}</a>
</article>
