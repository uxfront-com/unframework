// The components test/behaviour.browser.test.ts mounts, as `.uf.tsx` sources: the browser
// project compiles each through the analyser and this target (test/behaviour-modules.ts), so the
// tests run what the target emits, in Chromium, on the semantics contract (plan §4.5) where React's
// own model differs from Vue's: reads after writes across listeners and called functions, watch
// timing, previous values and cleanups, lifecycle hooks, listener options and DOM semantics,
// deferred reads of props and listeners, `nextTick`, and StrictMode.

/** Component name → source. */
export const BEHAVIOUR_SOURCES: Readonly<Record<string, string>> = {
  Phases: `import { defineEmits, ref } from "unframework";

export default function Phases() {
  const emit = defineEmits<{ logged: [entries: string[]]; total: [value: number] }>();
  const trail = ref<string[]>([]);
  const count = ref(0);

  function addTen() {
    count.value += 10;
  }

  function logCapture() {
    trail.value = [...trail.value, "capture"];
  }

  function logBubble() {
    trail.value = [...trail.value, "bubble"];
    emit("logged", trail.value);
  }

  function addTwice() {
    count.value++;
    addTen();
    count.value++;
    emit("total", count.value);
  }

  return (
    <div role="presentation" onClickCapture={logCapture}>
      <button type="button" onClick={logBubble}>Log</button>
      <button type="button" onClick={addTwice}>Add</button>
      <output>{count.value}</output>
    </div>
  );
}
`,

  Watcher: `import { defineEmits, ref, watch } from "unframework";

export default function Watcher() {
  const emit = defineEmits<{ ran: [value: number, previous: number]; cleaned: [value: number] }>();
  const count = ref(0);

  watch(count, (value, previous, onCleanup) => {
    emit("ran", value, previous);
    onCleanup(() => {
      emit("cleaned", value);
    });
  });

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          count.value += 1;
          count.value += 1;
        }}
      >
        Twice
      </button>
      <button
        type="button"
        onClick={() => {
          count.value += 1;
          count.value -= 1;
        }}
      >
        Back
      </button>
      <output>{count.value}</output>
    </div>
  );
}
`,

  Ticker: `import { defineEmits, onMounted, onUnmounted, useTemplateRef } from "unframework";

export default function Ticker() {
  const emit = defineEmits<{ mounted: [connected: boolean]; tick: [count: number]; unmounted: [] }>();
  const box = useTemplateRef<HTMLParagraphElement>();
  let timer: ReturnType<typeof setInterval> | undefined;
  let ticks = 0;

  onMounted(() => {
    emit("mounted", box.value?.isConnected ?? false);
    timer = setInterval(() => {
      ticks += 1;
      emit("tick", ticks);
    }, 20);
  });

  onUnmounted(() => {
    clearInterval(timer);
    emit("unmounted");
  });

  return <p ref={box}>Ticking</p>;
}
`,

  Options: `import { ref } from "unframework";

export default function Options() {
  const log = ref<string[]>([]);
  const items = ["a", "b"];

  function record(line: string) {
    log.value = [...log.value, line];
  }

  function claim(item: string, event: MouseEvent) {
    event.stopPropagation();
    record(item);
  }

  return (
    <section aria-label="Options">
      <div role="presentation" onClick={() => record("outer")}>
        {items.map((item) => (
          <button key={item} type="button" onClickOnce={(event) => claim(item, event)}>
            {item}
          </button>
        ))}
      </div>
      <div role="group" aria-label="Wheel" onWheelPassive={(event) => record(event.deltaY > 0 ? "down" : "up")}>
        Wheel
      </div>
      <p>{log.value.join(" ")}</p>
    </section>
  );
}
`,

  Fields: `import { ref } from "unframework";

export default function Fields() {
  const log = ref<string[]>([]);

  function record(line: string) {
    log.value = [...log.value, line];
  }

  return (
    <form aria-label="Fields">
      <div role="presentation" onFocus={() => record("group focus")}>
        <input
          name="name"
          aria-label="Name"
          onChange={(event) => record("change " + (event.currentTarget as HTMLInputElement).value)}
        />
      </div>
      <input name="other" aria-label="Other" />
      <p>{log.value.join(" | ")}</p>
    </form>
  );
}
`,

  Deferred: `import { defineEmits } from "unframework";

export interface DeferredProps {
  label: string;
}

export default function Deferred({ label }: DeferredProps) {
  const emit = defineEmits<{ done: [label: string] }>();
  let release: (() => void) | undefined;

  async function start() {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    emit("done", label);
  }

  function finish() {
    release?.();
  }

  return (
    <div>
      <button type="button" onClick={start}>Start</button>
      <button type="button" onClick={finish}>Finish</button>
    </div>
  );
}
`,

  Ticked: `import { defineEmits, nextTick, ref, useTemplateRef, watch } from "unframework";

export default function Ticked() {
  const emit = defineEmits<{ watched: [value: number]; read: [text: string] }>();
  const count = ref(0);
  const out = useTemplateRef<HTMLOutputElement>();

  watch(count, (value) => {
    emit("watched", value);
  });

  async function bump() {
    count.value += 1;
    await nextTick();
    emit("read", out.value?.textContent ?? "");
  }

  return (
    <div>
      <button type="button" onClick={bump}>Bump</button>
      <output ref={out}>{count.value}</output>
    </div>
  );
}
`,

  Channel: `import { defineEmits, ref, watch } from "unframework";

export default function Channel() {
  const emit = defineEmits<{ join: [name: string]; leave: [name: string] }>();
  const channel = ref("general");

  watch(
    () => channel.value,
    (name, previous, onCleanup) => {
      emit("join", name);
      onCleanup(() => {
        emit("leave", name);
      });
    },
    { immediate: true },
  );

  return (
    <button type="button" onClick={() => (channel.value = "random")}>
      {channel.value}
    </button>
  );
}
`,

  Branches: `import { ref } from "unframework";

export default function Branches() {
  const editing = ref(false);

  function toggle() {
    editing.value = !editing.value;
  }

  return (
    <section aria-label="Branches">
      {editing.value ? (
        <button type="button" onClick={toggle}>Save</button>
      ) : (
        <button type="button" onClick={toggle}>Edit</button>
      )}
    </section>
  );
}
`,
  Ready: `import { defineEmits, nextTick, onMounted, ref, useTemplateRef, watch } from "unframework";

export default function Ready() {
  const emit = defineEmits<{ shown: [text: string]; measured: [text: string] }>();
  const label = ref("Loading");
  const count = ref(0);
  const doubled = ref(0);
  const out = useTemplateRef<HTMLOutputElement>();
  const twice = useTemplateRef<HTMLParagraphElement>();

  watch(count, (value) => {
    doubled.value = value * 2;
  });

  onMounted(async () => {
    label.value = "Ready";
    await nextTick();
    emit("shown", out.value?.textContent ?? "");
  });

  async function bump() {
    count.value += 1;
    await nextTick();
    emit("measured", twice.value?.textContent ?? "");
  }

  return (
    <div>
      <output ref={out}>{label.value}</output>
      <button type="button" onClick={bump}>Bump</button>
      <p ref={twice}>{doubled.value}</p>
    </div>
  );
}
`,
  Pair: `import { defineEmits, ref } from "unframework";

export default function Pair() {
  const emit = defineEmits<{ first: [value: string] }>();
  const name = ref("");
  const rows = ["a"];

  function rename(row: string, event: Event) {
    name.value = row + " " + (event.currentTarget as HTMLInputElement).value;
  }

  function announce(row: string, event: Event) {
    emit("first", row + " " + (event.currentTarget as HTMLInputElement).value);
  }

  return (
    <form aria-label="Pair">
      <input
        name="name"
        aria-label="Name"
        onChange={(event) => (name.value = (event.currentTarget as HTMLInputElement).value)}
        onChangeOnce={(event) => emit("first", (event.currentTarget as HTMLInputElement).value)}
      />
      {rows.map((row) => (
        <input
          key={row}
          aria-label={"Row " + row}
          onChange={(event) => rename(row, event)}
          onChangeOnce={(event) => announce(row, event)}
        />
      ))}
      <p>{name.value}</p>
    </form>
  );
}
`,

  Choices: `import { ref } from "unframework";

export default function Choices() {
  const log = ref<string[]>([]);

  function record(line: string) {
    log.value = [...log.value, line];
  }

  function hold(event: MouseEvent) {
    event.preventDefault();
  }

  return (
    <div
      role="group"
      aria-label="Fields"
      onFocusin={() => record("group focusin")}
      onFocusout={() => record("group focusout")}
    >
      <input name="name" aria-label="Name" onFocus={() => record("input focus")} onBlur={() => record("input blur")} />
      <input
        type="checkbox"
        aria-label="News"
        onClick={() => record("click")}
        onInput={() => record("input")}
        onChange={() => record("change")}
      />
      <input type="checkbox" aria-label="Held" onClick={hold} onChange={() => record("held change")} />
      <p>{log.value.join(", ")}</p>
    </div>
  );
}
`,
  Modes: `import { ref } from "unframework";

export default function Modes() {
  const mode = ref("a");
  const flag = ref(true);

  function toB() {
    mode.value = "b";
  }

  function toC() {
    flag.value = false;
  }

  function toA() {
    mode.value = "a";
    flag.value = true;
  }

  return (
    <section aria-label="Modes">
      {mode.value === "a" ? (
        <button type="button" onClick={toB}>A</button>
      ) : (
        <>{flag.value ? <button type="button" onClick={toC}>B</button> : <button type="button" onClick={toA}>C</button>}</>
      )}
    </section>
  );
}
`,
  Shortcuts: `import { defineEmits, onMounted, onUnmounted, ref, watch } from "unframework";

export default function Shortcuts() {
  const emit = defineEmits<{ shortcut: [key: string, count: number] }>();
  const enabled = ref(false);
  const count = ref(0);

  function onKey(event: KeyboardEvent) {
    if (enabled.value) {
      count.value += 1;
      emit("shortcut", event.key, count.value);
    }
  }

  function onEscape(event: KeyboardEvent) {
    if (event.key === "Escape") enabled.value = false;
  }

  watch(
    enabled,
    (on) => {
      if (on) document.addEventListener("keydown", onKey);
      else document.removeEventListener("keydown", onKey);
    },
    { flush: "post" },
  );

  onMounted(() => {
    document.addEventListener("keyup", onEscape);
  });

  onUnmounted(() => {
    document.removeEventListener("keyup", onEscape);
    document.removeEventListener("keydown", onKey);
  });

  return (
    <div>
      <button type="button" onClick={() => (enabled.value = !enabled.value)}>Toggle</button>
      <p>Used: {count.value}</p>
    </div>
  );
}
`,
  Measured: `import { defineEmits, ref, useTemplateRef, watch } from "unframework";

export default function Measured() {
  const emit = defineEmits<{ rendered: [count: number] }>();
  const query = ref("");
  const results = ref<string[]>([]);
  const list = useTemplateRef<HTMLUListElement>();

  watch(
    query,
    () => {
      emit("rendered", list.value?.childElementCount ?? -1);
    },
    { flush: "post" },
  );

  watch(query, (value) => {
    results.value = value === "" ? [] : [value, \`\${value} docs\`];
  });

  return (
    <section aria-label="Measured">
      <button type="button" onClick={() => (query.value = "vue")}>Search</button>
      <ul ref={list} aria-label="Results">
        {results.value.map((result) => (
          <li key={result}>{result}</li>
        ))}
      </ul>
    </section>
  );
}
`,
  AsyncPair: `import { defineEmits } from "unframework";

export default function AsyncPair() {
  const emit = defineEmits<{ log: [entry: string] }>();

  function record(entry: string) {
    emit("log", entry);
  }

  return (
    <div>
      <button
        type="button"
        onClick={async () => {
          record("save start");
          await new Promise((resolve) => setTimeout(resolve, 10));
          record("save done");
        }}
        onClickOnce={() => record("first click")}
      >
        Save
      </button>
      <input
        aria-label="Name"
        onChange={async () => {
          record("change start");
          await new Promise((resolve) => setTimeout(resolve, 10));
          record("change done");
        }}
        onChangeOnce={() => record("change second")}
      />
      <a
        href="#moved"
        onClickOnce={async () => {
          record("first");
          await new Promise((resolve) => setTimeout(resolve, 10));
          record("first done");
        }}
        onClick={(event) => {
          event.preventDefault();
          record("held");
        }}
      >
        Move
      </a>
    </div>
  );
}
`,
  Guards: `import { defineEmits, ref } from "unframework";

export default function Guards() {
  const emit = defineEmits<{ log: [entry: string] }>();
  const tags = ref<string[]>([]);
  const label = ref("");

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (tags.value.length === 0) return;
          emit("log", \`saved \${tags.value.length}\`);
        }}
        onClickOnce={() => emit("log", "first save")}
      >
        Save
      </button>
      <button type="button" onClick={() => (tags.value = [...tags.value, "tag"])}>Tag</button>
      <input
        aria-label="Name"
        onChange={(event) => {
          const value = (event.target as HTMLInputElement).value;
          if (value === "" || value === label.value) return;
          label.value = value;
          emit("log", \`named \${value}\`);
        }}
        onChangeOnce={(e) => emit("log", \`first name \${(e.target as HTMLInputElement).value}\`)}
      />
    </div>
  );
}
`,
  Narrowed: `import { defineEmits } from "unframework";

export interface User {
  name: string;
}

export interface NarrowedProps {
  owner?: User;
  value: string | number;
}

export default function Narrowed({ owner, value }: NarrowedProps) {
  const emit = defineEmits<{ picked: [name: string] }>();

  function pick(who: User) {
    emit("picked", who.name);
  }

  function use(text: string) {
    emit("picked", text);
  }

  return (
    <div>
      {owner && <input aria-label="Owner" onChange={() => pick(owner)} />}
      {owner ? <button type="button" onClick={() => pick(owner)}>Pick</button> : <p>No owner</p>}
      {typeof value === "string" && <input aria-label="Value" onChange={() => use(value)} />}
      <button type="button" onClick={() => setTimeout(() => emit("picked", owner?.name ?? "none"), 1)}>
        Later
      </button>
    </div>
  );
}
`,
  NestKeys: `import { ref } from "unframework";

export default function NestKeys() {
  const mode = ref("a");
  const ready = ref(true);
  const more = ref(false);

  return (
    <div>
      {mode.value === "a" ? (
        <>{ready.value && <button type="button" onClick={() => (mode.value = "b")}>A</button>}</>
      ) : (
        <>{ready.value && <button type="button" onClick={() => (mode.value = "a")}>B</button>}</>
      )}
      {mode.value === "a" ? (
        <>
          <span>One</span>
          {ready.value && <button type="button" onClick={() => (more.value = !more.value)}>C</button>}
          {more.value && <button type="button" onClick={() => (mode.value = "b")}>D</button>}
        </>
      ) : (
        <>
          <span>Two</span>
          {ready.value && <button type="button" onClick={() => (mode.value = "a")}>E</button>}
        </>
      )}
    </div>
  );
}
`,
  Switches: `import { ref } from "unframework";

export default function Switches() {
  const byPassword = ref(true);
  const mode = ref("a");
  const ready = ref(true);
  const flipped = ref(false);
  const rows = ref(["x"]);

  return (
    <section aria-label="Switches">
      <button type="button" onClick={() => (byPassword.value = !byPassword.value)}>Switch</button>
      <div>
        {byPassword.value ? (
          <input type="password" aria-label="Password" />
        ) : (
          <>
            <input type="text" aria-label="Email" />
            <small>We send you a link.</small>
          </>
        )}
      </div>
      <div>
        <h2>Modes</h2>
        {mode.value === "a" ? (
          <>
            <button type="button" onClick={() => (mode.value = "b")}>A</button>
            <p>One</p>
          </>
        ) : (
          <>
            {ready.value && <button type="button" onClick={() => (mode.value = "a")}>B</button>}
            <span>Two</span>
          </>
        )}
      </div>
      <div>
        {flipped.value ? <input type="text" aria-label="Left" /> : <input type="password" aria-label="Left secret" />}
        {flipped.value ? <input type="text" aria-label="Right" /> : <input type="password" aria-label="Right secret" />}
        {flipped.value ? (
          rows.value.map((row) => <input key={row} type="text" aria-label="Open row" />)
        ) : (
          rows.value.map((row) => <input key={row} type="password" aria-label="Secret row" />)
        )}
        <button type="button" onClick={() => (flipped.value = !flipped.value)}>Flip</button>
      </div>
    </section>
  );
}
`,
  Checked: `import { defineEmits, nextTick, ref, useTemplateRef, watch, watchEffect } from "unframework";

export default function Checked() {
  const emit = defineEmits<{ saved: [value: string]; summary: [text: string]; focused: [label: string] }>();
  const email = ref("ada@example.com");
  const checking = ref(false);
  const valid = ref(true);
  const field = useTemplateRef<HTMLInputElement>();

  async function validate(value: string): Promise<boolean> {
    return value.includes("@");
  }

  watch(email, async (value) => {
    checking.value = true;
    const ok = await validate(value);
    checking.value = false;
    valid.value = ok;
  });

  watch(
    email,
    (value) => {
      emit("saved", value);
    },
    { flush: "post" },
  );

  watchEffect(() => {
    emit("summary", \`\${email.value} is \${valid.value ? "valid" : "invalid"}\`);
  });

  async function suggest() {
    email.value = "ada@lovelace.dev";
    await nextTick();
    field.value?.focus();
    emit("focused", document.activeElement?.getAttribute("aria-label") ?? "");
  }

  return (
    <div>
      <input ref={field} aria-label="Email" />
      <output>{email.value}</output>
      <p>{checking.value ? "Checking" : valid.value ? "Valid" : "Invalid"}</p>
      <button type="button" onClick={suggest}>
        Suggest
      </button>
    </div>
  );
}
`,
  TickFlag: `import { defineEmits, nextTick, ref, useTemplateRef, watch } from "unframework";

export default function TickFlag() {
  const emit = defineEmits<{ focused: [label: string] }>();
  const email = ref("ada@example.com");
  const checking = ref(false);
  const valid = ref(true);
  const field = useTemplateRef<HTMLInputElement>();

  async function validate(value: string): Promise<boolean> {
    return value.includes("@");
  }

  watch(email, async (value) => {
    checking.value = true;
    const ok = await validate(value);
    checking.value = false;
    valid.value = ok;
  });

  async function suggest() {
    email.value = "ada@lovelace.dev";
    await nextTick();
    field.value?.focus();
    emit("focused", document.activeElement?.getAttribute("aria-label") ?? "");
  }

  return (
    <div>
      <input ref={field} aria-label="Email" />
      <output>{email.value}</output>
      <p>{checking.value ? "Checking" : valid.value ? "Valid" : "Invalid"}</p>
      <button type="button" onClick={suggest}>
        Suggest
      </button>
    </div>
  );
}
`,
  CheckedPlain: `import { defineEmits, ref, watch, watchEffect } from "unframework";

export default function CheckedPlain() {
  const emit = defineEmits<{ saved: [value: string]; summary: [text: string]; }>();
  const email = ref("ada@example.com");
  const checking = ref(false);
  const valid = ref(true);

  async function validate(value: string): Promise<boolean> {
    return value.includes("@");
  }

  watch(email, async (value) => {
    checking.value = true;
    const ok = await validate(value);
    checking.value = false;
    valid.value = ok;
  });

  watch(
    email,
    (value) => {
      emit("saved", value);
    },
    { flush: "post" },
  );

  watchEffect(() => {
    emit("summary", \`\${email.value} is \${valid.value ? "valid" : "invalid"}\`);
  });

  function suggest() {
    email.value = "ada@lovelace.dev";
  }

  return (
    <div>
      <input aria-label="Email" />
      <output>{email.value}</output>
      <p>{checking.value ? "Checking" : valid.value ? "Valid" : "Invalid"}</p>
      <button type="button" onClick={suggest}>
        Suggest
      </button>
    </div>
  );
}
`,
  Pager: `import { defineEmits, ref } from "unframework";

export default function Pager() {
  const emit = defineEmits<{ moved: [page: number] }>();
  const page = ref(1);
  const count = ref(2);

  return (
    <div>
      {page.value > 1 && (
        <button type="button" onClick={() => { page.value -= 1; emit("moved", page.value); }}>Previous</button>
      )}
      <output>{page.value}</output>
      {page.value < 3 && (
        <button type="button" onClick={() => { page.value += 1; emit("moved", page.value); }}>Next</button>
      )}
      {count.value > 0 ? (
        <button type="button" onClick={() => { count.value--; count.value--; emit("moved", count.value); }}>Remove two</button>
      ) : (
        <p>Empty</p>
      )}
    </div>
  );
}
`,
  Escapable: `import { defineEmits, ref } from "unframework";

export default function Escapable() {
  const emit = defineEmits<{ closed: [reason: string] }>();
  const open = ref(false);

  function close(reason: string) {
    open.value = false;
    document.removeEventListener("keydown", onEscape);
    emit("closed", reason);
  }

  const onEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") close("escape");
  };

  function show() {
    open.value = true;
    document.addEventListener("keydown", onEscape);
  }

  return (
    <div>
      <button type="button" aria-expanded={open.value} onClick={show}>Options</button>
      {open.value && <button type="button" onClick={() => close("button")}>Close</button>}
    </div>
  );
}
`,
  Settle: `import { defineEmits, onUnmounted, ref, useTemplateRef, watch, watchEffect } from "unframework";

export default function Settle() {
  const emit = defineEmits<{ log: [entry: string] }>();
  const query = ref("");
  const results = ref<string[]>([]);
  const list = useTemplateRef<HTMLUListElement>();

  onUnmounted(() => emit("log", "unmounted"));

  watch(
    query,
    (value, previous, onCleanup) => {
      emit("log", \`post \${previous} \${value} \${list.value?.childElementCount ?? -1}\`);
      onCleanup(() => emit("log", \`post cleanup \${value}\`));
    },
    { flush: "post" },
  );

  watchEffect((onCleanup) => {
    const text = \`\${results.value.length} for "\${query.value}"\`;
    emit("log", \`effect \${text} \${document.querySelectorAll("[aria-label='Search'] li").length}\`);
    onCleanup(() => emit("log", \`effect cleanup \${text}\`));
  });

  watch(query, (value) => {
    results.value = value === "" ? [] : [value, \`\${value} docs\`];
  });

  return (
    <section aria-label="Search">
      <button type="button" onClick={() => (query.value = "vue")}>Search</button>
      <button type="button" onClick={() => (results.value = [])}>Clear</button>
      <ul ref={list}>
        {results.value.map((result) => (
          <li key={result}>{result}</li>
        ))}
      </ul>
    </section>
  );
}
`,
  Editor: `import { defineEmits, nextTick, ref, useTemplateRef } from "unframework";

export default function Editor() {
  const emit = defineEmits<{ focused: [label: string]; renamed: [name: string] }>();
  const editing = ref(false);
  const name = ref("Draft");
  const field = useTemplateRef<HTMLInputElement>();
  const edit = useTemplateRef<HTMLButtonElement>();

  async function startEditing() {
    editing.value = true;
    await nextTick();
    field.value?.focus();
    field.value?.select();
    emit("focused", document.activeElement?.getAttribute("aria-label") ?? "none");
  }

  async function commit(event: KeyboardEvent) {
    if (event.key !== "Enter") {
      return;
    }
    name.value = (event.currentTarget as HTMLInputElement).value;
    editing.value = false;
    emit("renamed", name.value);
    await nextTick();
    edit.value?.focus();
    emit("focused", document.activeElement?.textContent ?? "none");
  }

  return (
    <div>
      {editing.value ? <input ref={field} aria-label="Name" onKeydown={commit} /> : <p>{name.value}</p>}
      <button ref={edit} type="button" onClick={startEditing}>Rename</button>
    </div>
  );
}
`,
  TickClose: `import { defineEmits, nextTick, ref } from "unframework";

export default function TickClose() {
  const emit = defineEmits<{ close: []; done: [open: boolean] }>();
  const open = ref(true);

  async function dismiss() {
    open.value = false;
    emit("close");
    await nextTick();
    emit("done", open.value);
  }

  return (
    <div>
      <p>{open.value ? "Open" : "Closed"}</p>
      <button type="button" onClick={dismiss}>Dismiss</button>
    </div>
  );
}
`,
};
