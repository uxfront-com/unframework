<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount, untrack } from "svelte";

  type Props = {
    onsave?: (count: number) => void;
    onstatus?: (value: string) => void;
    onclosed?: (reason: string) => void;
    onkey?: (key: string) => void;
  };

  let { onsave, onstatus, onclosed, onkey }: Props = $props();

  let open = $state(false);
  let status = $state("draft");
  let saves = $state(0);
  let log = $state.raw<string[]>([]);
  let handle: HTMLButtonElement | null = null;
  let handleElement: HTMLButtonElement | null = null;

  function record(line: string) {
    log = [...log, line];
  }

  function onKey(event: KeyboardEvent) {
    record(`key ${event.key}`);
    onkey?.(event.key);
  }

  function close(reason: string) {
    open = false;
    document.removeEventListener("keydown", onEscape);
    onclosed?.(reason);
  }

  function onEscape(event: KeyboardEvent) {
    if (event.key === "Escape") close("escape");
  }

  function show() {
    open = true;
    document.addEventListener("keydown", onEscape);
  }

  function onHandleClick() {
    record("handle");
  }

  function save() {
    saves += 1;
    status = "saved";
    onsave?.(saves);
  }

  function stop() {
    document.removeEventListener("keydown", onEscape);
    document.removeEventListener("keydown", onKey);
    handleElement?.removeEventListener("click", onHandleClick);
  }

  let previousStatus = untrack(() => status);
  $effect.pre(() => {
    const value = status;
    if (Object.is(value, previousStatus)) return;
    previousStatus = value;
    untrack(() => {
      onstatus?.(value);
    });
  });

  onMount(() => {
    handleElement = handle;
    handleElement?.addEventListener("click", onHandleClick);
  });

  onMount(() => () => {
    stop();
  });
</script>

<section class="draft-panel" aria-label="Draft">
  <button type="button" aria-expanded={open} onclick={show}>Options</button
  >{#if open}
    <div class="options" role="group" aria-label="Draft options">
      <button type="button" onclick={() => close("button")}>Close</button>
    </div>
  {/if}<button type="button" onclick={() => document.addEventListener("keydown", onKey)}>Listen</button
  ><button
    type="button"
    onclick={() => document.removeEventListener("keydown", onKey)}
  >Stop listening</button
  ><button type="button" bind:this={handle}>Handle</button
  ><button type="button" onclick={save}>Save</button
  ><p role="status">{open ? "Options open" : "Options closed"}, {status}</p
  ><ol aria-label="Log">
    {#each log as line, index (index)}
      <li>{line}</li>
    {/each}
  </ol>
</section>
