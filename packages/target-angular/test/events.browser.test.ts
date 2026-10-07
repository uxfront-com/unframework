import SignupFormEvents from "virtual:uf-angular-events/events/form-events";
import NoteEditorEvents from "virtual:uf-angular-events/events/function-handlers";
import CommandMenuEvents from "virtual:uf-angular-events/events/keys";
import ContactListEvents from "virtual:uf-angular-events/events/list-handlers";
import CollisionsEvents from "virtual:uf-angular-events/probe/Collisions";
import DeletingEvents from "virtual:uf-angular-events/probe/Deleting";
import ListenerOrderEvents from "virtual:uf-angular-events/probe/ListenerOrder";
import ListenerPairsEvents from "virtual:uf-angular-events/probe/ListenerPairs";
import TagFormEvents from "virtual:uf-angular-events/semantics/prevent-default";
import EventLog from "virtual:uf-angular/events/event-options";
import SignupForm from "virtual:uf-angular/events/form-events";
import NoteEditor from "virtual:uf-angular/events/function-handlers";
import ShirtOrder from "virtual:uf-angular/events/inline-handlers";
import CommandMenu from "virtual:uf-angular/events/keys";
import ContactList from "virtual:uf-angular/events/list-handlers";
import EmailField from "virtual:uf-angular/ids/label-association";
import Collisions from "virtual:uf-angular/probe/Collisions";
import Deleting from "virtual:uf-angular/probe/Deleting";
import ListenerOrder from "virtual:uf-angular/probe/ListenerOrder";
import ListenerPairs from "virtual:uf-angular/probe/ListenerPairs";
import Returns from "virtual:uf-angular/probe/Returns";
import SearchToggle from "virtual:uf-angular/refs/focus";
import TagForm from "virtual:uf-angular/semantics/prevent-default";
import TaskList from "virtual:uf-angular/state/array-replacement";
// Listeners as the Angular output runs them in Chromium (ADR-0047): template statements and
// the methods inline handlers move to; listener options through the file's directives, each in its
// phase, once, or passive, on an element in a list or a conditional too; `preventDefault()` and
// `stopPropagation()` during dispatch; a handler's value never preventing the event (Angular
// prevents it for `false`); template refs and ids.
import { afterEach, describe, expect, it, vi } from "vitest";

import { cleanup, render } from "./browser.ts";

afterEach(cleanup);

const key = (name: string) =>
  new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true });

const wheel = (deltaY: number) =>
  new WheelEvent("wheel", { deltaY, bubbles: true, cancelable: true });

const log = (container: HTMLElement) =>
  [...container.querySelectorAll('[aria-label="Log"] li')].map((item) => item.textContent);

describe("listener options", () => {
  it("listens with the option each listener asks for", async () => {
    const listen = vi.spyOn(EventTarget.prototype, "addEventListener");
    await render(EventLog, []);
    const options = listen.mock.calls
      .filter(([, , option]) => typeof option === "object")
      .map(([type, , option]) => [type, option]);
    listen.mockRestore();
    expect(options).toEqual([
      ["click", { capture: true }],
      ["click", { once: true }],
      ["click", { once: true }],
      ["wheel", { passive: true }],
    ]);
  });

  it("runs a capture listener before the target's, and a bubble one after", async () => {
    const view = await render(EventLog, []);
    await view.click("button", "Inside");
    expect(log(view.container)).toEqual(["panel capture", "button", "panel bubble"]);
  });

  it("stops the bubble phase only, from a handler moved to a method", async () => {
    const view = await render(EventLog, []);
    await view.click("button", "Stop here");
    expect(log(view.container)).toEqual(["panel capture", "stopped"]);
  });

  it("runs a once listener once, then lets clicks through to its container", async () => {
    const view = await render(EventLog, []);
    await view.click("button", "Only once");
    await view.click("button", "Only once");
    await view.click("button", "Claim the reward");
    await view.click("button", "Claim the reward");
    expect(log(view.container)).toEqual(["once", "claimed", "outer"]);
  });

  it("listens to wheel passively: it cannot prevent the scroll", async () => {
    const view = await render(EventLog, []);
    const up = await view.dispatch(".volume", wheel(-100));
    await view.dispatch(".volume", wheel(-100));
    await view.dispatch(".volume", wheel(100));
    expect(view.get("output").textContent).toBe("6");
    expect(up).toBe(true);
  });
});

