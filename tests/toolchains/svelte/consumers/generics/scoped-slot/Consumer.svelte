<script lang="ts">
  import Picker from "../../../../../integration/cases/generics/scoped-slot/__output__/svelte/Picker.svelte";

  const fruits = [{ name: "Apple", count: 3 }];
</script>

<Picker items={fruits}>
  {#snippet item({ item })}{item.name} × {item.count}{/snippet}
</Picker>
