<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export interface InboxMessage {
    id: string;
    subject: string;
  }

  export interface MessageListProps {
    messages: InboxMessage[];
    archived?: InboxMessage[];
    emptyText?: string;
  }

  let { messages, archived = [], emptyText = "Nothing here yet." }: MessageListProps = $props();
</script>

<section class="message-list" aria-label="Messages">
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
