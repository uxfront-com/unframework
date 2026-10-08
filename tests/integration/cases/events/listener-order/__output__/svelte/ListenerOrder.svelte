<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { on } from "svelte/events";

  let log = $state.raw<string[]>([]);
  let resets = $state(0);

  function record(line: string) {
    log = [...log, line];
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

<section class="listener-order" aria-label="Listener order">
  <div class="toolbar" role="presentation" onclick={() => record("toolbar")}>
    <button
      type="button"
      {@attach (node) => on(node, "click", () => record("save"))}
      {@attach (node) => on(node, "click", once(() => record("first save")))}
    >Save</button
    ><button
      type="button"
      {@attach (node) => on(node, "click", once(() => record("first send")))}
      {@attach (node) => on(node, "click", () => record("send"))}
    >Send</button
    ><button
      type="button"
      {@attach (node) => on(node, "click", () => record("reset"))}
      {@attach (node) => on(node, "click", once(() => (resets += 1)))}
    >Reset</button>
  </div
  ><div
    class="panel"
    role="presentation"
    onclickcapture={() => record("panel capture")}
    onclick={(event) => {
      event.stopPropagation();
      record("panel bubble");
    }}
  >
    <button type="button" onclick={() => record("inside")}>Inside</button>
  </div
  ><button type="button" onclick={() => record("outside")}>Outside</button
  ><div
    class="claim"
    role="presentation"
    {@attach (node) => on(node, "click", once(() => record("claim once")))}
  >
    <button
      type="button"
      onclick={(event) => {
        event.stopPropagation();
        record("stopped");
      }}
    >Stop</button
    ><button type="button" onclick={() => record("pass")}>Pass</button>
  </div
  ><div
    class="outer-zone"
    role="group"
    aria-label="Outer zone"
    onwheel={() => record("outer wheel")}
  >
    <div
      class="inner-zone"
      role="group"
      aria-label="Inner zone"
      {@attach (node) => on(node, "wheel", () => record("inner wheel"), { passive: true })}
    >Scroll here</div>
  </div
  ><p>Resets: {resets}</p
  ><ol aria-label="Log">
    {#each log as entry, index (index)}
      <li>{entry}</li>
    {/each}
  </ol>
</section>
