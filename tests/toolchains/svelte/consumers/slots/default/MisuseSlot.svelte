<script lang="ts">
  import Panel from "../../../../../integration/cases/slots/default/__output__/svelte/Panel.svelte";
</script>

<Panel title="Hello">
  <!-- @uf-expect TS2322 Panel.slot:default -->
  {#snippet children(props: string)}Content {props}{/snippet}
</Panel>
