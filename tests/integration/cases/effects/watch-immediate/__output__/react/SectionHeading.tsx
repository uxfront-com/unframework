import { useEffect, useEffectEvent, useRef } from "react";

export interface SectionHeadingProps {
  title: string;
}

export interface SectionHeadingEvents {
  onChange?: (title: string, previous?: string) => void;
  onReady?: () => void;
}

export default function SectionHeading({
  title,
  onChange,
  onReady,
}: SectionHeadingProps & SectionHeadingEvents) {
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

  return <h2 className="section-heading">{title}</h2>;
}
