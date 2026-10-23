<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Notice from "./Notice.svelte";
  import { untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { unread: number; class?: ClassValue; style?: string };

  let { unread, class: className, style, ...attributes }: Props = $props();

  let count = $state(untrack(() => unread));

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div class={["inbox", className]} {style} {...scopeAttributes(attributes)}>
  {#if count > 0}
    <Notice text={`${count} unread`} tone="info" />
  {:else}
    <Notice text="All read" tone="quiet" />
  {/if}<button type="button" onclick={() => (count = 0)}>Mark all read</button>
</div>
