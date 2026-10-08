import { useEffect, useEffectEvent, useRef, useState } from "react";

export interface BallotProps {
  limit: number;
  label?: string;
  choices: string[];
}

export interface BallotEvents {
  onVoted?: (remaining: number, text: string) => void;
  onMoved?: (line: string) => void;
  onReport?: (text: string) => void;
  onCounted?: (answers: number) => void;
}

function isAnswer(value: string): value is "yes" | "no" {
  return value === "yes" || value === "no";
}

export default function Ballot({
  limit,
  label = "Vote",
  choices,
  onVoted,
  onMoved,
  onReport,
  onCounted,
}: BallotProps & BallotEvents) {
  const [votes, setVotes] = useState(limit);
  const votesRef = useRef(votes);
  const [picked, setPicked] = useState("none");
  const pickedRef = useRef(picked);
  const remaining = useRef(limit);
  const text = useRef(`${label} (${limit})`);
  const lastVotes = useRef(votes);

  function describe(): string {
    const line = `${pickedRef.current} with ${votesRef.current} left`;
    return line;
  }

  const onVotesPickedChange = useEffectEvent((_votes: typeof votes, _picked: typeof picked) => {
    onReport?.(describe());
  });
  useEffect(() => {
    onVotesPickedChange(votes, picked);
  }, [votes, picked]);

  const previousVotesPicked = useRef<[typeof votes, typeof picked]>([votes, picked]);
  const onVotesPickedChange_1 = useEffectEvent(
    (
      [nextVotes, nextPicked]: [number, string],
      [lastCount, lastPick]: [typeof votes, typeof picked],
    ) => {
      onMoved?.(`${lastPick}:${lastCount}>${nextPicked}:${nextVotes}`);
    },
  );
  useEffect(() => {
    const previous = previousVotesPicked.current;
    if (Object.is(previous[0], votes) && Object.is(previous[1], picked)) return;
    previousVotesPicked.current = [votes, picked];
    onVotesPickedChange_1([votes, picked], previous);
  }, [votes, picked]);

  function vote(choice: string) {
    if (remaining.current > 0) remaining.current -= 1;
    text.current = `${text.current}!`;
    lastVotes.current = votesRef.current;
    votesRef.current -= 1;
    setVotes(votesRef.current);
    pickedRef.current = isAnswer(choice) ? choice : "other";
    setPicked(pickedRef.current);
    onVoted?.(remaining.current, `${text.current} ${lastVotes.current}`);
  }

  function count() {
    let answers = 0;
    choices.forEach((choice) => isAnswer(choice) && (answers += 1));
    onCounted?.(answers);
  }

  return (
    <section className="ballot" aria-label={label}>
      <p role="status">{votes} votes left</p>
      <p>Picked: {picked}</p>
      <ul aria-label="Choices">
        {choices.map((choice) => (
          <li key={choice}>
            <button type="button" onClick={() => vote(choice)}>
              {choice}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={count}>
        Count the answers
      </button>
    </section>
  );
}
