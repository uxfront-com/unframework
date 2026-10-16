<script lang="ts">
  import Card from "../../../../../integration/cases/slots/presence/__output__/svelte/Card.svelte";
</script>

<!-- @uf-expect TS2322 Card.prop:label -->
<Card label={1} />
