<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface Fruit {
    name: string;
    colour: string;
  }

  export interface FruitPickerProps {
    fruits: Fruit[];
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "fruits" | "onkept" | "children" | "class" | "style" | "ref"
  > &
    FruitPickerProps & {
      onkept?: (name: string, colour: string) => void;
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let {
    fruits,
    onkept,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  let selected = $state.raw<Fruit | null>(null);
  let basket = $state.raw<Fruit[]>([]);

  function pick(fruit: Fruit) {
    selected = fruit;
  }

  function keep() {
    const current = selected;
    if (!current) return;
    const copy = structuredClone(current);
    basket = [...basket, copy];
    onkept?.(copy.name, copy.colour);
  }
</script>

<section
  class={["fruit-picker", className]}
  aria-label="Fruit"
  {style}
  bind:this={ref}
  {...attributes}
>
  <ul aria-label="Fruits">
    {#each fruits as fruit (fruit.name)}
      <li>
        <button
          type="button"
          aria-pressed={fruit === selected}
          onclick={() => pick(fruit)}
        >{fruit.name}</button>
      </li>
    {/each}
  </ul
  ><button type="button" onclick={keep}>Keep a copy</button
  ><ol aria-label="Basket">
    {#each basket as fruit, index (index)}
      <li>{`${fruit.name} (${fruit.colour})`}</li>
    {/each}
  </ol>
</section>
