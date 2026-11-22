import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
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
  ...attributes
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
    <h2 className={cx("section-heading", className)} style={style} {...scopeAttributes(attributes)}>
      {title}
    </h2>
  );
}
