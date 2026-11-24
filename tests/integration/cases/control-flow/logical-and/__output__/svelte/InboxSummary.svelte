<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface InboxSummaryProps {
    folder: string;
    unread: number;
    flagged: number;
    signature: string;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "folder" | "unread" | "flagged" | "signature" | "children" | "class" | "style" | "ref"
  > &
    InboxSummaryProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let {
    folder,
    unread,
    flagged,
    signature,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<section
  class={["inbox-summary", className]}
  aria-label="Inbox summary"
  {style}
  bind:this={ref}
  {...attributes}
>
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
