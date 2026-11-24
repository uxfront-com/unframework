<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, HTMLFormAttributes } from "svelte/elements";

  type Props = Omit<HTMLFormAttributes, "onsaved" | "children" | "class" | "style" | "ref"> & {
    onsaved?: (title: string, bold: boolean) => void;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["form"] | null;
  };

  let {
    onsaved,
    class: className,
    style,
    ref = $bindable(null),
    onsubmit,
    ...attributes
  }: Props = $props();

  let title = $state("");
  let bold = $state(false);
  let saves = $state(0);

  function save() {
    saves += 1;
    onsaved?.(title, bold);
  }
</script>

<form
  class={["note-editor", className]}
  aria-label="Note"
  onsubmit={(event) => {
    event.preventDefault();
    onsubmit?.(event);
  }}
  {style}
  bind:this={ref}
  {...attributes}
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
