import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { type CSSProperties, useEffect, useEffectEvent, useRef, useState } from "react";

export interface ArticlePreviewProps {
  title: string;
  text: string;
}

export interface ArticlePreviewEvents {
  onReady?: (characters: number) => void;
}

export interface ArticlePreviewAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function ArticlePreview({
  title,
  text,
  onReady,
  className,
  style,
  ...attributes
}: ArticlePreviewProps & ArticlePreviewEvents & ArticlePreviewAttributes) {
  const body = useRef<HTMLParagraphElement>(null);
  const [characters, setCharacters] = useState(0);
  const charactersRef = useRef(characters);
  const [counted, setCounted] = useState(false);
  const countedRef = useRef(counted);

  const onMount = useEffectEvent(() => {
    const length = body.current?.textContent?.length ?? 0;
    charactersRef.current = length;
    setCharacters(charactersRef.current);
    countedRef.current = true;
    setCounted(countedRef.current);
    onReady?.(length);
  });
  useEffect(() => {
    onMount();
  }, []);

  return (
    <article
      className={cx("article-preview", className)}
      aria-label={title}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <h2>{title}</h2>
      <p ref={body}>{text}</p>
      <p role="status">{counted ? `${characters} characters` : "Counting the characters"}</p>
    </article>
  );
}
