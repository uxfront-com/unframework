import { type KeyboardEvent, type SyntheticEvent, type UIEvent, useRef, useState } from "react";

export interface CommentCardEvents {
  onLiked?: (liked: boolean, by: string) => void;
}

export default function CommentCard({ onLiked }: CommentCardEvents) {
  const [text, setText] = useState("");
  const textRef = useRef(text);
  const [liked, setLiked] = useState(false);
  const likedRef = useRef(liked);

  function autosize(event: SyntheticEvent) {
    const area = event.currentTarget as HTMLTextAreaElement;
    textRef.current = area.value;
    setText(textRef.current);
    area.style.height = `${Math.max(area.value.split("\n").length, 2) * 1.5}em`;
  }

  function toggleLike(event: UIEvent) {
    likedRef.current = !likedRef.current;
    setLiked(likedRef.current);
    onLiked?.(likedRef.current, event.type);
  }

  function onLikeKeydown(event: KeyboardEvent) {
    if (event.key === " ") event.preventDefault();
    if (event.key === "Enter" || event.key === " ") toggleLike(event);
  }

  return (
    <section className="comment-card" aria-label="Comment">
      <label>
        Comment
        <textarea name="comment" rows={2} onInput={autosize} />
      </label>
      <div className="meter" role="presentation">
        <div className="fill" style={{ width: `${Math.min(text.length, 100)}%` }} />
      </div>
      <p>{text.length} characters</p>
      <div
        className="like"
        role="button"
        tabIndex={0}
        aria-pressed={liked}
        onClick={toggleLike}
        onKeyDown={onLikeKeydown}
      >
        Like
      </div>
    </section>
  );
}
