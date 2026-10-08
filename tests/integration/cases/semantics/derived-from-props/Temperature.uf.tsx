import { computed, defineEmits, watch } from "unframework";

export interface TemperatureProps {
  celsius: number;
}

export default function Temperature({ celsius }: TemperatureProps) {
  const emit = defineEmits<{ reading: [celsius: number, previous: number] }>();

  const fahrenheit = computed(() => Math.round((celsius * 9) / 5 + 32));
  const level = computed(() => (celsius >= 30 ? "hot" : celsius <= 5 ? "cold" : "mild"));

  watch(
    () => celsius,
    (value, previous) => {
      emit("reading", value, previous);
    },
  );

  return (
    <figure class="temperature" data-level={level.value}>
      <p>{celsius} °C</p>
      <p>{fahrenheit.value} °F</p>
      <figcaption>Feels {level.value}</figcaption>
    </figure>
  );
}
