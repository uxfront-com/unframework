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

  let {
    appName,
    ontitlechange,
    ontitlerelease,
    class: className,
    style,
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

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["unread-badge", className]}
  aria-label="Inbox"
  {style}
  {...scopeAttributes(attributes)}
>
  <p role="status">{unread} unread</p
  ><button type="button" onclick={() => unread++}>Receive a message</button
  ><button type="button" onclick={() => (unread = 0)}>Mark all read</button>
</section>
