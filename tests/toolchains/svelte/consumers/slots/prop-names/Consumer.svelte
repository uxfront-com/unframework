<script lang="ts">
  import Table from "../../../../../integration/cases/slots/prop-names/__output__/svelte/Table.svelte";
</script>

<Table people={[{ id: "a", name: "Ada" }]}>
  {#snippet row({ name, index })}{index}: {name.toUpperCase()}{/snippet}
</Table>
