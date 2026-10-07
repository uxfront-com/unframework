// Element listeners and template refs (ADR-0047, ADR-0049): Vue's names lowered to the DOM's
// event and one option (UF3004, UF3006), handlers that name a local function or are written in
// place (UF3029), and template refs attached once, outside lists (UF3027). Every run checks the
// IR's invariants.
import type { Attribute, ElementNode, FunctionItem } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import { listenerName } from "../src/listeners.ts";
import { applyAndRecheck, functionOf, only, problems, root, setupOf } from "./helpers.ts";

/** An element's listeners and refs, compactly. */
function ownAttributes(source: string, element: ElementNode): string[] {
  return element.attributes.flatMap((attribute: Attribute) => {
    if (attribute.kind === "Ref") return [`ref ${attribute.binding.split("@")[0]}`];
    if (attribute.kind !== "Event") return [];
    const option = attribute.capture
      ? " capture"
      : attribute.once
        ? " once"
        : attribute.passive
          ? " passive"
          : "";
    const { handler } = attribute;
    return [
      `${attribute.event}${option} → ${handler.kind === "Function" ? handler.binding.split("@")[0] : functionOf(source, handler.function)}`,
    ];
  });
}

describe("listener names", () => {
  it.each([
    ["onClick", "click", [], "onClick"],
    ["onKeydown", "keydown", [], "onKeydown"],
    ["onKeyDown", "keydown", [], "onKeydown"],
    ["onDoubleClick", "dblclick", [], "onDblclick"],
    ["onclick", "click", [], "onClick"],
    ["onClickCapture", "click", ["capture"], "onClickCapture"],
    ["onWheelPassive", "wheel", ["passive"], "onWheelPassive"],
    ["onclickonce", "click", ["once"], "onClickOnce"],
    ["onClickOnceCapture", "click", ["once", "capture"], "onClickOnceCapture"],
    ["onFoo", "foo", [], "onFoo"],
  ])("reads %s as `%s`", (authored, event, options, canonical) => {
    expect(listenerName(authored)).toEqual({ event, options, canonical });
  });

  it.each(["one", "onion", "only", "data-on"])("reads %s as no listener", (name) => {
    expect(listenerName(name)).toBeUndefined();
  });

  it("lowers the DOM's event and its option", () => {
    const { source, module, diagnostics } = setupOf(
      "function log() {}",
      '<div role="presentation" onClickCapture={log} onClick={log} onKeydownOnce={log} onWheelPassive={log} onDblclick={log} />',
    );
    expect(diagnostics).toEqual([]);
    expect(ownAttributes(source, root(module))).toEqual([
      "click capture → log",
      "click → log",
      "keydown once → log",
      "wheel passive → log",
      "dblclick → log",
    ]);
  });

  it("renames React's and lower-case names, with a safe fix (UF3004)", () => {
    const { source, diagnostics } = setupOf(
      "function log() {}",
      '<div role="presentation" onKeyDown={log} onDoubleClick={log} onclick={log} onMouseEnter={log} />',
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF3004 onKeyDown",
      "UF3004 onDoubleClick",
      "UF3004 onclick",
      "UF3004 onMouseEnter",
    ]);
    expect(applyAndRecheck(source, diagnostics)).toContain(
      '<div role="presentation" onKeydown={log} onDblclick={log} onClick={log} onMouseenter={log} />',
    );
  });

  it("reports what no element listens to alike, two options and `Passive` where it does nothing (UF3006)", () => {
    const { source, diagnostics } = setupOf(
      "function log() {}",
      '<div role="presentation" onHashchange={log} onSelectionchange={log} onFoo={log} onClickOnceCapture={log} onClickPassive={log} />',
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF3006 onHashchange",
      "UF3006 onSelectionchange",
      "UF3006 onFoo",
      "UF3006 onClickOnceCapture",
      "UF3006 onClickPassive",
    ]);
    expect(diagnostics[0]!.message).toBe(
      "`onHashchange` listens to `hashchange`, which only the window receives: a listener on <div> never runs.",
    );
  });

  it("reports a listener set twice for one event and option (UF3007)", () => {
    const { source, diagnostics } = setupOf(
      "function log() {}",
      '<div role="presentation" onClick={log} onClickCapture={log} onclick={log} />',
    );
    expect(problems(source, diagnostics)).toEqual(["UF3004 onclick", "UF3007 onclick"]);
  });
});

