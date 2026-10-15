import { type CSSProperties, useEffect, useEffectEvent, useRef } from "react";

export interface SectionHeadingProps {
  title: string;
}

export interface SectionHeadingEvents {
  onChange?: (title: string, previous?: string) => void;
  onReady?: () => void;
}

export interface SectionHeadingAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function SectionHeading({
  title,
  onChange,
  onReady,
  className,
  style,
}: SectionHeadingProps & SectionHeadingEvents & SectionHeadingAttributes) {
  const previousTitle = useRef<typeof title | undefined>(undefined);
  const onTitleChange = useEffectEvent(
    (value: typeof title, previous: typeof title | undefined) => {
      onChange?.(value, previous);
    },
  );
  useEffect(() => {
    const previous = previousTitle.current;
    previousTitle.current = title;
    onTitleChange(title, previous);
  }, [title]);

  const onMount = useEffectEvent(() => {
    onReady?.();
  });
  useEffect(() => {
    onMount();
  }, []);

  return (
    <h2 className={cx("section-heading", className)} style={style}>
      {title}
    </h2>
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
