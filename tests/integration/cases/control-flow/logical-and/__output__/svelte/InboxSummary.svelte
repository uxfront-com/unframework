<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface InboxSummaryProps {
    folder: string;
    unread: number;
    flagged: number;
    signature: string;
  }

  type Props = InboxSummaryProps & { class?: ClassValue; style?: string };

  let { folder, unread, flagged, signature, class: className, style }: Props = $props();
</script>

<section class={["inbox-summary", className]} aria-label="Inbox summary" {style}>
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
