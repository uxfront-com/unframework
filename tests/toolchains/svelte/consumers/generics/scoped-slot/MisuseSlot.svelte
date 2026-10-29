<script lang="ts">
  import Picker from "../../../../../integration/cases/generics/scoped-slot/__output__/svelte/Picker.svelte";

  const fruits = [{ name: "Apple", count: 3 }];
</script>

<Picker items={fruits}>
  <!-- @uf-expect TS2339 Picker.slot:item -->
  {#snippet item({ item })}{item.nmae}{/snippet}
</Picker>
