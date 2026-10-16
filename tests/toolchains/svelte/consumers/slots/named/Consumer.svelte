<script lang="ts">
  import Card from "../../../../../integration/cases/slots/named/__output__/svelte/Card.svelte";
</script>

<Card>
  <p>Body</p>
  {#snippet header()}<h2>Title</h2>{/snippet}
</Card>
