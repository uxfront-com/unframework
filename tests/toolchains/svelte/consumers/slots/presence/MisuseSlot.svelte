<script lang="ts">
  import Card from "../../../../../integration/cases/slots/presence/__output__/svelte/Card.svelte";
</script>

<Card label="Weather">
  <!-- @uf-expect TS2322 Card.slot:title -->
  {#snippet title(props: string)}Content {props}{/snippet}
</Card>
