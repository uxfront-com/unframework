<script lang="ts">
  import Table from "../../../../../integration/cases/slots/prop-names/__output__/svelte/Table.svelte";
</script>

<Table people={[{ id: "a", name: "Ada" }]}>
  <!-- @uf-expect TS2339 Table.slot:row -->
  {#snippet row({ size })}{size}{/snippet}
</Table>