describe("keys and prevented defaults", () => {
  it("moves through the commands, prevents Enter alone, and emits", async () => {
    const view = await render(CommandMenu, CommandMenuEvents, {
      commands: ["Open", "Save", "Close"],
    });
    expect(await view.dispatch('input[name="command"]', key("ArrowDown"))).toBe(true);
    expect(await view.dispatch('input[name="command"]', key("ArrowUp"))).toBe(true);
    expect(await view.dispatch('input[name="command"]', key("ArrowUp"))).toBe(true);
    expect(await view.dispatch('input[name="command"]', key("Enter"))).toBe(false);
    expect(await view.dispatch('input[name="command"]', key("Escape"))).toBe(true);
    expect(view.events).toEqual([["run", "Close"], ["dismiss"]]);
  });

  it("never prevents a key from an expression-bodied handler whose value is `false`", async () => {
    const view = await render(CommandMenu, CommandMenuEvents, { commands: ["Open"] });
    const field = view.get<HTMLInputElement>('input[name="shortcut"]');
    field.value = "Deploy";
    expect(await view.dispatch('input[name="shortcut"]', key("a"))).toBe(true);
    expect(field.value).toBe("Deploy");
    expect(await view.dispatch('input[name="shortcut"]', key("Escape"))).toBe(true);
    expect(field.value).toBe("");
  });

  it("prevents a submission, a comma under a condition, and a link's navigation", async () => {
    const view = await render(TagForm, TagFormEvents);
    const field = view.get<HTMLInputElement>('input[name="tag"]');
    expect(await view.dispatch('input[name="tag"]', key(","))).toBe(false);
    expect(await view.dispatch('input[name="tag"]', key("a"))).toBe(true);
    field.value = "urgent";
    await view.dispatch('input[name="tag"]', new InputEvent("input", { bubbles: true }));
    const submit = new SubmitEvent("submit", { bubbles: true, cancelable: true });
    expect(await view.dispatch("form", submit)).toBe(false);
    expect(field.value).toBe("");
    expect(view.emitted("tagsChange")).toEqual([[["urgent"]]]);
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    expect(await view.dispatch("a", click)).toBe(false);
    expect(view.get("p").textContent).toBe("A tag is one word: commas are not allowed.");
  });
});

describe("handlers", () => {
  it("runs one function from two elements, and a keyboard handler with its event", async () => {
    const view = await render(NoteEditor, NoteEditorEvents);
    await view.click("button", "Save");
    await view.click("button", "Save and close");
    await view.dispatch("textarea", key("Escape"));
    expect(view.emitted("saved")).toEqual([[1], [2]]);
    expect(view.get('[role="status"]').textContent).toBe("Saved 2 times, last key Escape");
  });

  it("runs inline handlers moved to methods, reading their event's target", async () => {
    const view = await render(ShirtOrder, []);
    await view.click("button", "Large");
    await view.click("button", "Add one");
    const note = view.get<HTMLInputElement>('input[name="note"]');
    note.value = "Gift";
    await view.dispatch('input[name="note"]', new InputEvent("input", { bubbles: true }));
    expect(view.get('[role="status"]').textContent).toBe("2 x size L");
    expect(view.get("p", "Note: Gift")).toBeDefined();
    await view.click("button", "Reset");
    expect(view.get('[role="status"]').textContent).toBe("1 x size M");
    expect(note.value).toBe("");
  });

  it("passes a list's item and index from the template", async () => {
    const contacts = [
      { id: "a", name: "Ada" },
      { id: "g", name: "Grace" },
    ];
    const view = await render(ContactList, ContactListEvents, { initial: contacts });
    await view.click("button", "Grace");
    await view.click('[aria-label="Remove Ada"]');
    await view.click("button", "Grace");
    expect(view.events).toEqual([
      ["choose", "g", 1],
      ["removed", "Ada"],
      ["choose", "g", 0],
    ]);
  });

  it("listens to change, input, focus and blur as the DOM fires them", async () => {
    const view = await render(SignupForm, SignupFormEvents);
    const name = view.get<HTMLInputElement>('input[name="name"]');
    name.focus();
    await view.mounted.settle();
    name.value = "Ada";
    await view.dispatch('input[name="name"]', new InputEvent("input", { bubbles: true }));
    expect(view.get('[role="status"]').textContent).toContain("Name: ; ");
    await view.dispatch('input[name="name"]', new Event("change", { bubbles: true }));
    expect(view.get('[role="status"]').textContent).toContain("Name: Ada; ");
    expect(view.get('[role="status"]').textContent).toContain("focus: name");
    name.blur();
    await view.mounted.settle();
    expect(view.get('[role="status"]').textContent).toContain("focus: none");
    const submit = new SubmitEvent("submit", { bubbles: true, cancelable: true });
    expect(await view.dispatch("form", submit)).toBe(false);
    expect(view.emitted("signup")).toEqual([["Ada", "", "free", false]]);
  });

  it("selects in a list from the template and moves a row from a function", async () => {
    const initial = [
      { id: "1", label: "Write" },
      { id: "2", label: "Review" },
    ];
    const view = await render(TaskList, [], { initial });
    await view.click("button", "Review");
    await view.click("button", "Move up");
    await view.click("button", "Add task");
    const rows = [...view.container.querySelectorAll("li > button:first-child")];
    expect(rows.map((row) => row.textContent)).toEqual(["Review", "Write", "New task 1"]);
  });
});

