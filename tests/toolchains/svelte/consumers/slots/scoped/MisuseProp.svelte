<script lang="ts">
  import List from "../../../../../integration/cases/slots/scoped/__output__/svelte/List.svelte";
</script>

<!-- @uf-expect TS2322 List.prop:label -->
<List items={["a"]} label={1} />
