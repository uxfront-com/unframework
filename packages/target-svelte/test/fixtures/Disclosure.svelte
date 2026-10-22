<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { tick } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = {
    ontoggled?: (items: number) => void;
    class?: ClassValue;
    style?: string;
  };

  let { ontoggled, class: className, style, ...attributes }: Props = $props();

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

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section aria-label="Details" class={className} {style} {...scopeAttributes(attributes)}>
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
