import { ref } from "unframework";

export default function EventLog() {
  const log = ref<string[]>([]);
  const volume = ref(5);

  function record(line: string) {
    log.value = [...log.value, line];
  }

  function changeVolume(event: WheelEvent) {
    if (event.deltaY < 0) {
      volume.value += 1;
    } else {
      volume.value -= 1;
    }
  }

  return (
    <section class="event-log" aria-label="Event options">
      <div
        class="panel"
        role="presentation"
        onClickCapture={() => record("panel capture")}
        onClick={() => record("panel bubble")}
      >
        <button type="button" onClick={() => record("button")}>
          Inside
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            record("stopped");
          }}
        >
          Stop here
        </button>
      </div>
      <button type="button" onClickOnce={() => record("once")}>
        Only once
      </button>
      <div class="reward" role="presentation" onClick={() => record("outer")}>
        <button
          type="button"
          onClickOnce={(event) => {
            event.stopPropagation();
            record("claimed");
          }}
        >
          Claim the reward
        </button>
      </div>
      <div class="volume" role="group" aria-label="Volume" onWheelPassive={changeVolume}>
        <output>{volume.value}</output>
      </div>
      <ol aria-label="Log">
        {log.value.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ol>
    </section>
  );
}
