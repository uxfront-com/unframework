<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface InboxMessage {
    id: string;
    subject: string;
  }

  export interface MessageListProps {
    messages: InboxMessage[];
    archived?: InboxMessage[];
    emptyText?: string;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "messages" | "archived" | "emptyText" | "children" | "class" | "style" | "ref"
  > &
    MessageListProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let {
    messages,
    archived = [],
    emptyText = "Nothing here yet.",
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<section
  class={["message-list", className]}
  aria-label="Messages"
  {style}
  bind:this={ref}
  {...attributes}
>
  <h2>Inbox</h2
  ><ul>
    {#each messages as message (message.id)}
      <li>{message.subject}</li>
    {/each}
  </ul
  >{#if messages.length === 0}
    <p>{emptyText}</p>
  {/if}<h2>Archive</h2
  ><ul>
    {#each archived as message (message.id)}
      <li>{message.subject}</li>
    {/each}
  </ul
  >{#if archived.length === 0}
    <p>No archived messages.</p>
  {:else}
    <p>{archived.length} archived</p>
  {/if}
</section>
