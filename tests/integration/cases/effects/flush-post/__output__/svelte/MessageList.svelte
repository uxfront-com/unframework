<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { untrack } from "svelte";

  type Props = { onrendered?: (count: number) => void };

  let { onrendered }: Props = $props();

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

<section class="message-list" aria-label="Messages">
  <ul bind:this={list}>
    {#each messages as message (message)}
      <li>{message}</li>
    {/each}
  </ul
  ><button type="button" onclick={add}>Add a message</button>
</section>
