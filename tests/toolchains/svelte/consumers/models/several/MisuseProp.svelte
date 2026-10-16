<script lang="ts">
  import PriceRange from "../../../../../integration/cases/models/several/__output__/svelte/PriceRange.svelte";
</script>

<!-- @uf-expect TS2322 PriceRange.prop:label -->
<PriceRange label={false} />
