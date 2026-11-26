import { KeyedFor } from "./_unframework/KeyedFor";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, omit } from "solid-js";

export interface CommentComposerEvents {
  onSent?: (text: string) => void;
  onSaved?: (count: number) => void;
  onFirstSave?: () => void;
}

export default function CommentComposer(
  props: CommentComposerEvents &
    Omit<ComponentProps<"section">, "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "onSent", "onSaved", "onFirstSave", "class");

  const [tags, setTags] = createState<string[]>([]);
  const [query, setQuery] = createState("");
  const [panelOpen, setPanelOpen] = createState(true);
  const [confirming, setConfirming] = createState(true);
  const [tipShown, setTipShown] = createState(true);
  const [saves, setSaves] = createState(0);
  const [log, setLog] = createState<string[]>([]);
  let finishUpload: (() => void) | undefined;

  function record(line: string) {
    setLog([...log(), line]);
  }

  function send(event: KeyboardEvent) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    props.onSent?.((event.target as HTMLTextAreaElement).value);
  }

  function addTag(event: KeyboardEvent) {
    event.preventDefault();
    const field = event.target as HTMLInputElement;
    if (field.value === "" || tags().includes(field.value)) return;
    setTags([...tags(), field.value]);
    field.value = "";
  }

  function clearSearch(event: KeyboardEvent) {
    event.stopPropagation();
    setQuery("");
    (event.target as HTMLInputElement).value = "";
  }

  function dismiss(event: MouseEvent) {
    event.stopPropagation();
    setConfirming(false);
    record("dismissed");
  }

  return (
    <section
      class={props.class ? `comment-composer ${props.class}` : "comment-composer"}
      aria-label="Composer"
      {...others}
    >
      <label>
        Comment
        <textarea name="comment" onKeyDown={send} />
      </label>
      <form
        aria-label="Tags"
        onSubmit={(event) => {
          event.preventDefault();
          record("tags submitted");
        }}
      >
        <label>
          Tag
          <input
            name="tag"
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              addTag(event);
            }}
          />
        </label>
        <button type="submit">Save tags</button>
      </form>
      <ul aria-label="Tag list">
        <KeyedFor each={tags()} by={(tag) => tag}>
          {(tag) => <li>{tag.value}</li>}
        </KeyedFor>
      </ul>
      <label>
        Code
        <input
          name="code"
          onKeyDown={(event) => {
            if (event.key.length === 1 && (event.target as HTMLInputElement).value.length >= 4)
              event.preventDefault();
          }}
        />
      </label>
      <div
        class="panel"
        role="presentation"
        onKeyDown={(event) => {
          if (event.key === "Escape") setPanelOpen(false);
        }}
      >
        <label>
          Search
          <input
            name="search"
            onInput={(event) => setQuery((event.currentTarget as HTMLInputElement).value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && (event.target as HTMLInputElement).value !== "")
                clearSearch(event);
            }}
          />
        </label>
        <p>{panelOpen() ? `Searching for: ${query()}` : "Panel closed"}</p>
      </div>
      <div
        class="page"
        role="presentation"
        ref={(element) => element.addEventListener("click", () => record("page"))}
      >
        <Show when={tipShown()}>
          <div
            class="tip"
            role="presentation"
            style={{ padding: "12px" }}
            ref={(element) =>
              element.addEventListener("click", (event) => {
                if (event.target !== event.currentTarget) return;
                event.stopPropagation();
                setTipShown(false);
              })
            }
          >
            Click here to hide this tip.
            <button
              type="button"
              ref={(element) => element.addEventListener("click", () => record("tip button"))}
            >
              More tips
            </button>
          </div>
        </Show>
        <Show when={confirming()} fallback={<p>Draft dismissed</p>}>
          <div
            class="backdrop"
            role="presentation"
            data-testid="backdrop"
            style={{ padding: "24px" }}
            ref={(element) =>
              element.addEventListener("click", (event) => {
                if (event.target === event.currentTarget) dismiss(event);
              })
            }
          >
            <div role="dialog" aria-label="Discard draft">
              <p>Discard this draft?</p>
              <button
                type="button"
                ref={(element) => element.addEventListener("click", () => record("kept"))}
              >
                Keep
              </button>
            </div>
          </div>
        </Show>
      </div>
      <button
        type="button"
        ref={(element) => {
          element.addEventListener("click", () => {
            if (tags().length === 0) return;
            setSaves(saves() + 1);
            props.onSaved?.(saves());
          });
          element.addEventListener("click", () => props.onFirstSave?.(), { once: true });
        }}
      >
        Save
      </button>
      <button
        type="button"
        ref={(element) => {
          element.addEventListener("click", async () => {
            record("upload started");
            await new Promise<void>((resolve) => {
              finishUpload = resolve;
            });
            record("upload finished");
          });
          element.addEventListener("click", () => record("first upload"), { once: true });
        }}
      >
        Upload
      </button>
      <button
        type="button"
        ref={(element) => element.addEventListener("click", () => finishUpload?.())}
      >
        Finish upload
      </button>
      <ol aria-label="Log">
        <KeyedFor each={log()} by={(line, index) => index}>
          {(line) => <li>{line.value}</li>}
        </KeyedFor>
      </ol>
    </section>
  );
}
