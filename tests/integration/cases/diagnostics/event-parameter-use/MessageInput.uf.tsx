// UF3032 event-parameter-use: `event.isComposing` is not on React's synthetic keyboard event, so
// React's output could not read it; a handler reads only the members every target's event has.
import { defineEmits } from "unframework";

export default function MessageInput() {
  const emit = defineEmits<{ send: [] }>();

  function handleKey(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.isComposing) emit("send");
  }

  return <input class="message-input" name="message" aria-label="Message" onKeydown={handleKey} />;
}
