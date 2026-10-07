import { defineEmits, nextTick, ref } from "unframework";

export default function Picker() {
  const emit = defineEmits<{ done: [step: number, status: string] }>();

  const selected = ref("none");
  const hits = ref(0);
  const log = ref<string[]>([]);
  const status = ref("idle");
  const step = ref(0);

  function record(line: string) {
    log.value = [...log.value, line];
  }

  function pick(name: string) {
    selected.value = name;
    hits.value += 1;
  }

  function report() {
    record(`picked ${selected.value} #${hits.value}`);
  }

  async function load() {
    status.value = "loading";
    await Promise.resolve();
    step.value += 1;
  }

  async function run() {
    step.value += 1;
    await load();
    status.value = `loaded ${step.value}`;
    await nextTick();
    emit("done", step.value, status.value);
  }

  function start() {
    void run();
    status.value = "started";
  }

  return (
    <section class="picker" aria-label="Picker">
      <div class="choices" role="presentation" onClick={report}>
        <button type="button" onClick={() => pick("alpha")}>
          Alpha
        </button>
        <button type="button" onClick={() => pick("beta")}>
          Beta
        </button>
      </div>
      <ol aria-label="Log">
        {log.value.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ol>
      <p role="status">{status.value}</p>
      <button type="button" onClick={start}>
        Start
      </button>
    </section>
  );
}
