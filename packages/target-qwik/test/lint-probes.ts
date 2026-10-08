// What this target emits for M1's constructs, written by hand before the emitter does, in the
// shapes of ADR-0034 to ADR-0040: `component$<P>` with destructured defaults or `props`, ternaries and keyed
// `.map`, `class` arrays and objects, style objects, the attribute names Qwik types. The same three
// components on every target: a badge (props with defaults, a conditional chain, class and style
// bindings, bound attributes, SVG), a list (nested keyed lists, conditionals inside and around
// them, a root fragment) and a card (the `props` form, a typed spread written out key by key, a
// static style). lint.test.ts pins the L5 configuration against them (ADR-0042): a rule that
// rejects one of them would force an emitter change.

/** File name → contents. */
export const M1_SHAPES: Readonly<Record<string, string>> = {
  "Badge.tsx": `import { component$ } from "@qwik.dev/core";

export interface BadgeProps {
  label: string;
  tone?: "info" | "warn";
  count?: number;
  pill?: boolean;
  gap?: string;
  quiet?: boolean;
}

export default component$<BadgeProps>(({ label, tone = "info", count, pill = false, gap, quiet }) => {
  return (
    <span
      id="badge"
      class={["badge", { pill }, \`tone-\${tone}\`]}
      style={{ color: "red", lineHeight: 1.5, marginTop: gap, "--gap": gap }}
      aria-hidden={quiet}
      data-tone={tone}
      title={label}
    >
      {count !== undefined && count > 0 ? <strong>{count}</strong> : tone === "warn" ? "!" : null}
      {label}{" "}
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <title>Icon</title>
        <circle cx="8" cy="8" r="4" stroke-width="2" />
        <path d="M0 0h16" />
      </svg>
      <input id="count" type="number" disabled={quiet} tabIndex={0} maxLength={10} readOnly />
      <label for="count">Count</label>
    </span>
  );
});
`,
  "LinkCard.tsx": `import { component$ } from "@qwik.dev/core";

interface LinkAttrs {
  href: string;
  title?: string;
  class?: string;
}

export interface LinkCardProps {
  label: string;
  link: LinkAttrs;
  extra?: { id?: string; role?: string };
  accent?: string;
}

export default component$<LinkCardProps>((props) => {
  return (
    <div class={["card", props.accent]} style={{ padding: "4px", border: "1px solid" }}>
      <a href={props.link.href} title={props.link.title} class={["card-link", props.link.class]}>
        {props.label}
      </a>
      <p id={props.extra?.id} role={props.extra?.role}>
        More
      </p>
    </div>
  );
});
`,
  "TodoList.tsx": `import { component$ } from "@qwik.dev/core";

interface Todo {
  id: string;
  title: string;
  done?: boolean;
  tags: string[];
}

export interface TodoListProps {
  todos: Todo[];
  heading?: string;
}

export default component$<TodoListProps>(({ todos, heading }) => {
  return (
    <>
      {heading ? <h2>{heading}</h2> : null}
      {todos.length > 0 ? (
        <ol class="todos">
          {todos.map((todo, index) => (
            <li key={todo.id} class={{ done: Boolean(todo.done) }}>
              {index + 1}. {todo.title}
              {todo.tags.length > 0 ? (
                <ul>
                  {todo.tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p>Nothing to do.</p>
      )}
    </>
  );
});
`,
};

