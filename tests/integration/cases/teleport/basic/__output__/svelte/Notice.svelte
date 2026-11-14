<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface NoticeProps {
    message: string;
  }
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = NoticeProps & { class?: ClassValue; style?: string };

  let { message, class: className, style, ...attributes }: Props = $props();

  let dismissed = $state(0);

  let mounted = $state(false);

  onMount(() => {
    mounted = true;
  });

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }

  /** Moves the element into the element `to` selects, and removes it on teardown. */
  function teleport(to: string): (element: HTMLElement) => () => void {
    return (element) => {
      const target = document.querySelector(to);
      if (!target) element.remove();
      else {
        const active = document.activeElement;
        target.append(element);
        // Moving a node blurs what it holds, which a component inside it may have focused.
        if (active instanceof HTMLElement && element.contains(active)) active.focus();
      }
      return () => element.remove();
    };
  }
</script>

<section class={["inbox", className]} aria-label="Inbox" {style} {...scopeAttributes(attributes)}>
  <p>Dismissed {dismissed} times</p
  >{#if mounted}
    <div {@attach teleport("body")} data-teleported="true" class="notice">
      <p role="status">{message} ({dismissed})</p
      ><button type="button" onclick={() => dismissed++}>Dismiss</button>
    </div>
  {/if}
</section>
