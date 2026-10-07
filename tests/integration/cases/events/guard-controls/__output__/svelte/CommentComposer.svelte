<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { on } from "svelte/events";

  type Props = {
    onsent?: (text: string) => void;
    onsaved?: (count: number) => void;
    onfirstsave?: () => void;
  };

  let { onsent, onsaved, onfirstsave }: Props = $props();

  let tags = $state.raw<string[]>([]);
  let query = $state("");
  let panelOpen = $state(true);
  let confirming = $state(true);
  let tipShown = $state(true);
  let saves = $state(0);
  let log = $state.raw<string[]>([]);
  let finishUpload: (() => void) | undefined;

  function record(line: string) {
    log = [...log, line];
  }

  function send(event: KeyboardEvent) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    onsent?.((event.target as HTMLTextAreaElement).value);
  }

  function addTag(event: KeyboardEvent) {
    event.preventDefault();
    const field = event.target as HTMLInputElement;
    if (field.value === "" || tags.includes(field.value)) return;
    tags = [...tags, field.value];
    field.value = "";
  }

  function clearSearch(event: KeyboardEvent) {
    event.stopPropagation();
    query = "";
    (event.target as HTMLInputElement).value = "";
  }

  function dismiss(event: MouseEvent) {
    event.stopPropagation();
    confirming = false;
    record("dismissed");
  }

  function once<E extends Event>(handler: (event: E) => unknown): (event: E) => void {
    let ran = false;
    return (event) => {
      if (ran) return;
      ran = true;
      handler(event);
    };
  }
</script>

<section class="comment-composer" aria-label="Composer">
  <label>Comment<textarea name="comment" onkeydown={send}></textarea></label
  ><form
    aria-label="Tags"
    onsubmit={(event) => {
      event.preventDefault();
      record("tags submitted");
    }}
  >
    <label>Tag<input
      name="tag"
      onkeydown={(event) => {
        if (event.key !== "Enter") return;
        addTag(event);
      }}
    /></label
    ><button type="submit">Save tags</button>
  </form
  ><ul aria-label="Tag list">
    {#each tags as tag (tag)}
      <li>{tag}</li>
    {/each}
  </ul
  ><label>Code<input
    name="code"
    onkeydown={(event) => {
      if (event.key.length === 1 && (event.target as HTMLInputElement).value.length >= 4)
        event.preventDefault();
    }}
  /></label
  ><div
    class="panel"
    role="presentation"
    onkeydown={(event) => {
      if (event.key === "Escape") panelOpen = false;
    }}
  >
    <label>Search<input
      name="search"
      oninput={(event) => (query = (event.currentTarget as HTMLInputElement).value)}
      onkeydown={(event) => {
        if (event.key === "Escape" && (event.target as HTMLInputElement).value !== "")
          clearSearch(event);
      }}
    /></label
    ><p>{panelOpen ? `Searching for: ${query}` : "Panel closed"}</p>
  </div
  ><div class="page" role="presentation" onclick={() => record("page")}>
    {#if tipShown}
      <div
        class="tip"
        role="presentation"
        style="padding: 12px"
        onclick={(event) => {
          if (event.target !== event.currentTarget) return;
          event.stopPropagation();
          tipShown = false;
        }}
      >Click here to hide this tip.<button
        type="button"
        onclick={() => record("tip button")}
      >More tips</button></div>
    {/if}{#if confirming}
      <div
        class="backdrop"
        role="presentation"
        data-testid="backdrop"
        style="padding: 24px"
        onclick={(event) => {
          if (event.target === event.currentTarget) dismiss(event);
        }}
      >
        <div role="dialog" aria-label="Discard draft">
          <p>Discard this draft?</p
          ><button type="button" onclick={() => record("kept")}>Keep</button>
        </div>
      </div>
    {:else}
      <p>Draft dismissed</p>
    {/if}
  </div
  ><button
    type="button"
    {@attach (node) => on(node, "click", () => {
      if (tags.length === 0) return;
      saves += 1;
      onsaved?.(saves);
    })}
    {@attach (node) => on(node, "click", once(() => onfirstsave?.()))}
  >Save</button
  ><button
    type="button"
    {@attach (node) => on(node, "click", async () => {
      record("upload started");
      await new Promise<void>((resolve) => {
        finishUpload = resolve;
      });
      record("upload finished");
    })}
    {@attach (node) => on(node, "click", once(() => record("first upload")))}
  >Upload</button
  ><button type="button" onclick={() => finishUpload?.()}>Finish upload</button
  ><ol aria-label="Log">
    {#each log as line, index (index)}
      <li>{line}</li>
    {/each}
  </ol>
</section>