// What this target emits for M2's constructs (ADR-0045 to ADR-0049), from four
// sources in the shapes test/setup.test.ts pins: a stepper (event QRL props, module-level
// constants and functions, `useConstant`, `useId`, signals for state and a setup `let`, `$()`
// QRLs with awaited calls, a render function's QRL twin, the `nextTick` and `rendered` helpers),
// watchers (tasks with previous values, a getter through `useComputed$`, `onCleanup` in a list,
// an array source, a prop getter, a post watcher, `watchEffect` and the lifecycle hooks in visible
// tasks) and listeners (the loader's `preventdefault:`/`stoppropagation:`, `sync$` handlers, the
// element argument, `capture:`, a capture listener from the window, `passive:`, a `once` guard,
// a module-level handler's QRL) and a list's handler that passes its event to a function (the
// function's controls on the listener, the element argument passed on), and the order of
// listeners (`Ordered.tsx`: one handler per element and event with the once guard inline, calls
// written in place and an async body going on by itself where another listener of the event
// follows, an assertion function declared where it is called, a bubble listener's controls in
// `sync$` beside a window listener, a guarded or a called function's conditional
// `preventDefault()` in a `sync$` beside its handler, an unawaited async call of a QRL, a merged
// listener that returns early under its guard's negation). lint.test.ts pins the L5
// configuration against them (ADR-0042, with `qwik/no-use-visible-task` off), the type-aware
// `qwik/valid-lexical-scope` included: every `$` scope captures only what Qwik serialises.

