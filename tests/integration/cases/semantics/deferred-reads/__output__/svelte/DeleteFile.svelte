<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface DeleteFileProps {
    fileName: string;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "fileName" | "ondeleted" | "children" | "class" | "style" | "ref"
  > &
    DeleteFileProps & {
      ondeleted?: (fileName: string, copies: number) => void;
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let {
    fileName,
    ondeleted,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

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

<section
  class={["delete-file", className]}
  aria-label="File"
  {style}
  bind:this={ref}
  {...attributes}
>
  <p>{fileName}, {copies} {copies === 1 ? "copy" : "copies"}</p
  ><button type="button" onclick={addCopy}>Add a copy</button
  >{#if confirming}
    <button type="button" onclick={confirmDelete}>Confirm the deletion</button>
  {:else}
    <button type="button" onclick={requestDelete}>Delete</button>
  {/if}
</section>
