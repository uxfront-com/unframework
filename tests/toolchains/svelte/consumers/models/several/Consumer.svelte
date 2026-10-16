<script lang="ts">
  import PriceRange from "../../../../../integration/cases/models/several/__output__/svelte/PriceRange.svelte";

  let low = $state(0);
  let high = $state(10);
</script>

<PriceRange bind:min={low} bind:max={high} label="Price" />
