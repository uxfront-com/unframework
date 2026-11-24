<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface UnreadBadgeProps {
    appName: string;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "appName" | "ontitlechange" | "ontitlerelease" | "children" | "class" | "style" | "ref"
  > &
    UnreadBadgeProps & {
      ontitlechange?: (title: string) => void;
      ontitlerelease?: (title: string) => void;
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let {
    appName,
    ontitlechange,
    ontitlerelease,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  let unread = $state(0);

  $effect(() => {
    const title = `(${unread}) ${appName}`;
    ontitlechange?.(title);
    return () => {
      ontitlerelease?.(title);
    };
  });
</script>

<section
  class={["unread-badge", className]}
  aria-label="Inbox"
  {style}
  bind:this={ref}
  {...attributes}
>
  <p role="status">{unread} unread</p
  ><button type="button" onclick={() => unread++}>Receive a message</button
  ><button type="button" onclick={() => (unread = 0)}>Mark all read</button>
</section>
