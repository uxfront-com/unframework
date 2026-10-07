<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { on } from "svelte/events";

  type Props = { onfirstnickname?: (nickname: string) => void };

  let { onfirstnickname }: Props = $props();

  let log = $state.raw<string[]>([]);
  let nickname = $state("");
  let cardFocuses = $state(0);
  let cardBlurs = $state(0);

  function record(line: string) {
    log = [...log, line];
  }

  function hold(event: MouseEvent) {
    event.preventDefault();
    record("locked click");
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

<section class="profile-fields" aria-label="Profile">
  <div
    class="name-group"
    role="group"
    aria-label="Name fields"
    onfocusin={() => record("group focusin")}
    onfocusout={() => record("group focusout")}
  >
    <label>Name<input
      name="name"
      onfocus={() => record("name focus")}
      onblur={() => record("name blur")}
    /></label>
  </div
  ><label>Nickname<input
    name="nickname"
    {@attach (node) => on(node, "change", (event) => (nickname = (event.currentTarget as HTMLInputElement).value))}
    {@attach (node) => on(node, "change", once((event) => onfirstnickname?.((event.currentTarget as HTMLInputElement).value)))}
  /></label
  ><p>Nickname: {nickname}</p
  ><label><input
    type="checkbox"
    name="public"
    onclick={() => record("public click")}
    oninput={() => record("public input")}
    onchange={() => record("public change")}
  />Public profile</label
  ><label><input
    type="checkbox"
    name="locked"
    onclick={hold}
    onchange={() => record("locked change")}
  />Locked</label
  ><div
    class="card"
    role="group"
    aria-label="Card"
    tabindex="-1"
    onfocus={() => cardFocuses++}
    onblur={() => cardBlurs++}
  >
    <p>{cardFocuses > cardBlurs ? "Card focused" : "Card not focused"}</p
    ><p>Card blurs: {cardBlurs}</p
    ><button type="button" onclick={() => record("card button")}>Inside the card</button>
  </div
  ><ol aria-label="Log">
    {#each log as entry, index (index)}
      <li>{entry}</li>
    {/each}
  </ol>
</section>
