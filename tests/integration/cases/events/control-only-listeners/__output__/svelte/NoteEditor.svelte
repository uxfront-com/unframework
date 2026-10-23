<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = {
    onsaved?: (title: string, bold: boolean) => void;
    class?: ClassValue;
    style?: string;
  };

  let { onsaved, class: className, style, ...attributes }: Props = $props();

  let title = $state("");
  let bold = $state(false);
  let saves = $state(0);

  function save() {
    saves += 1;
    onsaved?.(title, bold);
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<form
  class={["note-editor", className]}
  aria-label="Note"
  onsubmit={(event) => event.preventDefault()}
  {style}
  {...scopeAttributes(attributes)}
>
  <label>Title<input
    name="title"
    oninput={(event) => (title = (event.currentTarget as HTMLInputElement).value)}
  /></label
  ><label>Text<textarea name="text"></textarea></label
  ><div class="format" role="group" aria-label="Format">
    <button
      type="button"
      aria-pressed={bold}
      onmousedown={(event) => event.preventDefault()}
      onclick={() => (bold = !bold)}
    >Bold</button>
  </div
  ><button type="submit" onclick={save}>Save</button
  ><p role="status">Saves: {saves}</p>
</form>
