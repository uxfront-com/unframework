<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount } from "svelte";
  import type { ClassValue } from "svelte/elements";

  interface Row {
    id: number;
    label: string;
  }

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let note = $state(false);
  let extras = $state.raw<string[]>([]);

  let rows = $state.raw<Row[]>([
    { id: 1, label: "Alpha" },
    { id: 2, label: "Beta" },
  ]);

  function addExtra() {
    extras = [...extras, `Extra ${extras.length + 1}`];
  }

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

<section class={["panel", className]} aria-label="Panel" {style} {...scopeAttributes(attributes)}>
  <button type="button" onclick={() => (note = true)}>Show note</button
  ><button type="button" onclick={addExtra}>Add extra</button
  ><button type="button" onclick={() => (rows = [...rows].reverse())}>Reverse rows</button
  >{#if note}
    <p class="note">Note</p>
  {/if}{#each extras as extra (extra)}
    <span>{extra}</span>
  {/each}{#if mounted}
    <div {@attach teleport("body")} data-teleported="true" class="first">First</div>
  {/if}{#if mounted}
    <div {@attach teleport("body")} data-teleported="true" class="second">Second</div>
  {/if}<ul>
    {#each rows as row (row.id)}
      <li>{row.label}{#if mounted}<p
        {@attach teleport("body")}
        data-teleported="true"
        class="tip"
      >{row.label} tip</p>{/if}</li>
    {/each}
  </ul>
</section>
