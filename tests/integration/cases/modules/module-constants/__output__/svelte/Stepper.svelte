<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  const STEPS = [1, 5, 10] as const;
  const LIMITS = Object.freeze({ min: 0, max: 20 });
  const caption = (value: number): string => `${value} of ${LIMITS.max}`;
  const START = LIMITS.min + 2;

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let value = $state.raw(START);

  function add(step: number) {
    value = Math.min(LIMITS.max, value + step);
  }
</script>

<section
  class={["stepper", className]}
  aria-label="Stepper"
  {style}
  bind:this={ref}
  {...attributes}
>
  <p role="status">{caption(value)}</p
  ><ul>
    {#each STEPS as step (step)}
      <li>
        <button type="button" onclick={() => add(step)}>Add {step}</button>
      </li>
    {/each}
  </ul>
</section>
