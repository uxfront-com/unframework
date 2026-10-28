<script lang="ts">
  import Button from "../../../../../integration/cases/types/extends-chain/__output__/svelte/Button.svelte";
</script>

<!-- @uf-expect TS2322 Button.prop:label -->
<Button id="save" label={1} />
