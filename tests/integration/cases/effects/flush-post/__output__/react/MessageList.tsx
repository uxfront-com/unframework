import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { type CSSProperties, useEffect, useEffectEvent, useRef, useState } from "react";

export interface MessageListEvents {
  onRendered?: (count: number) => void;
}

export interface MessageListAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function MessageList({
  onRendered,
  className,
  style,
  ...attributes
}: MessageListEvents & MessageListAttributes) {
  const [messages, setMessages] = useState(["Welcome to the team"]);
  const messagesRef = useRef(messages);
  const list = useRef<HTMLUListElement>(null);

  const previousMessages = useRef(messages);
  const onMessagesChange = useEffectEvent(() => {
    onRendered?.(list.current?.childElementCount ?? 0);
  });
  useEffect(() => {
    const previous = previousMessages.current;
    if (Object.is(previous, messages)) return;
    previousMessages.current = messages;
    onMessagesChange();
  }, [messages]);

  function add() {
    messagesRef.current = [...messagesRef.current, `Message ${messagesRef.current.length + 1}`];
    setMessages(messagesRef.current);
  }

  return (
    <section
      className={cx("message-list", className)}
      aria-label="Messages"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <ul ref={list}>
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
      <button type="button" onClick={add}>
        Add a message
      </button>
    </section>
  );
}
