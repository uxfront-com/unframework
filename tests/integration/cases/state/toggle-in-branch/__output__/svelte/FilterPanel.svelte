<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let open = $state(false);
  let colour = $state<string | null>(null);
  let note = $state<string | null>(null);

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["filter-panel", className]}
  aria-label="Filters"
  {style}
  {...scopeAttributes(attributes)}
>
  {#if open}
    <button type="button" aria-expanded="true" onclick={() => (open = false)}>Hide colours</button>
  {:else}
    <button type="button" aria-expanded="false" onclick={() => (open = true)}>Show colours</button>
  {/if}{#if open}
    <div class="colours">
      <button type="button" onclick={() => (colour = "Red")}>Red</button
      ><button type="button" onclick={() => (colour = "Blue")}>Blue</button
      ><button
        type="button"
        onclick={() => {
          colour = null;
          open = false;
        }}
      >Reset</button>
    </div>
  {/if}{#if colour}
    <div class="selection">
      <p>{`Colour: ${colour}`}</p
      ><button type="button" onclick={() => (colour = null)}>{`Clear ${colour}`}</button>
    </div>
  {:else}
    <p>No colour</p>
  {/if}{#if note === null}
    <button type="button" onclick={() => (note = "")}>Add a note</button>
  {:else}
    <div class="note">
      <label>Note<input
        oninput={(event) => (note = (event.currentTarget as HTMLInputElement).value)}
        onkeydown={(event) => {
          if (event.key === "Escape") {
            note = null;
          }
        }}
      /></label
      ><p>{`Draft: "${note}"`}</p>
    </div>
  {/if}
</section>
