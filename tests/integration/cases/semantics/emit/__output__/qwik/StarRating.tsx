import {
  $,
  type CSSProperties,
  type ClassList,
  type QRL,
  component$,
  useSignal,
} from "@qwik.dev/core";

export interface StarRatingEvents {
  onPreview$?: QRL<(stars: number) => void>;
  onRate$?: QRL<(stars: number, previous: number) => void>;
  onCleared$?: QRL<() => void>;
}

const choices = [1, 2, 3, 4, 5];

export default component$<StarRatingEvents & { class?: ClassList; style?: CSSProperties }>(
  ({ onPreview$, onRate$, onCleared$, class: className, style, ...attributes }) => {
    const stars = useSignal(0);

    const choose = $((next: number) => {
      const previous = stars.value;
      onPreview$?.(next);
      stars.value = next;
      onRate$?.(stars.value, previous);
    });

    const clear = $(() => {
      for (let star = stars.value - 1; star >= 0; star--) {
        onPreview$?.(star);
      }
      stars.value = 0;
      onCleared$?.();
    });

    return (
      <div
        class={["star-rating", className]}
        role="group"
        aria-label="Rating"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <ul>
          {choices.map((choice) => (
            <li key={choice}>
              <button
                type="button"
                aria-pressed={stars.value >= choice}
                onClick$={() => choose(choice)}
              >
                {choice} {choice === 1 ? "star" : "stars"}
              </button>
            </li>
          ))}
        </ul>
        <p role="status">{stars.value} of 5</p>
        <button type="button" onClick$={clear}>
          Clear
        </button>
      </div>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
