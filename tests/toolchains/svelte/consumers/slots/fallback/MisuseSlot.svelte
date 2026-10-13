<script lang="ts">
  import Notice from "../../../../../integration/cases/slots/fallback/__output__/svelte/Notice.svelte";
</script>

<Notice label="Build">
  <!-- @uf-expect TS2322 Notice.slot:action -->
  {#snippet action(props: string)}Content {props}{/snippet}
</Notice>
