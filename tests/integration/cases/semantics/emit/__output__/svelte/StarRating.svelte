<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = {
    onpreview?: (stars: number) => void;
    onrate?: (stars: number, previous: number) => void;
    oncleared?: () => void;
    class?: ClassValue;
    style?: string;
  };

  let { onpreview, onrate, oncleared, class: className, style, ...attributes }: Props = $props();

  const choices = [1, 2, 3, 4, 5];
  let stars = $state(0);

  function choose(next: number) {
    const previous = stars;
    onpreview?.(next);
    stars = next;
    onrate?.(stars, previous);
  }

  function clear() {
    for (let star = stars - 1; star >= 0; star--) {
      onpreview?.(star);
    }
    stars = 0;
    oncleared?.();
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div
  class={["star-rating", className]}
  role="group"
  aria-label="Rating"
  {style}
  {...scopeAttributes(attributes)}
>
  <ul>
    {#each choices as choice (choice)}
      <li>
        <button
          type="button"
          aria-pressed={stars >= choice}
          onclick={() => choose(choice)}
        >{choice} {choice === 1 ? "star" : "stars"}</button>
      </li>
    {/each}
  </ul
  ><p role="status">{stars} of 5</p
  ><button type="button" onclick={clear}>Clear</button>
</div>
