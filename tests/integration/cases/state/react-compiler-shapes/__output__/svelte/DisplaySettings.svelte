<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export interface Settings {
    theme: string;
    size: number;
  }

  interface SaveReply {
    id?: number;
    error?: string;
  }

  type Props = {
    onapplied?: (theme: string, size: number) => void;
    onsaved?: (id: number) => void;
  };

  let { onapplied, onsaved }: Props = $props();

  let settings = $state.raw<Settings>({ theme: "light", size: 14 });
  let maxSize = $state(20);
  let saving = $state(false);
  let label = $state("Never saved");
  let failure = $state("");
  let finish: ((reply: SaveReply) => void) | undefined;

  function apply(patch: Partial<Settings>) {
    const { theme = settings.theme, size = settings.size } = patch;
    settings = { theme, size };
    onapplied?.(theme, size);
  }

  function grow() {
    const clamp = (value: number, max = maxSize) => Math.min(value, max);
    apply({ size: clamp(settings.size + 4) });
  }

  async function save() {
    saving = true;
    failure = "";
    try {
      const reply = await new Promise<SaveReply>((resolve) => {
        finish = resolve;
      });
      if (reply.error) throw new Error(reply.error);
      const id = reply.id ?? 0;
      label = id === 0 ? "Saved as a draft" : `Saved as #${id}`;
      onsaved?.(id);
    } catch (error) {
      failure = error instanceof Error ? error.message : "Saving failed";
    } finally {
      saving = false;
    }
  }
</script>

<section class="display-settings" aria-label="Display">
  <p role="status">Theme {settings.theme}, size {settings.size}</p
  ><button type="button" onclick={() => apply({ theme: "dark" })}>Dark</button
  ><button type="button" onclick={grow}>Larger</button
  ><button type="button" onclick={() => (maxSize = 30)}>Allow up to 30</button
  ><button type="button" onclick={save}>Save</button
  ><p>{saving ? "Saving" : failure === "" ? label : `Failed: ${failure}`}</p
  ><div role="group" aria-label="Server">
    <button type="button" onclick={() => finish?.({ id: 7 })}>Reply with an id</button
    ><button type="button" onclick={() => finish?.({})}>Reply as a draft</button
    ><button
      type="button"
      onclick={() => finish?.({ error: "Disk full" })}
    >Reply with an error</button>
  </div>
</section>
