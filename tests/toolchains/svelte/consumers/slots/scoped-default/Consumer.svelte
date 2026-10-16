<script lang="ts">
  import Names from "../../../../../integration/cases/slots/scoped-default/__output__/svelte/Names.svelte";
</script>

<Names names={["Ada"]}>
  {#snippet children({ item })}{item.toUpperCase()}{/snippet}
</Names>
