<script lang="ts">
  import List from "../../../../../integration/cases/generics/list/__output__/svelte/List.svelte";
</script>

<!-- @uf-expect TS2322 List.prop:selected -->
<List label="Numbers" items={[1, 2]} selected="two" />
