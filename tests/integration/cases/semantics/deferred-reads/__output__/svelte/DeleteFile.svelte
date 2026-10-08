<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export interface DeleteFileProps {
    fileName: string;
  }

  type Props = DeleteFileProps & { ondeleted?: (fileName: string, copies: number) => void };

  let { fileName, ondeleted }: Props = $props();

  let copies = $state(1);
  let confirming = $state(false);
  let resolveConfirmation: (() => void) | undefined;

  async function requestDelete() {
    confirming = true;
    await new Promise<void>((resolve) => {
      resolveConfirmation = resolve;
    });
    confirming = false;
    ondeleted?.(fileName, copies);
  }

  function addCopy() {
    copies += 1;
  }

  function confirmDelete() {
    resolveConfirmation?.();
  }
</script>

<section class="delete-file" aria-label="File">
  <p>{fileName}, {copies} {copies === 1 ? "copy" : "copies"}</p
  ><button type="button" onclick={addCopy}>Add a copy</button
  >{#if confirming}
    <button type="button" onclick={confirmDelete}>Confirm the deletion</button>
  {:else}
    <button type="button" onclick={requestDelete}>Delete</button>
  {/if}
</section>
