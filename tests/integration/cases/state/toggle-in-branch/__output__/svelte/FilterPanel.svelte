<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  let open = $state(false);
  let colour = $state<string | null>(null);
  let note = $state<string | null>(null);
</script>

<section class="filter-panel" aria-label="Filters">
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
