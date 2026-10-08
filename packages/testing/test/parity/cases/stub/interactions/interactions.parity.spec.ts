// Interactions end to end on the stub target (ADR-0050): `view.user` acts through real input,
// settles until the page is quiet and records a step; `emitted` and `events` read what the
// component emitted, as plain data; `expectParity` compares the steps with the committed trace
// (L9), and records L9 as skipped where no step led to the scenario.
import { expect, inject, it as vitestIt } from "vitest";
import { page } from "vitest/browser";

import "../../../../../src/setup.ts";
import { describeTargets, it, mount } from "../../../../../src/index.ts";
import { NO_INTERACTION_SKIP } from "../../../../../src/layers.ts";
import type { StubComponent } from "../../../dom-target.ts";
import "../../../dom-target.ts";

/** A counter: a status, a button that counts and emits, and a field that emits what it holds. */
const counter: StubComponent = {
  html: ({ start = 0 }) =>
    `<p role="status">${String(start)}</p><button type="button">Add one</button><label>Name <input type="text"></label>`,
  emits: [
    { name: "change", optional: [false] },
    { name: "named", optional: [false] },
  ],
  setup(container, emit, signal) {
    const status = container.querySelector("p")!;
    const field = container.querySelector("input")!;
    container.querySelector("button")!.addEventListener(
      "click",
      () => {
        const next = Number(status.textContent) + 1;
        status.textContent = String(next);
        emit("change", next);
      },
      { signal },
    );
    field.addEventListener("input", () => emit("named", { name: field.value }), { signal });
  },
};

/** A button whose handler finishes after two awaits and a frame, as an async handler does. */
const slow: StubComponent = {
  html: '<button type="button">Save</button><p role="status">Idle</p>',
  emits: [{ name: "saved", optional: [] }],
  setup(container, emit, signal) {
    const status = container.querySelector("p")!;
    const save = async () => {
      status.textContent = "Saving";
      await Promise.resolve();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      status.textContent = "Saved";
      emit("saved");
    };
    container.querySelector("button")!.addEventListener("click", () => void save(), { signal });
  },
};

/**
 * A component whose framework renders in a task of its own, a while after the input that wrote
 * its state (as Angular's scheduler does): its watchers of the field's text, of a held Shift, of
 * a button's phase and of a count are called back from that render, with the latest value, so
 * writes in two inputs before one render call a watcher once, or not at all. Its settle waits
 * for the render, as a framework's adapter does.
 */
function scheduled(): StubComponent {
  let rendering: Promise<void> | undefined;
  return {
    html: '<label>Query <input type="text"></label><button type="button">Press</button><button type="button">Count</button>',
    emits: ["asked", "held", "phased", "counted"].map((name) => ({ name, optional: [false] })),
    setup(container, emit, signal) {
      const field = container.querySelector("input")!;
      const [press, count] = container.querySelectorAll("button");
      const state: Record<string, unknown> = { asked: "", held: false, phased: "idle", counted: 0 };
      const seen = { ...state };
      const write = (name: string, value: unknown) => {
        state[name] = value;
        rendering ??= new Promise<void>((resolve) => {
          setTimeout(() => {
            rendering = undefined;
            for (const [watched, current] of Object.entries(state)) {
              if (Object.is(current, seen[watched])) continue;
              seen[watched] = current;
              emit(watched, current);
            }
            resolve();
          }, 30);
        });
      };
      const on = (element: Element, type: string, listener: (event: Event) => void) =>
        element.addEventListener(type, listener, { signal });
      on(field, "input", () => write("asked", field.value));
      on(field, "keydown", (event) => {
        if ((event as KeyboardEvent).key === "Shift") write("held", true);
      });
      on(field, "keyup", (event) => {
        if ((event as KeyboardEvent).key === "Shift") write("held", false);
      });
      on(press!, "mousedown", () => write("phased", "down"));
      on(press!, "click", () => write("phased", "clicked"));
      on(count!, "click", () => write("counted", Number(state.counted) + 1));
    },
    settle: async () => {
      while (rendering) await rendering;
    },
  };
}

const update = inject("ufHarness").update;

