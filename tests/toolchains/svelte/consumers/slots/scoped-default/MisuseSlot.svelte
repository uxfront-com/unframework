<script lang="ts">
  import Names from "../../../../../integration/cases/slots/scoped-default/__output__/svelte/Names.svelte";
</script>

<Names names={["Ada"]}>
  <!-- @uf-expect TS2339 Names.slot:default -->
  {#snippet children({ size })}{size}{/snippet}
</Names>
