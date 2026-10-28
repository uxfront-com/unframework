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
  import type { ClassValue } from "svelte/elements";

  type Props = InboxSummaryProps & { class?: ClassValue; style?: string };

  let {
    folder,
    unread,
    flagged,
    signature,
    class: className,
    style,
    ...attributes
  }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["inbox-summary", className]}
  aria-label="Inbox summary"
  {style}
  {...scopeAttributes(attributes)}
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
