<script lang="ts">
  import Disclosure from "../../../../../integration/cases/semantics/models/__output__/svelte/Disclosure.svelte";

  let open = $state("yes");
</script>

<!-- @uf-expect TS2322 Disclosure.model:open -->
<Disclosure bind:open title="Shipping" />
