<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface ConfirmDialogProps {
    title: string;
  }
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["div"],
    "title" | "onconfirm" | "onclose" | "children" | "class" | "style" | "ref"
  > &
    ConfirmDialogProps & {
      onconfirm?: () => void;
      onclose?: () => void;
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["div"] | null;
    };

  let {
    title,
    onconfirm,
    onclose,
    class: className,
    style,
    ref = $bindable(null),
    onkeydown,
    ...attributes
  }: Props = $props();

  const uid = $props.id();
  const titleId = `uf-id-${uid}-0`;
  let cancel: HTMLButtonElement | null = null;

  onMount(() => {
    cancel?.focus();
  });

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") onclose?.();
  }
</script>

<div
  role="dialog"
  aria-modal="true"
  aria-labelledby={titleId}
  tabindex="-1"
  class={["dialog", className]}
  onkeydown={(event) => {
    onKeydown(event);
    onkeydown?.(event);
  }}
  {style}
  bind:this={ref}
  {...attributes}
>
  <h2 id={titleId}>{title}</h2
  ><button type="button" bind:this={cancel} onclick={() => onclose?.()}>Cancel</button
  ><button type="button" onclick={() => onconfirm?.()}>Delete</button>
</div>
