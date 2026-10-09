<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  let colour = $state("none");
</script>

<section aria-label="Colours">
  <select
    size="3"
    aria-label="Colour"
    onchange={(event) => (colour = (event.currentTarget as HTMLSelectElement).value)}
  >
    <option value="red">Red</option
    ><option value="green">Green</option
    ><option value="blue">Blue</option>
  </select
  ><output>Picked: {colour}</output>
</section>
