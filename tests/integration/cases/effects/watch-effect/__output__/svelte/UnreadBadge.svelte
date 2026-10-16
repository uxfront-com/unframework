<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface UnreadBadgeProps {
    appName: string;
  }

  type Props = UnreadBadgeProps & {
    ontitlechange?: (title: string) => void;
    ontitlerelease?: (title: string) => void;
    class?: ClassValue;
    style?: string;
  };

  let { appName, ontitlechange, ontitlerelease, class: className, style }: Props = $props();

  let unread = $state(0);

  $effect(() => {
    const title = `(${unread}) ${appName}`;
    ontitlechange?.(title);
    return () => {
      ontitlerelease?.(title);
    };
  });
</script>

<section class={["unread-badge", className]} aria-label="Inbox" {style}>
  <p role="status">{unread} unread</p
  ><button type="button" onclick={() => unread++}>Receive a message</button
  ><button type="button" onclick={() => (unread = 0)}>Mark all read</button>
</section>
