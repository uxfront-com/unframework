<script lang="ts">
  import Card from "../../../../../integration/cases/slots/named/__output__/svelte/Card.svelte";
</script>

<Card>
  <!-- @uf-expect TS2322 Card.slot:header -->
  {#snippet header(props: string)}Content {props}{/snippet}
</Card>
