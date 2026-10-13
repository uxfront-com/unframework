<script lang="ts">
  import Frame from "../../../../../integration/cases/slots/forwarding/__output__/svelte/Frame.svelte";
</script>

<Frame label="Shot">
  <!-- @uf-expect TS2322 Frame.slot:title -->
  {#snippet title(props: string)}Content {props}{/snippet}
</Frame>
