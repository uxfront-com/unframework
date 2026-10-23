<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface DeleteFileProps {
    fileName: string;
  }

  type Props = DeleteFileProps & {
    ondeleted?: (fileName: string, copies: number) => void;
    class?: ClassValue;
    style?: string;
  };

  let { fileName, ondeleted, class: className, style, ...attributes }: Props = $props();

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

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["delete-file", className]}
  aria-label="File"
  {style}
  {...scopeAttributes(attributes)}
>
  <p>{fileName}, {copies} {copies === 1 ? "copy" : "copies"}</p
  ><button type="button" onclick={addCopy}>Add a copy</button
  >{#if confirming}
    <button type="button" onclick={confirmDelete}>Confirm the deletion</button>
  {:else}
    <button type="button" onclick={requestDelete}>Delete</button>
  {/if}
</section>
