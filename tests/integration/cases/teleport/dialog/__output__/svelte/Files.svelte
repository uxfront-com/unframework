<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface FilesProps {
    file: string;
  }
</script>

<script lang="ts">
  import ConfirmDialog from "./ConfirmDialog.svelte";
  import { onMount } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "file" | "ondelete" | "children" | "class" | "style" | "ref"
  > &
    FilesProps & {
      ondelete?: (file: string) => void;
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let {
    file,
    ondelete,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  let open = $state(false);

  function confirm() {
    open = false;
    ondelete?.(file);
  }

  let mounted = $state(false);

  onMount(() => {
    mounted = true;
  });

  /** Moves the element into the element `to` selects, and removes it on teardown. */
  function teleport(to: string): (element: HTMLElement) => () => void {
    return (element) => {
      const target = document.querySelector(to);
      if (!target) element.remove();
      else {
        const active = document.activeElement;
        target.append(element);
        // Moving a node blurs what it holds, which a component inside it may have focused.
        if (active instanceof HTMLElement && element.contains(active)) active.focus();
      }
      return () => element.remove();
    };
  }
</script>

<section class={["files", className]} aria-label="Files" {style} bind:this={ref} {...attributes}>
  <p>{file}</p
  ><button type="button" onclick={() => (open = true)}>Delete {file}</button
  >{#if open}
    {#if mounted}
      <div {@attach teleport("body")} data-teleported="true" class="backdrop">
        <ConfirmDialog
          title={`Delete ${file}?`}
          onconfirm={confirm}
          onclose={() => (open = false)}
        />
      </div>
    {/if}
  {/if}
</section>
