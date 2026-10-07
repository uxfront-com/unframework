import { computed, defineEmits, onMounted, ref, watch } from "unframework";

export default function NameSorter() {
  const emit = defineEmits<{
    started: [text: string];
    firstSeen: [text: string];
    secondSeen: [count: number];
    total: [letters: number];
  }>();

  const names = ref(["Cy", "Al"].toSorted((a, b) => compare(a, b)));
  const count = ref(0);

  onMounted(() => {
    emit("started", `first ${describe()}`);
  });

  onMounted(() => {
    emit("started", "second");
  });

  watch(count, () => {
    emit("firstSeen", describe());
  });

  watch(count, (value) => {
    emit("secondSeen", value);
  });

  const doubled = computed(() => count.value * 2);
  const letters = computed(() => names.value.join("").length);

  function compare(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
  }

  function describe(): string {
    return `doubled ${doubled.value}`;
  }

  function add(name: string) {
    names.value = [...names.value, name].toSorted(compare);
    count.value += 1;
  }

  function report() {
    emit("total", letters.value);
  }

  return (
    <section class="name-sorter" aria-label="Names">
      <p>Names: {names.value.join(", ")}</p>
      <p>Added: {count.value}</p>
      <button type="button" onClick={() => add("Bo")}>
        Add Bo
      </button>
      <button type="button" onClick={report}>
        Report
      </button>
    </section>
  );
}
