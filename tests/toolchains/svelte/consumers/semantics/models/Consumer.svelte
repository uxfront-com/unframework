<script lang="ts">
  import Disclosure from "../../../../../integration/cases/semantics/models/__output__/svelte/Disclosure.svelte";

  let open = $state(false);
</script>

<Disclosure bind:open title="Shipping" />
<Disclosure title="Returns" />