describeTargets("stub/interactions", () => {
  it("renders the initial count, with no trace to compare", async ({ task }) => {
    const view = await mount(counter);
    await view.expectParity("initial");
    await expect.element(view.getByRole("status")).toHaveTextContent("0");
    expect(task.meta.uf?.layers.L9).toEqual({ status: "skip", reason: NO_INTERACTION_SKIP });
  });

  it(
    "counts clicks and emits each count, as the trace records",
    { requires: ["interactivity"] },
    async ({ task }) => {
      const view = await mount(counter);
      await view.user.click(view.getByRole("button", { name: "Add one" }));
      await view.user.click(view.getByRole("button", { name: "Add one" }));
      await view.expectParity("after-clicks");
      await expect.element(view.getByRole("status")).toHaveTextContent("2");
      expect(view.emitted("change")).toEqual([[1], [2]]);
      expect(view.emitted("named")).toEqual([]);
      expect(view.events()).toEqual([
        ["change", 1],
        ["change", 2],
      ]);
      expect(task.meta.uf?.layers.L9).toEqual({ status: "pass" });
    },
  );

  it("marks the focus, and copies an object payload", { requires: ["interactivity"] }, async () => {
    const view = await mount(counter);
    await view.user.focus(view.getByLabelText("Name"));
    expect(view.html()).toContain('uf:focused=""');
    await view.user.fill(view.getByLabelText("Name"), "Ada");
    await view.expectParity("after-typing");
    await expect.element(view.getByLabelText("Name")).toHaveValue("Ada");
    expect(view.emitted("named")).toEqual([[{ name: "Ada" }]]);
  });

  it(
    "starts each test with nothing focused, and tabs into the view",
    { requires: ["interactivity"] },
    async () => {
      // The test before this one left a field focused: the setup blurred it.
      expect(document.activeElement).toBe(document.body);
      const view = await mount(counter);
      await view.user.tab();
      await view.expectParity("after-tab");
      await expect.element(view.getByRole("button", { name: "Add one" })).toHaveFocus();
    },
  );

  it(
    "settles a handler's work after its awaits within the step",
    { requires: ["interactivity"] },
    async () => {
      const view = await mount(slow);
      await view.user.click(view.getByRole("button", { name: "Save" }));
      // No retrying assertion: the step waited until the page was quiet.
      expect(view.container.querySelector("p")?.textContent).toBe("Saved");
      expect(view.emitted("saved")).toEqual([[]]);
      await view.expectParity("after-save");
      await expect.element(view.getByRole("status")).toHaveTextContent("Saved");
    },
  );

  it(
    "settles after each input of an action, so a watcher a later render runs sees each one",
    { requires: ["interactivity"] },
    async () => {
      const view = await mount(scheduled());
      // Two keys, a key's press and release, a click's press and release, two clicks: each a
      // person's input of its own, which a render follows before the next.
      await view.user.type(view.getByLabelText("Query"), "al");
      await view.user.keyboard("{Shift}");
      await view.user.click(view.getByRole("button", { name: "Press" }));
      await view.user.dblClick(view.getByRole("button", { name: "Count" }));
      await view.expectParity("after-inputs");
      await expect.element(view.getByLabelText("Query")).toHaveValue("al");
      expect(view.events()).toEqual([
        ["asked", "a"],
        ["asked", "al"],
        ["held", true],
        ["held", false],
        ["phased", "down"],
        ["phased", "clicked"],
        ["counted", 1],
        ["counted", 2],
      ]);
    },
  );

  it("records a rerender as a step", async () => {
    const view = await mount(counter, { props: { start: 4 } });
    await view.rerender({ start: 5 });
    await view.expectParity("after-rerender");
    await expect.element(view.getByRole("status")).toHaveTextContent("5");
  });

  it(
    "acts only on locators under the view's root, presses only keys it can, and reads only declared events",
    { requires: ["interactivity"] },
    async () => {
      const view = await mount(counter);
      const other = await mount(counter);
      const button = view.getByRole("button", { name: "Add one" });
      await expect(view.user.click(page.getByRole("button"))).rejects.toThrow(
        /view\.user\.click: act on a locator of this view, .* not getByRole\('button'\)/,
      );
      await expect(view.user.click(other.getByRole("button", { name: "Add one" }))).rejects.toThrow(
        /not getByTestId\('uf-root-\d+'\)\.getByRole/,
      );
      await expect(view.user.click(button.element() as never)).rejects.toThrow(/not an element/);
      await expect(view.user.click(view.locator)).rejects.toThrow(/act on a locator of this view/);
      // Keys it cannot press, refused before any input.
      await expect(view.user.type(view.getByLabelText("Name"), "a{Enter")).rejects.toThrow(
        /^view\.user\.type: the "\{" at 1 is never closed in "a\{Enter": /,
      );
      await expect(view.user.keyboard("{/Shift}")).rejects.toThrow(
        "view.user.keyboard: {/Shift} releases Shift, which is not held",
      );
      expect(() => view.emitted("clicked")).toThrow(
        'view.emitted("clicked"): the component declares no event "clicked" (it declares change, named).',
      );
      // Nothing above acted: there is no step to compare.
      await view.expectParity("refusals");
      await expect.element(view.getByRole("status")).toHaveTextContent("0");
    },
  );

  it(
    "refuses a payload no trace can hold, naming the event and where",
    { requires: ["interactivity"] },
    async () => {
      const sender: StubComponent = {
        html: '<button type="button">Send</button>',
        emits: [{ name: "sent", optional: [false] }],
        setup(container, emit, signal) {
          container
            .querySelector("button")!
            .addEventListener("click", (event) => emit("sent", { at: 1, event }), { signal });
        },
      };
      const view = await mount(sender);
      await expect(view.user.click(view.getByRole("button", { name: "Send" }))).rejects.toThrow(
        'The payload of "sent" holds a DOM event at argument 1.event',
      );
      expect(view.emitted("sent")).toEqual([]);
    },
  );

  it(
    "prevents a form submission the component leaves alone, and fails at the next settle",
    { requires: ["interactivity"] },
    async () => {
      const view = await mount({ html: '<form><button type="submit">Send</button></form>' });
      await expect(view.user.click(view.getByRole("button", { name: "Send" }))).rejects.toThrow(
        /a form submission was not prevented: the component's submit listener must call event\.preventDefault\(\) \(<form>\)/,
      );
      // The page is still the tester's: the frame did not navigate.
      expect(view.container.isConnected).toBe(true);
    },
  );

  it(
    "lets a submission the component prevents through",
    { requires: ["interactivity"] },
    async () => {
      const form: StubComponent = {
        html: '<form><button type="submit">Send</button></form><p role="status">Draft</p>',
        emits: [{ name: "submitted", optional: [] }],
        setup(container, emit, signal) {
          container.querySelector("form")!.addEventListener(
            "submit",
            (event) => {
              event.preventDefault();
              container.querySelector("p")!.textContent = "Sent";
              emit("submitted");
            },
            { signal },
          );
        },
      };
      const view = await mount(form);
      await view.user.click(view.getByRole("button", { name: "Send" }));
      await view.expectParity("after-submit");
      await expect.element(view.getByRole("status")).toHaveTextContent("Sent");
      expect(view.emitted("submitted")).toEqual([[]]);
    },
  );

  // A step the test never compares fails L9 when it ends: the setup records it. Vitest's own
  // `it`, as the corpus's refuses `fails`.
  vitestIt.skipIf(update).fails("fails L9 with a step no expectParity compared", async () => {
    const view = await mount(counter);
    await view.user.click(view.getByRole("button", { name: "Add one" }));
    await expect.element(view.getByRole("status")).toHaveTextContent("1");
  });

  vitestIt.skipIf(update)("recorded the step left at the end of the test above", ({ task }) => {
    const sibling = task.suite?.tasks.find(
      (test) => test.name === "fails L9 with a step no expectParity compared",
    );
    expect(sibling?.meta.uf?.layers.L9).toEqual({
      status: "fail",
      message: expect.stringMatching(
        /^1 step\(s\) of uf-root-\d+ were never compared \(click getByRole\('button', \{ name: 'Add one' \}\)\): every view\.user action and rerender is followed by an expectParity/,
      ),
    });
    // L8 passes: the test's own assertions held.
    expect(sibling?.meta.uf?.layers.L8).toEqual({ status: "pass" });
  });
});
