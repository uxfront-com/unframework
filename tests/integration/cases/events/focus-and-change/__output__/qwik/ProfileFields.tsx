import {
  $,
  type CSSProperties,
  type ClassList,
  type QRL,
  component$,
  useSignal,
} from "@qwik.dev/core";

export interface ProfileFieldsEvents {
  onFirstNickname$?: QRL<(nickname: string) => void>;
}

export default component$<ProfileFieldsEvents & { class?: ClassList; style?: CSSProperties }>(
  ({ onFirstNickname$, class: className, style, ...attributes }) => {
    const log = useSignal<string[]>([]);
    const nickname = useSignal("");
    const cardFocuses = useSignal(0);
    const cardBlurs = useSignal(0);

    const record = $((line: string) => {
      log.value = [...log.value, line];
    });

    const hold = $(async () => {
      await record("locked click");
    });

    return (
      <section
        class={["profile-fields", className]}
        aria-label="Profile"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <div
          class="name-group"
          role="group"
          aria-label="Name fields"
          onFocusIn$={() => record("group focusin")}
          onFocusOut$={() => record("group focusout")}
        >
          <label>
            Name
            <input
              name="name"
              onFocus$={() => record("name focus")}
              onBlur$={() => record("name blur")}
            />
          </label>
        </div>
        <label>
          Nickname
          <input
            name="nickname"
            onChange$={(_, element) => {
              nickname.value = (element as HTMLInputElement).value;
              if (!onceChange.has(element)) {
                onceChange.add(element);
                onFirstNickname$?.((element as HTMLInputElement).value);
              }
            }}
          />
        </label>
        <p>Nickname: {nickname.value}</p>
        <label>
          <input
            type="checkbox"
            name="public"
            onClick$={() => record("public click")}
            onInput$={() => record("public input")}
            onChange$={() => record("public change")}
          />
          Public profile
        </label>
        <label>
          <input
            type="checkbox"
            name="locked"
            preventdefault:click
            onClick$={hold}
            onChange$={() => record("locked change")}
          />
          Locked
        </label>
        <div
          class="card"
          role="group"
          aria-label="Card"
          tabIndex={-1}
          onFocus$={() => cardFocuses.value++}
          onBlur$={() => cardBlurs.value++}
        >
          <p>{cardFocuses.value > cardBlurs.value ? "Card focused" : "Card not focused"}</p>
          <p>Card blurs: {cardBlurs.value}</p>
          <button type="button" onClick$={() => record("card button")}>
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
  },
);

// The elements each `once` listener ran for: Qwik's listeners have no `once` option.
const onceChange = new WeakSet<Element>();

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
