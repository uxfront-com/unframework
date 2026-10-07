<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { tick } from "svelte";

  type Props = { ontoggled?: (items: number) => void };

  let { ontoggled }: Props = $props();

  let open = $state(false);
  let field: HTMLInputElement | null = null;
  let panel = $state<HTMLUListElement | null>(null);
  const uid = $props.id();
  const fieldId = `uf-id-${uid}-0`;
  const panelId = `uf-id-${uid}-1`;
  let shown: HTMLUListElement | null = null;

  async function toggle() {
    open = !open;
    await tick();
    const input: HTMLInputElement | null = field;
    input?.focus();
    shown = panel;
    ontoggled?.(shown?.childElementCount ?? 0);
  }
</script>

<section aria-label="Details">
  <label for={fieldId}>Name</label><input id={fieldId} bind:this={field}
  /><button
    type="button"
    aria-controls={panelId}
    aria-expanded={open}
    onclick={toggle}
  >Toggle</button
  >{#if open}
    <ul id={panelId} bind:this={panel}>
      <li>One</li
      ><li>Two</li>
    </ul>
  {/if}
</section>
