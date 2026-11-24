<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface BallotProps {
    limit: number;
    label?: string;
    choices: string[];
  }
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    | "limit"
    | "label"
    | "choices"
    | "onvoted"
    | "onmoved"
    | "onreport"
    | "oncounted"
    | "children"
    | "class"
    | "style"
    | "ref"
  > &
    BallotProps & {
      onvoted?: (remaining: number, text: string) => void;
      onmoved?: (line: string) => void;
      onreport?: (text: string) => void;
      oncounted?: (answers: number) => void;
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let {
    limit,
    label = "Vote",
    choices,
    onvoted,
    onmoved,
    onreport,
    oncounted,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  let votes = $state(untrack(() => limit));
  let picked = $state("none");
  let remaining = untrack(() => limit);
  let text = untrack(() => `${label} (${limit})`);
  let lastVotes = untrack(() => votes);

  function isAnswer(value: string): value is "yes" | "no" {
    return value === "yes" || value === "no";
  }

  function describe(): string {
    const line = `${picked} with ${votes} left`;
    return line;
  }

  $effect(() => {
    onreport?.(describe());
  });

  let previousVotesPicked = untrack((): [typeof votes, typeof picked] => [votes, picked]);
  $effect.pre(() => {
    const values: [typeof votes, typeof picked] = [votes, picked];
    if (values.every((value, index) => Object.is(value, previousVotesPicked[index]))) return;
    const [lastCount, lastPick] = previousVotesPicked;
    previousVotesPicked = values;
    untrack(() => {
      const [nextVotes, nextPicked]: [number, string] = values;
      onmoved?.(`${lastPick}:${lastCount}>${nextPicked}:${nextVotes}`);
    });
  });

  function vote(choice: string) {
    if (remaining > 0) remaining -= 1;
    text = `${text}!`;
    lastVotes = votes;
    votes -= 1;
    picked = isAnswer(choice) ? choice : "other";
    onvoted?.(remaining, `${text} ${lastVotes}`);
  }

  function count() {
    let answers = 0;
    choices.forEach((choice) => isAnswer(choice) && answers++);
    oncounted?.(answers);
  }
</script>

<section class={["ballot", className]} aria-label={label} {style} bind:this={ref} {...attributes}>
  <p role="status">{votes} votes left</p
  ><p>Picked: {picked}</p
  ><ul aria-label="Choices">
    {#each choices as choice (choice)}
      <li>
        <button type="button" onclick={() => vote(choice)}>{choice}</button>
      </li>
    {/each}
  </ul
  ><button type="button" onclick={count}>Count the answers</button>
</section>
