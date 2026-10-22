<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = {
    label: string;
    children?: Snippet;
    action?: Snippet;
    class?: ClassValue;
    style?: string;
  };

  let { label, children, action, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div
  role="note"
  aria-label={label}
  class={["notice", className]}
  {style}
  {...scopeAttributes(attributes)}
>
  <p>
    {#if children}{@render children()}{:else}<em>Nothing to report.</em>{/if}
  </p
  >{#if action}{@render action()}{:else}<span class="muted">No action</span>{/if}
</div>
