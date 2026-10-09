import { ref } from "unframework";

export default function Section({ title }: { title: string }) {
  const nested = ref(false);
  return (
    <article>
      <component is={nested.value ? "h3" : "h2"} class="title">
        {title}
      </component>
      <button type="button" onClick={() => (nested.value = !nested.value)}>
        {nested.value ? "Lift" : "Nest"}
      </button>
    </article>
  );
}
