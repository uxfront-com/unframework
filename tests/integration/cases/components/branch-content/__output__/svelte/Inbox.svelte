<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Notice from "./Notice.svelte";
  import { untrack } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["div"],
    "unread" | "children" | "class" | "style" | "ref"
  > & {
    unread: number;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let { unread, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let count = $state(untrack(() => unread));
</script>

<div class={["inbox", className]} {style} bind:this={ref} {...attributes}>
  {#if count > 0}
    <Notice text={`${count} unread`} tone="info" />
  {:else}
    <Notice text="All read" tone="quiet" />
  {/if}<button type="button" onclick={() => (count = 0)}>Mark all read</button>
</div>
