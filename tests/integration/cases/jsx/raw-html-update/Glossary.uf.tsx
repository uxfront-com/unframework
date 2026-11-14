import { computed, ref } from "@uxfront/unframework";

export interface GlossaryProps {
  terms: string[];
  definitions: string[];
}

export default function Glossary({ terms, definitions }: GlossaryProps) {
  const index = ref(0);
  const definition = computed(() => definitions[index.value] ?? "");

  function next() {
    index.value = (index.value + 1) % terms.length;
  }

  return (
    <section class="glossary" aria-label="Glossary">
      <h2>{terms[index.value]}</h2>
      <div class="definition" innerHTML={definition.value} />
      <button type="button" onClick={next}>
        Next term
      </button>
    </section>
  );
}
