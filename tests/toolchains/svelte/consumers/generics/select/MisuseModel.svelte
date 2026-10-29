<script lang="ts">
  import Select from "../../../../../integration/cases/generics/select/__output__/svelte/Select.svelte";

  let count = $state(1);
</script>

<!-- @uf-expect TS2322 Select.model:value -->
<Select bind:value={count} label="Size" options={["s", "m"]} />
