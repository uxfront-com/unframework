<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, HTMLFormAttributes } from "svelte/elements";

  type Props = Omit<HTMLFormAttributes, "ontagschange" | "children" | "class" | "style" | "ref"> & {
    ontagschange?: (tags: string[]) => void;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["form"] | null;
  };

  let {
    ontagschange,
    class: className,
    style,
    ref = $bindable(null),
    onsubmit,
    ...attributes
  }: Props = $props();

  let tags = $state.raw<string[]>([]);
  let draft = $state("");
  let helpOpen = $state(false);
  let field: HTMLInputElement | null = null;

  function blockComma(event: KeyboardEvent) {
    if (event.key === ",") event.preventDefault();
  }

  function updateDraft(event: Event) {
    draft = (event.currentTarget as HTMLInputElement).value;
  }

  function addTag(event: SubmitEvent) {
    event.preventDefault();
    if (draft !== "" && !tags.includes(draft)) {
      tags = [...tags, draft];
      ontagschange?.(tags);
    }
    draft = "";
    const input = field;
    if (input) input.value = "";
  }

  function toggleHelp(event: MouseEvent) {
    event.preventDefault();
    helpOpen = !helpOpen;
  }
</script>

<form
  class={["tag-form", className]}
  aria-label="Tags"
  onsubmit={(event) => {
    addTag(event);
    onsubmit?.(event);
  }}
  {style}
  bind:this={ref}
  {...attributes}
>
  <label>New tag<input name="tag" bind:this={field} onkeydown={blockComma} oninput={updateDraft} /></label
  ><button type="submit">Add tag</button><a href="/help/tags" onclick={toggleHelp}>How tags work</a
  >{#if helpOpen}
    <p>A tag is one word: commas are not allowed.</p>
  {/if}<ul aria-label="Added tags">
    {#each tags as tag (tag)}
      <li>{tag}</li>
    {/each}
  </ul>
</form>
