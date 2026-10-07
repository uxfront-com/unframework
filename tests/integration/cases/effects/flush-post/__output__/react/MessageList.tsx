import { useEffect, useEffectEvent, useRef, useState } from "react";

export interface MessageListEvents {
  onRendered?: (count: number) => void;
}

export default function MessageList({ onRendered }: MessageListEvents) {
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
    <section className="message-list" aria-label="Messages">
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
