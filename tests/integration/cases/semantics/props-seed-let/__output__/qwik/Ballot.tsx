import { $, type QRL, component$, useSignal, useTask$, useVisibleTask$ } from "@qwik.dev/core";

export interface BallotProps {
  limit: number;
  label?: string;
  choices: string[];
}

export interface BallotEvents {
  onVoted$?: QRL<(remaining: number, text: string) => void>;
  onMoved$?: QRL<(line: string) => void>;
  onReport$?: QRL<(text: string) => void>;
  onCounted$?: QRL<(answers: number) => void>;
}

function isAnswer(value: string): value is "yes" | "no" {
  return value === "yes" || value === "no";
}

export default component$<BallotProps & BallotEvents>(
  ({ limit, label = "Vote", choices, onVoted$, onMoved$, onReport$, onCounted$ }) => {
    const votes = useSignal(limit);
    const picked = useSignal("none");
    const remaining = useSignal(limit);
    const text = useSignal(`${label} (${limit})`);
    const lastVotes = useSignal(votes.value);

    const previousEffect = useSignal<[typeof picked.value, typeof votes.value]>();
    useVisibleTask$(
      ({ track }) => {
        const values: [typeof picked.value, typeof votes.value] = [track(picked), track(votes)];
        const last = previousEffect.value;
        if (last && values.every((item, index) => Object.is(item, last[index]))) return;
        previousEffect.value = values;
        function describe(): string {
          const line = `${picked.value} with ${votes.value} left`;
          return line;
        }

        onReport$?.(describe());
      },
      { strategy: "document-ready" },
    );

    const previousValues = useSignal<[typeof votes.value, typeof picked.value]>(() => [
      votes.value,
      picked.value,
    ]);
    useTask$(
      ({ track }) => {
        const values: [typeof votes.value, typeof picked.value] = [track(votes), track(picked)];
        const [lastCount, lastPick] = previousValues.value;
        if (values.every((item, index) => Object.is(item, previousValues.value[index]))) return;
        previousValues.value = values;
        const [nextVotes, nextPicked] = values;
        onMoved$?.(`${lastPick}:${lastCount}>${nextPicked}:${nextVotes}`);
      },
      { deferUpdates: false },
    );

    const vote = $((choice: string) => {
      if (remaining.value > 0) remaining.value -= 1;
      text.value = `${text.value}!`;
      lastVotes.value = votes.value;
      votes.value -= 1;
      picked.value = isAnswer(choice) ? choice : "other";
      onVoted$?.(remaining.value, `${text.value} ${lastVotes.value}`);
    });

    const count = $(() => {
      let answers = 0;
      choices.forEach((choice) => isAnswer(choice) && answers++);
      onCounted$?.(answers);
    });

    return (
      <section class="ballot" aria-label={label}>
        <p role="status">{votes.value} votes left</p>
        <p>Picked: {picked.value}</p>
        <ul aria-label="Choices">
          {choices.map((choice) => (
            <li key={choice}>
              <button type="button" onClick$={() => vote(choice)}>
                {choice}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick$={count}>
          Count the answers
        </button>
      </section>
    );
  },
);
