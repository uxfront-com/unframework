<script lang="ts">
  import Stepper from "../../../../../integration/cases/models/component/__output__/svelte/Stepper.svelte";

  let cups = $state(2);
</script>

<Stepper bind:value={cups} label="Cups" />