describe("events named after JavaScript keywords", () => {
  it("emit from template statements and methods", async () => {
    const view = await render(Deleting, DeletingEvents, { ids: [7] });
    await view.click("button", "Delete 7");
    await view.click("button", "Export 7");
    await view.click("button", "Remove 7");
    await view.click("button", "Continue");
    await view.click("button", "Both");
    expect(view.events).toEqual([
      ["delete", 7],
      ["export", 7],
      ["delete", 7],
      ["continue"],
      ["default"],
      ["new"],
    ]);
  });
});

describe("template refs and ids", () => {
  it("focuses elements through template refs", async () => {
    const view = await render(SearchToggle, []);
    await view.click("button", "Search");
    expect(document.activeElement).toBe(view.get("input"));
    await view.dispatch("input", key("Escape"));
    expect(document.activeElement).toBe(view.get("button"));
  });

  it("gives each instance its own ids, which the label and the hint refer to", async () => {
    const first = await render(EmailField, [], { label: "Work email", hint: "We never share it" });
    const second = await render(EmailField, [], { label: "Home email", hint: "Optional" });
    const ids = [first, second].map((view) => {
      const input = view.get("input");
      expect(view.get("label").getAttribute("for")).toBe(input.id);
      expect(input.getAttribute("aria-describedby")).toBe(view.get("p").id);
      return [input.id, view.get("p").id];
    });
    expect(ids.flat().every((id) => id.startsWith("uf-id-"))).toBe(true);
    expect(new Set(ids.flat()).size).toBe(4);
  });
});

describe("listeners of one event on one element", () => {
  it("run in their attributes' order beside an option, a once one only the first time", async () => {
    const view = await render(ListenerOrder, ListenerOrderEvents, { rows: ["a", "b"] });
    await view.click("button", "Press");
    await view.click("button", "Press");
    await view.click("button", "Twice");
    await view.click("button", "Twice");
    // prettier-ignore
    expect(log(view.container)).toEqual([
      "outer capture", "own capture", "plain", "once", "outer bubble",
      "outer capture", "own capture", "plain", "outer bubble",
      "outer capture", "first only", "every time", "outer bubble",
      "outer capture", "every time", "outer bubble",
    ]);
  });

  it("call a setup function, then the once listener that reads what it wrote", async () => {
    const view = await render(ListenerOrder, ListenerOrderEvents, { rows: [] });
    await view.click("button", "Go");
    await view.click("button", "Go");
    expect(view.emitted("started")).toEqual([[1]]);
    await view.click("button", "Jump");
    await view.click("button", "Jump");
    expect(view.get("p").textContent).toBe("22");
    // prettier-ignore
    expect(log(view.container)).toEqual([
      "outer capture", "outer bubble", "outer capture", "outer bubble",
      "outer capture", "click", "outer bubble", "outer capture", "outer bubble",
    ]);
  });

  it("run a once listener once per row of a list, and a passive one beside the others", async () => {
    const view = await render(ListenerOrder, ListenerOrderEvents, { rows: ["a", "b"] });
    await view.click("button", "a");
    await view.click("button", "b");
    await view.click("button", "a");
    expect(log(view.container)).toEqual(["a", "a 0 click", "b", "b 1 click", "a"]);
    const listen = vi.spyOn(EventTarget.prototype, "addEventListener");
    const other = await render(ListenerOrder, ListenerOrderEvents, { rows: [] });
    const wheels = listen.mock.calls.filter(([type]) => type === "wheel");
    listen.mockRestore();
    // One listener for the three, which is not passive: so is one of them.
    expect(wheels).toHaveLength(1);
    await other.dispatch('[aria-label="Volume"]', wheel(-1));
    await other.dispatch('[aria-label="Volume"]', wheel(1));
    expect(other.get("output").textContent).toBe("0");
    expect(log(other.container)).toEqual(["passive wheel", "first wheel", "passive wheel"]);
  });
});

