<script lang="ts">
  import FileRow from "../../../../../integration/cases/events/emit-payloads/__output__/svelte/FileRow.svelte";

  function open(path: string): string {
    return path.toUpperCase();
  }
</script>

<FileRow path="notes.txt" size={12} onopen={open} />
