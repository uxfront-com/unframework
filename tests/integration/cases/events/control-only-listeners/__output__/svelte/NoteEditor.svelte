<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  type Props = { onsaved?: (title: string, bold: boolean) => void };

  let { onsaved }: Props = $props();

  let title = $state("");
  let bold = $state(false);
  let saves = $state(0);

  function save() {
    saves += 1;
    onsaved?.(title, bold);
  }
</script>

<form class="note-editor" aria-label="Note" onsubmit={(event) => event.preventDefault()}>
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
