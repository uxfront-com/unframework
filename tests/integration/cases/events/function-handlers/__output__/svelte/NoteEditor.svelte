<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  type Props = { onsaved?: (count: number) => void; ontagged?: (tag: string, via: string) => void };

  let { onsaved, ontagged }: Props = $props();

  let saves = $state(0);
  let lastKey = $state("none");
  let tags = $state.raw<string[]>([]);
  let tag = $state("");
  let tagField: HTMLInputElement | null = null;

  function save() {
    saves += 1;
    onsaved?.(saves);
  }

  function recordKey(event: KeyboardEvent) {
    lastKey = event.key;
  }

  function addTag(event: MouseEvent | KeyboardEvent) {
    if (tag === "") return;
    tags = [...tags, tag];
    ontagged?.(tag, event.type);
    tag = "";
    if (tagField) tagField.value = "";
  }

  function onTagKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") addTag(event);
  }
</script>

<section class="note-editor" aria-label="Note">
  <button type="button" onclick={save}>Save</button
  ><label>Title<input name="title" onkeydown={recordKey} /></label
  ><label>Body<textarea name="body" onkeydown={recordKey}></textarea></label
  ><p role="status">Saved {saves} times, last key {lastKey}</p
  ><button type="button" onclick={save}>Save and close</button
  ><label>Tag<input
    bind:this={tagField}
    name="tag"
    oninput={(event) => (tag = (event.currentTarget as HTMLInputElement).value)}
    onkeydown={onTagKeydown}
  /></label
  ><button type="button" onclick={addTag}>Add tag</button
  ><p>Tags: {tags.join(", ")}</p>
</section>
