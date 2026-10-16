<script lang="ts">
  import List from "../../../../../integration/cases/slots/scoped/__output__/svelte/List.svelte";
</script>

<List items={["a", "b"]} label="Letters">
  <!-- @uf-expect TS2339 List.slot:item -->
  {#snippet item({ size })}{size}{/snippet}
</List>
