import { type Accessor, For, type JSX, createMemo, createSignal, untrack } from "solid-js";

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
      {...scopeAttributes(props)}
    >
      <ul>
        <KeyedFor each={choices} by={(choice) => choice}>
          {(choice) => (
            <li>
              <button
                type="button"
                aria-pressed={stars() >= choice()}
                onClick={() => choose(choice())}
              >
                {choice()} {choice() === 1 ? "star" : "stars"}
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (item: Accessor<T>, index: Accessor<number>) => JSX.Element;
}): JSX.Element {
  const items = createMemo(() => {
    const rows = new Map<unknown, T>();
    props.each.forEach((item, index) => {
      const key = props.by(item, index);
      rows.set(rows.has(key) ? {} : key, item);
    });
    return rows;
  });
  return (
    <For each={[...items().keys()]}>
      {(key, index) => {
        const item = createMemo(() => items().get(key) as T);
        return untrack(() => props.children(item, index));
      }}
    </For>
  );
}