describe("listeners of one event that read what the template types and narrows", () => {
  it("run in a list over a computed or a prop's member, in a narrowed branch, by their own names", async () => {
    const view = await render(ListenerPairs, ListenerPairsEvents, {
      entries: [
        { id: 1, title: "Write", done: false },
        { id: 2, title: "Read", done: true },
      ],
      data: { rows: [{ id: 3, title: "Plan", done: false }] },
      owner: { name: "Ada", tags: ["x"] },
    });
    for (const label of ["Write", "Row Plan", "red", "Owner", "Count", "Kinds"]) {
      await view.click("button", label);
      await view.click("button", label);
    }
    await view.click("button", "Hello");
    await view.click("button", "Shout");
    // prettier-ignore
    expect(log(view.container)).toEqual([
      "Write", "first Write", "Write",
      "row Plan", "saved Plan", "row Plan",
      "red", "red", "Ada", "Ada", "click", "click", "hello ADA", "greet ADA 1",
    ]);
    expect(view.events).toEqual([
      ["first", "red"],
      ["first", "Ada"],
      ["track", "first-click", 1],
    ]);
    expect(view.get("p").textContent).toBe("keydown");
    await view.click("button", "Tag");
    expect(view.get("p").textContent).toBe("x new");
  });
});

describe("a called function's value", () => {
  it("never prevents the event, in a list or not, inline, moved to a method or by name", async () => {
    const view = await render(Returns, [], { rows: ["a"] });
    expect(await view.dispatch('input[aria-label="Query"]', key("x"))).toBe(true);
    expect(await view.dispatch('input[aria-label="a"]', key("y"))).toBe(true);
    expect(view.get('[role="status"]').textContent).toBe("a y");
    // A block body moved to a method, which returns `false` or a call's `false`: typing works.
    expect(await view.dispatch('input[aria-label="Search"]', key("b"))).toBe(true);
    expect(await view.dispatch('input[aria-label="Search"]', key("Enter"))).toBe(true);
    expect(await view.dispatch('input[aria-label="Mixed"]', key("Escape"))).toBe(true);
    expect(await view.dispatch('input[aria-label="Mixed"]', key("c"))).toBe(true);
    expect(view.get("output").textContent).toBe("12");
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    expect(await view.dispatch("a", click)).toBe(true);
    expect(view.get('[role="status"]').textContent).toBe("toggled");
    // Returns of a value without effects are dropped, a call's effects kept.
    expect(await view.dispatch('input[aria-label="Values"]', key("a"))).toBe(true);
    expect(await view.dispatch('input[aria-label="Values"]', key("x"))).toBe(true);
    expect(await view.dispatch('input[aria-label="Values"]', key("Enter"))).toBe(true);
    expect(view.get("output").textContent).toBe("114");
    await view.click("button", "Counted");
    await view.click("button", "Unselected");
    expect(view.get("output").textContent).toBe("116");
    await view.click("button", "a");
    expect(view.get('[role="status"]').textContent).toBe("a after none");
    await view.click("button", "a");
    expect(view.get('[role="status"]').textContent).toBe("a after a");
  });
});

describe("events named like a setup binding", () => {
  it("arrive by the event's name, from the renamed function, state and template ref", async () => {
    const view = await render(Collisions, CollisionsEvents, { rows: ["a", "b"] });
    await view.click("button", "Next");
    expect(view.get("p").textContent).toBe("Page 2");
    await view.click("button", "a");
    await view.click("button", "a");
    await view.click("button", "Focus");
    expect(document.activeElement).toBe(view.get('input[aria-label="Name"]'));
    const submit = new SubmitEvent("submit", { bubbles: true, cancelable: true });
    expect(await view.dispatch("form", submit)).toBe(false);
    expect(view.events).toEqual([
      ["page", 2],
      ["toggle", "a", true],
      ["toggle", "a", false],
      ["field"],
      ["save", { name: "Ada" }],
    ]);
  });
});
