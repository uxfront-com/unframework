import { For, type JSX, createSignal } from "solid-js";

export interface StarRatingEvents {
  onPreview?: (stars: number) => void;
  onRate?: (stars: number, previous: number) => void;
  onCleared?: () => void;
}

const choices = [1, 2, 3, 4, 5];

export default function StarRating(
  props: StarRatingEvents & { class?: string; style?: JSX.CSSProperties },
) {
  const [stars, setStars] = createSignal(0);

  function choose(next: number) {
    const previous = stars();
    props.onPreview?.(next);
    setStars(next);
    props.onRate?.(stars(), previous);
  }

  function clear() {
    for (let star = stars() - 1; star >= 0; star--) {
      props.onPreview?.(star);
    }
    setStars(0);
    props.onCleared?.();
  }

  return (
    <div
      class={props.class ? `star-rating ${props.class}` : "star-rating"}
      role="group"
      aria-label="Rating"
      style={props.style}
    >
      <ul>
        <For each={choices}>
          {(choice) => (
            <li>
              <button type="button" aria-pressed={stars() >= choice} onClick={() => choose(choice)}>
                {choice} {choice === 1 ? "star" : "stars"}
              </button>
            </li>
          )}
        </For>
      </ul>
      <p role="status">{stars()} of 5</p>
      <button type="button" onClick={clear}>
        Clear
      </button>
    </div>
  );
}
