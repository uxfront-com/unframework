<script lang="ts">
  import Status from "../../../../../integration/cases/types/package-types/__output__/svelte/Status.svelte";
</script>

<!-- @uf-expect TS2322 Status.prop:interval -->
<Status label="Feed" value="tick" interval="fast" />
