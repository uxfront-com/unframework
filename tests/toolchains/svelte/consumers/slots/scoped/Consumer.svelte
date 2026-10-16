<script lang="ts">
  import List from "../../../../../integration/cases/slots/scoped/__output__/svelte/List.svelte";
</script>

<List items={["a", "b"]} label="Letters">
  {#snippet item({ item, index })}{index}: {item.toUpperCase()}{/snippet}
</List>
