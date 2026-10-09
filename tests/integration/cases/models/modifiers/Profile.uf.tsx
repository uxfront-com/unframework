import { ref } from "unframework";

export default function Profile() {
  const name = ref("");
  const city = ref("Lisbon");
  const weight = ref(0);
  return (
    <form aria-label="Profile">
      <label>
        Name <input v-model_trim={name.value} />
      </label>
      <label>
        City <input v-model_lazy={city.value} />
      </label>
      <label>
        Weight <input v-model_number={weight.value} />
      </label>
      <output>
        [{name.value}] from {city.value}, {weight.value + 1}
      </output>
    </form>
  );
}
