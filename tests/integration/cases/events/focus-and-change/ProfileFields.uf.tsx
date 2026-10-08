import { defineEmits, ref } from "unframework";

export default function ProfileFields() {
  const emit = defineEmits<{ firstNickname: [nickname: string] }>();

  const log = ref<string[]>([]);
  const nickname = ref("");
  const cardFocuses = ref(0);
  const cardBlurs = ref(0);

  function record(line: string) {
    log.value = [...log.value, line];
  }

  function hold(event: MouseEvent) {
    event.preventDefault();
    record("locked click");
  }

  return (
    <section class="profile-fields" aria-label="Profile">
      <div
        class="name-group"
        role="group"
        aria-label="Name fields"
        onFocusin={() => record("group focusin")}
        onFocusout={() => record("group focusout")}
      >
        <label>
          Name
          <input
            name="name"
            onFocus={() => record("name focus")}
            onBlur={() => record("name blur")}
          />
        </label>
      </div>
      <label>
        Nickname
        <input
          name="nickname"
          onChange={(event) => (nickname.value = (event.currentTarget as HTMLInputElement).value)}
          onChangeOnce={(event) =>
            emit("firstNickname", (event.currentTarget as HTMLInputElement).value)
          }
        />
      </label>
      <p>Nickname: {nickname.value}</p>
      <label>
        <input
          type="checkbox"
          name="public"
          onClick={() => record("public click")}
          onInput={() => record("public input")}
          onChange={() => record("public change")}
        />
        Public profile
      </label>
      <label>
        <input
          type="checkbox"
          name="locked"
          onClick={hold}
          onChange={() => record("locked change")}
        />
        Locked
      </label>
      <div
        class="card"
        role="group"
        aria-label="Card"
        tabindex="-1"
        onFocus={() => cardFocuses.value++}
        onBlur={() => cardBlurs.value++}
      >
        <p>{cardFocuses.value > cardBlurs.value ? "Card focused" : "Card not focused"}</p>
        <p>Card blurs: {cardBlurs.value}</p>
        <button type="button" onClick={() => record("card button")}>
          Inside the card
        </button>
      </div>
      <ol aria-label="Log">
        {log.value.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ol>
    </section>
  );
}
