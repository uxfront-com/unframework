import { defineEmits, ref, watch } from "unframework";

export default function ChannelPicker() {
  const emit = defineEmits<{ join: [channel: string]; leave: [channel: string] }>();

  const channel = ref("general");

  watch(
    () => channel.value.toLowerCase(),
    (name, previous, onCleanup) => {
      emit("join", name);
      onCleanup(() => {
        emit("leave", name);
      });
    },
    { immediate: true },
  );

  return (
    <section class="channel-picker" aria-label="Channels">
      <p role="status">Channel: #{channel.value}</p>
      <button type="button" onClick={() => (channel.value = "random")}>
        Join #random
      </button>
      <button type="button" onClick={() => (channel.value = "General")}>
        Join #General
      </button>
    </section>
  );
}
