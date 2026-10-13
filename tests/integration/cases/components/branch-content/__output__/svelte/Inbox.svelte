<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Notice from "./Notice.svelte";
  import { untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { unread: number; class?: ClassValue; style?: string };

  let { unread, class: className, style }: Props = $props();

  let count = $state(untrack(() => unread));
</script>

<div class={["inbox", className]} {style}>
  {#if count > 0}
    <Notice text={`${count} unread`} tone="info" />
  {:else}
    <Notice text="All read" tone="quiet" />
  {/if}<button type="button" onclick={() => (count = 0)}>Mark all read</button>
</div>
