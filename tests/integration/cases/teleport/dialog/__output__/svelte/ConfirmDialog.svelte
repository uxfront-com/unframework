<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface ConfirmDialogProps {
    title: string;
  }
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = ConfirmDialogProps & {
    onconfirm?: () => void;
    onclose?: () => void;
    class?: ClassValue;
    style?: string;
  };

  let { title, onconfirm, onclose, class: className, style, ...attributes }: Props = $props();

  const uid = $props.id();
  const titleId = `uf-id-${uid}-0`;
  let cancel: HTMLButtonElement | null = null;

  onMount(() => {
    cancel?.focus();
  });

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") onclose?.();
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div
  role="dialog"
  aria-modal="true"
  aria-labelledby={titleId}
  tabindex="-1"
  class={["dialog", className]}
  onkeydown={onKeydown}
  {style}
  {...scopeAttributes(attributes)}
>
  <h2 id={titleId}>{title}</h2
  ><button type="button" bind:this={cancel} onclick={() => onclose?.()}>Cancel</button
  ><button type="button" onclick={() => onconfirm?.()}>Delete</button>
</div>
