import { type CSSProperties, useRef, useState } from "react";

export interface StarRatingEvents {
  onPreview?: (stars: number) => void;
  onRate?: (stars: number, previous: number) => void;
  onCleared?: () => void;
}

export interface StarRatingAttributes {
  className?: string;
  style?: CSSProperties;
}

const choices = [1, 2, 3, 4, 5];

export default function StarRating({
  onPreview,
  onRate,
  onCleared,
  className,
  style,
}: StarRatingEvents & StarRatingAttributes) {
  const [stars, setStars] = useState(0);
  const starsRef = useRef(stars);

  function choose(next: number) {
    const previous = starsRef.current;
    onPreview?.(next);
    starsRef.current = next;
    setStars(starsRef.current);
    onRate?.(starsRef.current, previous);
  }

  function clear() {
    for (let star = starsRef.current - 1; star >= 0; star--) {
      onPreview?.(star);
    }
    starsRef.current = 0;
    setStars(starsRef.current);
    onCleared?.();
  }

  return (
    <div className={cx("star-rating", className)} role="group" aria-label="Rating" style={style}>
      <ul>
        {choices.map((choice) => (
          <li key={choice}>
            <button type="button" aria-pressed={stars >= choice} onClick={() => choose(choice)}>
              {choice} {choice === 1 ? "star" : "stars"}
            </button>
          </li>
        ))}
      </ul>
      <p role="status">{stars} of 5</p>
      <button type="button" onClick={clear}>
        Clear
      </button>
    </div>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