/** File name → contents. */
export const M2_SHAPES: Readonly<Record<string, string>> = {
  "Stepper.tsx": `import {
  $,
  type QRL,
  component$,
  useComputed$,
  useConstant,
  useId,
  useSignal,
} from "@qwik.dev/core";

export interface StepperProps {
  initial?: number;
  unit: string;
}

export interface StepperEvents {
  onChange$?: QRL<(value: number, label: string) => void>;
  onOpened$?: QRL<(items: number) => void>;
}

const limits = { low: 0, high: 10 };

function clamp(value: number): number {
  return Math.min(limits.high, Math.max(limits.low, value));
}

export default component$<StepperProps & StepperEvents>(
  ({ initial = 0, unit, onChange$, onOpened$ }) => {
    const id = "uf-id-" + useId();
    const caption = useConstant(() => \`In \${unit}\`);
    const count = useSignal(clamp(initial));
    const doubled = useComputed$(() => clamp(count.value * 2));
    const open = useSignal(false);
    const details = useSignal<HTMLUListElement>();
    const steps = useSignal(0);

    function label(value: number) {
      return \`\${value} \${unit}\`;
    }

    const labelQrl = $((value: number) => {
      return \`\${value} \${unit}\`;
    });

    const add = $(() => {
      steps.value += 1;
      count.value = clamp(count.value + 1);
    });

    const step = $(async () => {
      await add();
      onChange$?.(count.value, await labelQrl(steps.value));
    });

    const toggle = $(async () => {
      open.value = !open.value;
      await nextTick();
      onOpened$?.(rendered(details.value)?.childElementCount ?? 0);
    });

    return (
      <section aria-labelledby={id}>
        <h2 id={id}>{caption}</h2>
        <output>
          {label(count.value)}, {doubled.value}
        </output>
        <button type="button" onClick$={step}>
          Add
        </button>
        <button type="button" onClick$={toggle}>
          Details
        </button>
        {open.value ? (
          <ul ref={details}>
            <li>One</li>
          </ul>
        ) : null}
      </section>
    );
  },
);

/**
 * Resolves once Qwik has rendered the writes made before it: Qwik renders them in a microtask,
 * so they are in the DOM by the next task.
 */
function nextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}

/**
 * The element a template ref holds while it is in the document, else \`null\`: Qwik keeps a
 * removed element in its ref, where a template ref is empty once its element is gone (ADR-0049).
 */
function rendered<T extends Element>(element: T | undefined): T | null {
  return element?.isConnected ? element : null;
}

`,
  "Watchers.tsx": `import {
  type QRL,
  component$,
  noSerialize,
  useComputed$,
  useConstant,
  useSignal,
  useTask$,
  useVisibleTask$,
} from "@qwik.dev/core";

export interface WatchersProps {
  title: string;
}

export interface WatchersEvents {
  onRuns$?: QRL<(value: number, previous: number) => void>;
  onJoin$?: QRL<(channel: string) => void>;
  onLeave$?: QRL<(channel: string) => void>;
  onRange$?: QRL<(low: number, high: number) => void>;
  onHeading$?: QRL<(title: string, previous?: string) => void>;
  onRendered$?: QRL<(count: number) => void>;
  onBadge$?: QRL<(label: string) => void>;
  onReady$?: QRL<() => void>;
}

export default component$<WatchersProps & WatchersEvents>(
  ({
    title,
    onRuns$,
    onJoin$,
    onLeave$,
    onRange$,
    onHeading$,
    onRendered$,
    onBadge$,
    onReady$,
  }) => {
    const page = useSignal(1);
    const channel = useSignal("general");
    const low = useSignal(10);
    const high = useSignal(50);
    const list = useSignal<HTMLUListElement>();
    const timer = useSignal<ReturnType<typeof setInterval> | undefined>();

    const previousPage = useSignal(() => page.value);
    useTask$(
      ({ track }) => {
        const value = track(page);
        const previous = previousPage.value;
        if (Object.is(value, previous)) return;
        previousPage.value = value;
        onRuns$?.(value, previous);
      },
      { deferUpdates: false },
    );

    const nameSource = useComputed$(() => channel.value.toLowerCase());
    const previousName = useSignal<{ value: typeof nameSource.value }>();
    const nameCleanups = useConstant(() => noSerialize<(() => void)[]>([]));
    useTask$(
      ({ track }) => {
        const name = track(nameSource);
        const last = previousName.value;
        if (last && Object.is(name, last.value)) return;
        previousName.value = { value: name };
        for (const callback of nameCleanups?.splice(0) ?? []) callback();
        const onCleanup = (callback: () => void) => void nameCleanups?.push(callback);
        onJoin$?.(name);
        onCleanup(() => {
          onLeave$?.(name);
        });
      },
      { deferUpdates: false },
    );
    useVisibleTask$(
      ({ cleanup }) => {
        cleanup(() => {
          for (const callback of nameCleanups?.splice(0) ?? []) callback();
        });
      },
      { strategy: "document-ready" },
    );

    const previousValues = useSignal(() => [low.value, high.value] as const);
    useTask$(
      ({ track }) => {
        const values = [track(low), track(high)] as const;
        if (values.every((item, index) => Object.is(item, previousValues.value[index]))) return;
        previousValues.value = values;
        const [minimum, maximum] = values;
        onRange$?.(minimum, maximum);
      },
      { deferUpdates: false },
    );

    const previousTitle = useSignal<{ value: typeof title }>();
    useTask$(
      ({ track }) => {
        const value = track(() => title);
        const last = previousTitle.value;
        if (last && Object.is(value, last.value)) return;
        previousTitle.value = { value };
        const previous = last?.value;
        onHeading$?.(value, previous);
      },
      { deferUpdates: false },
    );

    const previousPage_1 = useSignal(() => page.value);
    useVisibleTask$(
      ({ track }) => {
        const value = track(page);
        if (Object.is(value, previousPage_1.value)) return;
        previousPage_1.value = value;
        onRendered$?.(list.value?.childElementCount ?? 0);
      },
      { strategy: "document-ready" },
    );

    useVisibleTask$(
      ({ track, cleanup: onCleanup }) => {
        track(page);
        track(() => title);
        const label = \`\${page.value} of \${title}\`;
        onBadge$?.(label);
        onCleanup(() => {
          onBadge$?.("");
        });
      },
      { strategy: "document-ready" },
    );

    useVisibleTask$(
      () => {
        timer.value = setInterval(() => onReady$?.(), 1000);
      },
      { strategy: "document-ready" },
    );

    useVisibleTask$(
      ({ cleanup }) => {
        cleanup(() => {
          clearInterval(timer.value);
        });
      },
      { strategy: "document-ready" },
    );

    return (
      <section>
        <ul ref={list}>
          <li>{page.value}</li>
        </ul>
        <button type="button" onClick$={() => page.value++}>
          Next
        </button>
        <button type="button" onClick$={() => (channel.value = "random")}>
          {channel.value}
        </button>
        <button type="button" onClick$={() => (high.value += 10)}>
          {low.value}
        </button>
      </section>
    );
  },
);

`,
  "Listeners.tsx": `import { $, component$, sync$, useSignal } from "@qwik.dev/core";

const blockComma = sync$((event: KeyboardEvent) => {
  if (event.key === ",") event.preventDefault();
});

function trace(event: MouseEvent) {
  console.info(event.type);
}

export default component$(() => {
  const log = useSignal<string[]>([]);
  const draft = useSignal("");

  const record = $((line: string) => {
    log.value = [...log.value, line];
  });

  const submit = $(async () => {
    await record(draft.value);
  });

  const key = $(async (event: KeyboardEvent) => {
    await record(event.key);
  });

  const update = $((event: InputEvent, element: Element) => {
    draft.value = (element as HTMLInputElement).value;
  });

  return (
    <form preventdefault:submit onSubmit$={submit}>
      <input name="tag" onKeyDown$={blockComma} onInput$={update} />
      <input
        name="key"
        onKeyDown$={[
          sync$((event: KeyboardEvent) => {
            if (event.key === "Enter") event.preventDefault();
          }),
          key,
        ]}
        onChange$={(_, element) => (draft.value = (element as HTMLInputElement).value)}
      />
      <div
        role="presentation"
        onClick$={() => record("bubble")}
        window:onClick$={async (event, element) => {
          if (!element.contains(event.target as Node)) return;
          await record("capture");
        }}
      >
        <button
          type="button"
          stoppropagation:click
          onClick$={async () => {
            await record("stopped");
          }}
        >
          Stop
        </button>
      </div>
      <div role="presentation" capture:focus onFocus$={() => record("focus")}>
        <button
          type="button"
          stoppropagation:click
          onClick$={async (_, element) => {
            if (onceClick.has(element)) return;
            onceClick.add(element);
            element.removeAttribute("stoppropagation:click");
            await record("once");
          }}
        >
          Once
        </button>
      </div>
      <div role="group" aria-label="Volume" passive:wheel onWheel$={() => record("wheel")}>
        {log.value.join()}
      </div>
      <button type="button" onClick$={$(trace)}>
        Trace
      </button>
    </form>
  );
});

// The elements each \`once\` listener ran for: Qwik's listeners have no \`once\` option.
const onceClick = new WeakSet<Element>();

`,
  "Picker.tsx": `import { $, type QRL, component$, sync$, useSignal } from "@qwik.dev/core";

export interface Item {
  id: string;
  label: string;
}

export interface PickerEvents {
  onPicked$?: QRL<(id: string, value: string) => void>;
}

function skip(_event: KeyboardEvent) {}

export default component$<{ items: Item[] } & PickerEvents>(({ items, onPicked$ }) => {
  const chosen = useSignal<string>();

  const pick = $((item: Item, event: MouseEvent, element: Element) => {
    chosen.value = item.id;
    onPicked$?.(item.id, (element as HTMLAnchorElement).text);
  });

  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={\`#\${item.id}\`}
            preventdefault:click
            onClick$={[
              sync$((event: MouseEvent) => {
                if (event.shiftKey) event.stopPropagation();
              }),
              $((event: PointerEvent, element: Element) => pick(item, event, element)),
            ]}
            onKeyDown$={[
              sync$((event: KeyboardEvent) => {
                if (event.key === "Tab") event.preventDefault();
              }),
              $((event: KeyboardEvent) => skip(event)),
            ]}
          >
            {item.label}
          </a>
        </li>
      ))}
      <li>{chosen.value ?? "none"}</li>
    </ul>
  );
});

`,
  "Ordered.tsx": `import { $, type QRL, component$, sync$, useSignal } from "@qwik.dev/core";

type Size = "sm" | "md";

export interface OrderedEvents {
  onPicked$?: QRL<(name: string) => void>;
}

export default component$<{ sizes: string[]; names: string[] } & OrderedEvents>(
  ({ sizes, names, onPicked$ }) => {
    const log = useSignal<string[]>([]);
    const size = useSignal<Size>("md");
    const status = useSignal("idle");
    const tags = useSignal<string[]>([]);

    const record = $((line: string) => {
      log.value = [...log.value, line];
    });

    const clear = $(async (_event: KeyboardEvent) => {
      await record("cleared");
    });

    const run = $(async () => {
      status.value = "running";
      await Promise.resolve();
      status.value = "done";
    });

    const start = $(async () => {
      void run();
      await record("started");
    });

    return (
      <section aria-label="Ordered">
        <div
          role="presentation"
          onClick$={() => record("toolbar")}
          window:onClick$={(event, element) => {
            if (!element.contains(event.target as Node)) return;
            log.value = [...log.value, "capture"];
          }}
        >
          <button
            type="button"
            onClick$={(_, element) => {
              log.value = [...log.value, "save"];
              if (!onceClick.has(element)) {
                onceClick.add(element);
                log.value = [...log.value, "first save"];
              }
            }}
          >
            Save
          </button>
          <button
            type="button"
            onClick$={() => {
              void (async () => {
                status.value = "saving";
                await Promise.resolve();
                status.value = "saved";
              })();
            }}
          >
            Draft
          </button>
          {names.map((name) => (
            <button
              key={name}
              type="button"
              onClick$={() => {
                onPicked$?.(name);
              }}
            >
              {name}
            </button>
          ))}
        </div>
        <div
          role="presentation"
          onClick$={[
            sync$((event: PointerEvent) => {
              event.stopPropagation();
            }),
            $(async () => {
              await record("panel bubble");
            }),
          ]}
          window:onClick$={(event, element) => {
            if (!element.contains(event.target as Node)) return;
            log.value = [...log.value, "panel capture"];
          }}
        >
          <button
            type="button"
            onClick$={() => {
              function assertKnown(value: string): asserts value is Size {
                const isKnown = (value: string): value is Size =>
                  sizes.includes(value) && value !== size.value;

                if (isKnown(value)) return;
                throw new Error(value);
              }

              assertKnown("sm");
              size.value = "sm";
            }}
          >
            {size.value}
          </button>
        </div>
        <input
          type="search"
          aria-label="Query"
          onKeyDown$={[
            sync$((event: KeyboardEvent) => {
              if (event.key === "Escape") {
                event.preventDefault();
              }
            }),
            $(async (event: KeyboardEvent) => {
              if (event.key === "Escape") await clear(event);
            }),
          ]}
        />
        <input
          aria-label="Tag"
          onKeyDown$={[
            sync$((event: KeyboardEvent) => {
              if (event.key === "Enter") {
                event.preventDefault();
              }
            }),
            $((event: KeyboardEvent) => {
              if (event.key !== "Enter") return;
              tags.value = [...tags.value, (event.target as HTMLInputElement).value];
            }),
          ]}
        />
        <div role="group" aria-label="Outer" onWheel$={() => record("outer wheel")}>
          <div
            role="group"
            aria-label="Inner"
            onWheel$={() => {
              log.value = [...log.value, "inner wheel"];
            }}
          >
            {status.value}
          </div>
        </div>
        <button
          type="button"
          onClick$={(_, element) => {
            if (tags.value.length !== 0) {
              const line: string = \`tags \${tags.value.length}\`;
              log.value = [...log.value, line];
            }
            if (!onceClick_1.has(element)) {
              onceClick_1.add(element);
              log.value = [...log.value, "first tags"];
            }
          }}
        >
          Tags
        </button>
        <button type="button" onClick$={start}>
          Start
        </button>
        <p>{log.value.join()}</p>
      </section>
    );
  },
);

// The elements each \`once\` listener ran for: Qwik's listeners have no \`once\` option.
const onceClick = new WeakSet<Element>();
const onceClick_1 = new WeakSet<Element>();
`,
};
