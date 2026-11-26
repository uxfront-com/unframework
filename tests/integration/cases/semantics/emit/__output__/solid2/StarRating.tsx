import { KeyedFor } from "./_unframework/KeyedFor";
import { createState } from "./_unframework/createState";
import { enumeratedValue } from "./_unframework/enumeratedValue";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface StarRatingEvents {
  onPreview?: (stars: number) => void;
  onRate?: (stars: number, previous: number) => void;
  onCleared?: () => void;
}

const choices = [1, 2, 3, 4, 5];

export default function StarRating(
  props: StarRatingEvents &
    Omit<ComponentProps<"div">, "class" | "style"> & { class?: string; style?: JSX.CSSProperties },
) {
  const others = omit(props, "onPreview", "onRate", "onCleared", "class");

  const [stars, setStars] = createState(0);

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
      {...others}
    >
      <ul>
        <KeyedFor each={choices} by={(choice) => choice}>
          {(choice) => (
            <li>
              <button
                type="button"
                aria-pressed={enumeratedValue(stars() >= choice.value)}
                onClick={() => choose(choice.value)}
              >
                {choice.value} {choice.value === 1 ? "star" : "stars"}
              </button>
            </li>
          )}
        </KeyedFor>
      </ul>
      <p role="status">{stars()} of 5</p>
      <button type="button" onClick={clear}>
        Clear
      </button>
    </div>
  );
}