describe("handlers", () => {
  it("lowers a local function's name and an arrow function, its parameter the event", () => {
    const { source, module, diagnostics } = setupOf(
      "const count = ref(0); function save() {} function key(event: KeyboardEvent) { console.log(event.key); }",
      '<div role="presentation" onClick={save} onKeyup={key} onKeydown={(event) => console.log(event.code)} onFocusin={(event: UIEvent) => console.log(event.type)} onBlur={async () => { await nextTick(); count.value = 0; }} />',
    );
    expect(diagnostics).toEqual([]);
    expect(ownAttributes(source, root(module))).toEqual([
      "click → save",
      "keyup → key",
      "keydown → (event <KeyboardEvent>) => console.log(event.code) [global:console, event.code]",
      "focusin → (event: UIEvent <UIEvent>) => console.log(event.type) [global:console, event.type]",
      "blur → async () => { await nextTick(); count.value = 0; } [api:nextTick, write count = count.value = 0]",
    ]);
  });

  it("reports any other handler (UF3029)", () => {
    const { source, diagnostics } = setupOf(
      "const emit = defineEmits<{ close: [] }>(); function save() {} function pick(id: string) { console.log(id); } function key(event: KeyboardEvent) { console.log(event.key); }",
      '<div role="presentation" onClick={save()} onDblclick={emit} onKeydown={true ? save : key} onKeyup={function () {}} onFocus={pick} onBlur={key} onInput={(event: KeyboardEvent) => console.log(event)} onChange="save()" onMousedown={label} />',
      "label: string",
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF3029 save()",
      "UF3029 emit",
      "UF3029 true ? save : key",
      "UF3029 function () {}",
      "UF3029 pick",
      "UF3029 key",
      "UF3029 event: KeyboardEvent",
      'UF3029 "save()"',
      "UF3029 label",
    ]);
  });

  it("takes an event parameter typed with a union of the events it handles, judged by their common interface", () => {
    const { source, module, diagnostics } = setupOf(
      'const emit = defineEmits<{ activated: [kind: string] }>(); function activate(event: MouseEvent | KeyboardEvent) { event.preventDefault(); emit("activated", event.type); } function onKeydown(event: KeyboardEvent) { if (event.key === "Enter" || event.key === " ") activate(event); }',
      '<div><div role="button" tabindex="0" onClick={activate} onKeydown={onKeydown}>Activate</div><button type="button" onClick={(event: MouseEvent | KeyboardEvent) => emit("activated", event.type)}>Inline</button></div>',
    );
    expect(problems(source, diagnostics)).toEqual([]);
    const fn = only(module).setup.find((item) => item.kind === "Function");
    expect(functionOf(source, (fn as FunctionItem).function)).toBe(
      '(event: MouseEvent | KeyboardEvent <UIEvent>) => { event.preventDefault(); emit("activated", event.type); } [event.preventDefault(), emit activated(event.type), event.type]',
    );
  });

  it("reports a union that holds no interface of the event, and a member only some of its events have (UF3029, UF3032)", () => {
    const { source, diagnostics } = setupOf(
      "function focusOrKey(event: FocusEvent | KeyboardEvent) { console.log(event.type); } function either(event: MouseEvent | KeyboardEvent) { console.log(event.key); }",
      '<div><button type="button" onClick={focusOrKey}>A</button><button type="button" onClick={either} onKeydown={either}>B</button><button type="button" onClick={(event: FocusEvent | KeyboardEvent) => console.log(event.type)}>C</button></div>',
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF3032 event.key",
      "UF3029 focusOrKey",
      "UF3029 event: FocusEvent | KeyboardEvent",
    ]);
    expect(diagnostics[1]!.message).toBe(
      "`click` dispatches a PointerEvent, and `focusOrKey` takes a FocusEvent or KeyboardEvent.",
    );
  });

  it("keeps a handler in a list to one call Angular's template statements read (UF3029)", () => {
    const { source, diagnostics } = setupOf(
      'const picked = ref(""); function pick(id: string) { picked.value = id; }',
      '<ul>{items.map((item) => <li key={item}><button type="button" onClick={() => pick(item)}>Pick</button><button type="button" onDblclick={() => { picked.value = item; }}>Set</button><button type="button" onKeydown={() => pick(item as string)}>Key</button></li>)}</ul>',
      "items: string[]",
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF3029 () => { picked.value = item; }",
      "UF3029 item as string",
    ]);
  });
});

describe("template refs", () => {
  it("lowers `ref` to the template ref it attaches", () => {
    const { source, module, diagnostics } = setupOf(
      "const field = useTemplateRef<HTMLInputElement>(); function focus() { field.value?.focus(); }",
      '<div><input ref={field} /><button type="button" onClick={focus}>Focus</button></div>',
    );
    expect(diagnostics).toEqual([]);
    const input = root(module).children[0] as ElementNode;
    expect(ownAttributes(source, input)).toEqual(["ref field"]);
  });

  it("renames `ref` written in another case, with a safe fix (UF3004)", () => {
    const { source, diagnostics } = setupOf(
      "const field = useTemplateRef<HTMLInputElement>();",
      "<input Ref={field} />",
    );
    expect(problems(source, diagnostics)).toEqual(["UF3004 Ref"]);
    expect(applyAndRecheck(source, diagnostics)).toContain("<input ref={field} />");
  });

  it("reports a ref that is no template ref, one attached twice, in a list or never (UF3027)", () => {
    const { source, diagnostics } = setupOf(
      "const field = useTemplateRef<HTMLInputElement>(); const row = useTemplateRef(); const unused = useTemplateRef(); const count = ref(0);",
      '<div><input ref={field} /><input ref={field} /><p ref={count} /><p ref="name" /><p ref={(element) => element} />{items.map((item) => <b key={item} ref={row}>{item}</b>)}</div>',
      "items: string[]",
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF3027 ref={field}",
      "UF3027 count",
      'UF3027 "name"',
      "UF3027 {(element) => element}",
      "UF3027 ref={row}",
      "UF3027 unused",
    ]);
  });
});
