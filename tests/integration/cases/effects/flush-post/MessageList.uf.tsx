import { defineEmits, ref, useTemplateRef, watch } from "unframework";

export default function MessageList() {
  const emit = defineEmits<{ rendered: [count: number] }>();

  const messages = ref(["Welcome to the team"]);
  const list = useTemplateRef<HTMLUListElement>();

  watch(
    messages,
    () => {
      emit("rendered", list.value?.childElementCount ?? 0);
    },
    { flush: "post" },
  );

  function add() {
    messages.value = [...messages.value, `Message ${messages.value.length + 1}`];
  }

  return (
    <section class="message-list" aria-label="Messages">
      <ul ref={list}>
        {messages.value.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
      <button type="button" onClick={add}>
        Add a message
      </button>
    </section>
  );
}
