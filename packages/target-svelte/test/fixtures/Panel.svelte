<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";
  import { on } from "svelte/events";

  type Props = {
    class?: ClassValue;
    style?: string;
  };

  let { class: className, style, ...attributes }: Props = $props();

  let log = $state.raw<string[]>([]);
  let draft = $state("");

  function record(line: string) {
    log = [...log, line];
  }

  function updateDraft(event: Event) {
    draft = (event.currentTarget as HTMLInputElement).value;
  }

  function pressed(event: MouseEvent) {
    record(`button ${event.button}`);
  }

  function once<E extends Event>(handler: (event: E) => unknown): (event: E) => void {
    let ran = false;
    return (event) => {
      if (ran) return;
      ran = true;
      handler(event);
    };
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div
  role="presentation"
  onclickcapture={() => record("capture")}
  onclick={() => record("bubble")}
  class={className}
  {style}
  {...scopeAttributes(attributes)}
>
  <button
    type="button"
    {@attach (node) => on(node, "click", pressed)}
    {@attach (node) => on(node, "click", once(() => record("once")))}
  >Go</button
  ><button
    type="button"
    onclick={pressed}
    {@attach (node) => on(node, "touchstart", () => record("touch"))}
  >Touch</button
  ><input
    aria-label="Draft"
    oninput={updateDraft}
    onkeydown={(event) => event.key === "Enter" && record(draft)}
  /><section role="presentation" {@attach (node) => on(node, "click", once(() => record("claimed")))}>
    <button
      type="button"
      onclick={(event) => {
        event.stopPropagation();
        record("stopped");
      }}
    >Stop</button
    ><button type="button" onclick={() => record("passed")}>Pass</button>
  </section
  ><div
    role="presentation"
    {@attach (node) => on(node, "wheel", (event) => record(`wheel ${event.deltaY}`), { passive: true })}
    {@attach (node) => on(node, "animationcancel", () => record("cancelled"))}
  >
    <p>{log.join(", ")}</p>
  </div>
</div>
