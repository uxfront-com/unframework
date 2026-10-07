<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { on } from "svelte/events";

  let started = $state(false);
  let suggesting = $state(false);
  let accepted = $state(0);

  function accept(event: KeyboardEvent) {
    event.preventDefault();
    suggesting = false;
    accepted += 1;
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

<section class="reply-box" aria-label="Reply">
  <label>Message<textarea
    name="message"
    {@attach (node) => on(node, "keydown", once((event) => {
      if (event.key === "Enter") event.preventDefault();
      started = true;
    }))}
  ></textarea></label
  ><p>{started ? "Started" : "Not started"}</p
  ><label>Answer<textarea
    name="answer"
    onkeydown={(event) => {
      if (suggesting && event.key === "Enter") accept(event);
    }}
  ></textarea></label
  ><button
    type="button"
    aria-pressed={suggesting}
    onclick={() => (suggesting = !suggesting)}
  >Suggestions</button
  ><p>Accepted: {accepted}</p>
</section>
