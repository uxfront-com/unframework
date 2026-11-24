<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "onrendered" | "children" | "class" | "style" | "ref"
  > & {
    onrendered?: (count: number) => void;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let {
    onrendered,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  let messages = $state.raw(["Welcome to the team"]);
  let list: HTMLUListElement | null = null;

  let previousMessages = untrack(() => messages);
  $effect(() => {
    if (Object.is(messages, previousMessages)) return;
    previousMessages = messages;
    untrack(() => {
      onrendered?.(list?.childElementCount ?? 0);
    });
  });

  function add() {
    messages = [...messages, `Message ${messages.length + 1}`];
  }
</script>

<section
  class={["message-list", className]}
  aria-label="Messages"
  {style}
  bind:this={ref}
  {...attributes}
>
  <ul bind:this={list}>
    {#each messages as message (message)}
      <li>{message}</li>
    {/each}
  </ul
  ><button type="button" onclick={add}>Add a message</button>
</section>
