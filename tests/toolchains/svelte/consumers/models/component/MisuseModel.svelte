<script lang="ts">
  import Stepper from "../../../../../integration/cases/models/component/__output__/svelte/Stepper.svelte";

  let cups = $state("two");
</script>

<!-- @uf-expect TS2322 Stepper.model:value -->
<Stepper bind:value={cups} label="Cups" />
