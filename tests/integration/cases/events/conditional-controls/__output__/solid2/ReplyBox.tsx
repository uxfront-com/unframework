import { createState } from "./_unframework/createState";
import { enumeratedValue } from "./_unframework/enumeratedValue";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function ReplyBox(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [started, setStarted] = createState(false);
  const [suggesting, setSuggesting] = createState(false);
  const [accepted, setAccepted] = createState(0);

  function accept(event: KeyboardEvent) {
    event.preventDefault();
    setSuggesting(false);
    setAccepted(accepted() + 1);
  }

  return (
    <section
      class={props.class ? `reply-box ${props.class}` : "reply-box"}
      aria-label="Reply"
      {...others}
    >
      <label>
        Message
        <textarea
          name="message"
          ref={(element) =>
            element.addEventListener(
              "keydown",
              (event) => {
                if (event.key === "Enter") event.preventDefault();
                setStarted(true);
              },
              { once: true },
            )
          }
        />
      </label>
      <p>{started() ? "Started" : "Not started"}</p>
      <label>
        Answer
        <textarea
          name="answer"
          ref={(element) =>
            element.addEventListener("keydown", (event) => {
              if (suggesting() && event.key === "Enter") accept(event);
            })
          }
        />
      </label>
      <button
        type="button"
        aria-pressed={enumeratedValue(suggesting())}
        onClick={() => setSuggesting(!suggesting())}
      >
        Suggestions
      </button>
      <p>Accepted: {accepted()}</p>
    </section>
  );
}
