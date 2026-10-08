<script lang="ts">
  import FileRow from "../../../../../integration/cases/events/emit-payloads/__output__/svelte/FileRow.svelte";
</script>

<!-- @uf-expect TS2322 FileRow.prop:path -->
<FileRow path={42} size={12} />
