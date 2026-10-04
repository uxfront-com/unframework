<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export interface InboxSummaryProps {
    folder: string;
    unread: number;
    flagged: number;
    signature: string;
  }

  let { folder, unread, flagged, signature }: InboxSummaryProps = $props();
</script>

<section class="inbox-summary" aria-label="Inbox summary">
  <h2>{folder || "Inbox"}</h2
  >{#if unread}
    <p>{unread} unread</p>
  {/if}{#if flagged}
    <p>{flagged} flagged</p>
  {/if}{#if unread > 0 && flagged > 0}
    <p>Some unread messages are flagged.</p>
  {/if}{#if folder}
    <p>Filed under {folder}</p>
  {/if}{#if signature}
    <p class="inbox-signature">{signature}</p>
  {/if}
</section>
