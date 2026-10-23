<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";
  import { on } from "svelte/events";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let log = $state.raw<string[]>([]);
  let volume = $state(5);

  function record(line: string) {
    log = [...log, line];
  }

  function changeVolume(event: WheelEvent) {
    if (event.deltaY < 0) {
      volume += 1;
    } else {
      volume -= 1;
    }
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

<section
  class={["event-log", className]}
  aria-label="Event options"
  {style}
  {...scopeAttributes(attributes)}
>
  <div
    class="panel"
    role="presentation"
    onclickcapture={() => record("panel capture")}
    onclick={() => record("panel bubble")}
  >
    <button type="button" onclick={() => record("button")}>Inside</button
    ><button
      type="button"
      onclick={(event) => {
        event.stopPropagation();
        record("stopped");
      }}
    >Stop here</button>
  </div
  ><button
    type="button"
    {@attach (node) => on(node, "click", once(() => record("once")))}
  >Only once</button
  ><div class="reward" role="presentation" onclick={() => record("outer")}>
    <button
      type="button"
      {@attach (node) => on(node, "click", once((event) => {
        event.stopPropagation();
        record("claimed");
      }))}
    >Claim the reward</button>
  </div
  ><div
    class="volume"
    role="group"
    aria-label="Volume"
    {@attach (node) => on(node, "wheel", changeVolume, { passive: true })}
  >
    <output>{volume}</output>
  </div
  ><ol aria-label="Log">
    {#each log as entry, index (index)}
      <li>{entry}</li>
    {/each}
  </ol>
</section>
