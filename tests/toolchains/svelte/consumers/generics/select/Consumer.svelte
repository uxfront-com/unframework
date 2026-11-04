<script lang="ts">
  import Select from "../../../../../integration/cases/generics/select/__output__/svelte/Select.svelte";

  let size = $state<"s" | "m">("s");
</script>

<Select bind:value={size} label="Size" options={["s", "m"]} />
