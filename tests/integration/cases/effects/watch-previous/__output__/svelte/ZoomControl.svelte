<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { untrack } from "svelte";

  let zoom = $state(100);
  let history = $state.raw<string[]>([]);

  let previousZoom = untrack(() => zoom);
  $effect.pre(() => {
    const value = zoom;
    if (Object.is(value, previousZoom)) return;
    const previous = previousZoom;
    previousZoom = value;
    untrack(() => {
      history = [...history, `${previous}% to ${value}%`];
    });
  });
</script>

<section class="zoom-control" aria-label="Zoom">
  <output>{zoom}%</output><button type="button" onclick={() => (zoom += 25)}>Zoom in</button
  ><button type="button" onclick={() => (zoom -= 25)}>Zoom out</button
  ><button type="button" onclick={() => (zoom = 100)}>Reset</button
  ><ol aria-label="History">
    {#each history as entry, index (index)}
      <li>{entry}</li>
    {/each}
  </ol>
</section>
