<script lang="ts">
  import PriceRange from "../../../../../integration/cases/models/several/__output__/svelte/PriceRange.svelte";

  let high = $state("ten");
</script>

<!-- @uf-expect TS2322 PriceRange.model:max -->
<PriceRange bind:max={high} label="Price" />
