import { KeyedFor } from "./_unframework/KeyedFor";
import { type ComponentProps, type JSX, createSignal, splitProps } from "solid-js";

export interface ProfileFieldsEvents {
  onFirstNickname?: (nickname: string) => void;
}

export default function ProfileFields(
  props: ProfileFieldsEvents &
    Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["onFirstNickname", "class"]);

  const [log, setLog] = createSignal<string[]>([]);
  const [nickname, setNickname] = createSignal("");
  const [cardFocuses, setCardFocuses] = createSignal(0);
  const [cardBlurs, setCardBlurs] = createSignal(0);

  function record(line: string) {
    setLog([...log(), line]);
  }

  function hold(event: MouseEvent) {
    event.preventDefault();
    record("locked click");
  }

  return (
    <section
      class={props.class ? `profile-fields ${props.class}` : "profile-fields"}
      aria-label="Profile"
      {...others}
    >
      <div
        class="name-group"
        role="group"
        aria-label="Name fields"
        onFocusIn={() => record("group focusin")}
        onFocusOut={() => record("group focusout")}
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
          ref={(element) => {
            element.addEventListener("change", (event) =>
              setNickname((event.currentTarget as HTMLInputElement).value),
            );
            element.addEventListener(
              "change",
              (event) => props.onFirstNickname?.((event.currentTarget as HTMLInputElement).value),
              { once: true },
            );
          }}
        />
      </label>
      <p>Nickname: {nickname()}</p>
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
        onFocus={() => setCardFocuses(cardFocuses() + 1)}
        onBlur={() => setCardBlurs(cardBlurs() + 1)}
      >
        <p>{cardFocuses() > cardBlurs() ? "Card focused" : "Card not focused"}</p>
        <p>Card blurs: {cardBlurs()}</p>
        <button type="button" onClick={() => record("card button")}>
          Inside the card
        </button>
      </div>
      <ol aria-label="Log">
        <KeyedFor each={log()} by={(entry, index) => index}>
          {(entry) => <li>{entry.value}</li>}
        </KeyedFor>
      </ol>
    </section>
  );
}
