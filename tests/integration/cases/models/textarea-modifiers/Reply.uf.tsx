import { ref } from "@uxfront/unframework";

export default function Reply() {
  const message = ref("Thanks, see you soon");
  const signature = ref("Ada");
  return (
    <form aria-label="Reply">
      <textarea aria-label="Message" v-model_trim={message.value} />
      <textarea aria-label="Signature" v-model_lazy={signature.value} />
      <output>
        [{message.value}] from {signature.value}
      </output>
    </form>
  );
}
