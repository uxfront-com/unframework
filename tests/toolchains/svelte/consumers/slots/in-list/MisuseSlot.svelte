<script lang="ts">
  import Steps from "../../../../../integration/cases/slots/in-list/__output__/svelte/Steps.svelte";
</script>

<Steps steps={["Boil"]}>
  <!-- @uf-expect TS2322 Steps.slot:marker -->
  {#snippet marker(props: string)}Content {props}{/snippet}
</Steps>
