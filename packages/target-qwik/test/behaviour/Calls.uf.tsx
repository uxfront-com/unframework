import { ref } from "unframework";

type Size = "sm" | "md";

// Calls of local functions (ADR-0045, ADR-0047): a helper that prevents a key, called under a
// test of the event, prevents that key alone; a call of an async function the source does not
// await lets the caller go on first; a type predicate and an assertion function narrow.
export default function Calls() {
  const query = ref("");
  const status = ref("idle");
  const size = ref<Size>("md");

  function clear(event: KeyboardEvent) {
    event.preventDefault();
    query.value = "";
  }

  async function run() {
    status.value = "running";
    await Promise.resolve();
    status.value = "done";
  }

  function start() {
    void run();
    status.value = "started";
  }

  const isSize = (value: string): value is Size => value === "sm" || value === "md";

  function assertSize(value: string): asserts value is Size {
    if (!isSize(value)) throw new Error(value);
  }

  function set(value: string) {
    if (isSize(value)) size.value = value;
  }

  function force(value: string) {
    assertSize(value);
    size.value = value;
  }

  return (
    <section aria-label="Calls">
      <label>
        Query
        <input
          type="text"
          onInput={(event) => (query.value = (event.currentTarget as HTMLInputElement).value)}
          onKeydown={(event) => {
            if (event.key === "Escape") clear(event);
          }}
        />
      </label>
      <p role="status">{query.value}</p>
      <button type="button" onClick={start}>
        Start
      </button>
      <p>{status.value}</p>
      <button type="button" onClick={() => set("sm")}>
        Small
      </button>
      <button type="button" onClick={() => force("md")}>
        Medium
      </button>
      <output>{size.value}</output>
    </section>
  );
}
