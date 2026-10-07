<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export interface Fruit {
    name: string;
    colour: string;
  }

  export interface FruitPickerProps {
    fruits: Fruit[];
  }

  type Props = FruitPickerProps & { onkept?: (name: string, colour: string) => void };

  let { fruits, onkept }: Props = $props();

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

<section class="fruit-picker" aria-label="Fruit">
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
