<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface FilesProps {
    file: string;
  }
</script>

<script lang="ts">
  import ConfirmDialog from "./ConfirmDialog.svelte";
  import { teleport } from "./_unframework/teleport";
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
