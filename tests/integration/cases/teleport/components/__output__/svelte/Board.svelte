<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Card from "./Card.svelte";
  import Tip from "./Tip.svelte";
  import { onMount } from "svelte";
  import type { ClassValue } from "svelte/elements";

  interface Row {
    id: number;
    label: string;
  }

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let rows = $state.raw<Row[]>([
    { id: 1, label: "Alpha" },
    { id: 2, label: "Beta" },
    { id: 3, label: "Gamma" },
  ]);

  let late = $state(false);

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

<section class={["board", className]} aria-label="Board" {style} {...scopeAttributes(attributes)}>
  <button type="button" onclick={() => (rows = [...rows].reverse())}>Reverse tips</button
  ><button type="button" onclick={() => (late = true)}>Show late</button
  >{#each rows as row (row.id)}
    <Tip label={row.label} />
  {/each}{#if late}
    {#if mounted}
      <p {@attach teleport("body")} data-teleported="true" class="tip" role="note">Late tip</p>
    {/if}
  {/if}<Card>
    {#if mounted}
      <div {@attach teleport("body")} data-teleported="true" class="slotted">Slotted</div>
    {/if}
  </Card>
</section>
