<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  const STEPS = [1, 5, 10] as const;
  const LIMITS = Object.freeze({ min: 0, max: 20 });
  const caption = (value: number): string => `${value} of ${LIMITS.max}`;
  const START = LIMITS.min + 2;

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let value = $state.raw(START);

  function add(step: number) {
    value = Math.min(LIMITS.max, value + step);
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["stepper", className]}
  aria-label="Stepper"
  {style}
  {...scopeAttributes(attributes)}
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
