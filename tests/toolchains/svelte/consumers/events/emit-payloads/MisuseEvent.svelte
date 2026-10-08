<script lang="ts">
  import FileRow from "../../../../../integration/cases/events/emit-payloads/__output__/svelte/FileRow.svelte";

  function open(index: number): number {
    return index + 1;
  }
</script>

<!-- @uf-expect TS2322 FileRow.event:open -->
<FileRow path="notes.txt" size={12} onopen={open} />
