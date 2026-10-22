<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { tick } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = {
    onsaved?: (attempt: number, status: string) => void;
    class?: ClassValue;
    style?: string;
  };

  let { onsaved, class: className, style, ...attributes }: Props = $props();

  let status = $state("Not saved");
  let attempts = $state(0);

  async function save() {
    status = "Saving";
    attempts += 1;
    await Promise.resolve();
    status = "Checking";
    await tick();
    status = `Saved, attempt ${attempts}`;
    onsaved?.(attempts, status);
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["save-draft", className]}
  aria-label="Draft"
  {style}
  {...scopeAttributes(attributes)}
>
  <p role="status">{status}</p
  ><button type="button" onclick={save}>Save the draft</button>
</section>
