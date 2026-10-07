// The types of handlers' event parameters in the Svelte output (ADR-0047). The source annotates
// an event parameter with lib.dom's interface (`(event: InputEvent)` for `onInput`), and Svelte's
// element types hand an attribute's handler their own (`Event` for `oninput`, `MouseEvent` for
// `onclick`), which such a handler does not accept (svelte-check, TS2322). A parameter whose
// annotation some of the events it receives do not extend takes the nearest interface they and
// the annotation all extend: the members the handler may use are those every target's event
// carries (`PORTABLE_EVENT_MEMBERS`, UF3032), which that interface has. An unannotated parameter
// of a setup function takes the nearest interface of what it receives.
import { codeKind, parseCodeSource } from "@unframework/codegen";
import { EVENT_INTERFACES, extendsEventInterface, walk } from "@unframework/ir";
import type { BindingId, FunctionCode, Handler, Parameter, UfComponent } from "@unframework/ir";

import { visit } from "./ast.ts";
import { commonInterface, handlerInterface } from "./events.ts";

/**
 * Each function (a setup function or an inline handler) one of whose event parameters needs
 * another type in the Svelte output, with that type in place.
 */
export function handlerTypes(component: UfComponent): Map<FunctionCode, FunctionCode> {
  const functions = new Map<BindingId, FunctionCode>();
  for (const item of component.setup) {
    if (item.kind === "Function") functions.set(item.binding, item.function);
  }
  // What each parameter receives, by function and parameter index.
  const received = new Map<FunctionCode, Map<number, Set<string>>>();
  const pending: [FunctionCode, number][] = [];
  const receive = (fn: FunctionCode, index: number, interfaces: Iterable<string>) => {
    let byIndex = received.get(fn);
    if (!byIndex) received.set(fn, (byIndex = new Map()));
    let set = byIndex.get(index);
    if (!set) byIndex.set(index, (set = new Set()));
    let grew = false;
    for (const each of interfaces) {
      if (!set.has(each)) {
        set.add(each);
        grew = true;
      }
    }
    if (grew) pending.push([fn, index]);
  };
  walk(component.render, {
    enter(node) {
      if (node.kind !== "Element") return;
      for (const attribute of node.attributes) {
        if (attribute.kind !== "Event") continue;
        const fn = handlerFunction(attribute.handler, functions);
        if (fn?.parameters.length) receive(fn, 0, [handlerInterface(attribute, node)]);
      }
    },
  });
  // A function hands its event parameter on to a setup function it calls with it.
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    const [fn, index] = next;
    const name = fn.parameters[index]?.name;
    if (name === undefined) continue;
    const interfaces = received.get(fn)!.get(index)!;
    for (const [callee, argument] of callsWith(fn, name, component)) {
      const target = functions.get(callee);
      if (target && target.parameters[argument]) receive(target, argument, interfaces);
    }
  }

  const changed = new Map<FunctionCode, FunctionCode>();
  const setupFunctions = new Set(functions.values());
  for (const [fn, byIndex] of received) {
    let parameters: Parameter[] | undefined;
    for (const [index, interfaces] of byIndex) {
      const parameter = fn.parameters[index];
      if (!parameter || parameter.event === undefined) continue;
      const type = parameterType(parameter, interfaces, setupFunctions.has(fn));
      if (type === undefined) continue;
      parameters ??= [...fn.parameters];
      parameters[index] = {
        ...parameter,
        type: { code: type, span: parameter.type?.span ?? parameter.span },
      };
    }
    if (parameters) changed.set(fn, { ...fn, parameters });
  }
  return changed;
}

/**
 * The type a parameter takes instead of its own, or `undefined` to keep it: its annotation when
 * every event it receives extends it (one of its interfaces, for a union such as
 * `MouseEvent | KeyboardEvent`); otherwise the nearest interface they and the annotation's
 * interfaces extend. An unannotated inline handler's parameter keeps no annotation (Svelte's
 * types give it one); a setup function's takes the nearest interface of what it receives.
 */
function parameterType(
  parameter: Parameter,
  interfaces: ReadonlySet<string>,
  setupFunction: boolean,
): string | undefined {
  const written = parameter.type?.code;
  if (written === undefined) return setupFunction ? commonInterface(interfaces) : undefined;
  const members = written
    .split("|")
    .map((member) => member.trim())
    .filter((member) => member !== "");
  if (!members.length || !members.every((member) => EVENT_INTERFACES.has(member))) {
    return undefined;
  }
  const accepted = [...interfaces].every((received) =>
    members.some((member) => extendsEventInterface(received, member)),
  );
  return accepted ? undefined : commonInterface([...members, ...interfaces]);
}

/**
 * The setup functions a function calls with its parameter `name` as an argument, each with the
 * argument's index: `pick(item, event)` hands `event` on as `pick`'s second parameter.
 */
function callsWith(fn: FunctionCode, name: string, component: UfComponent): [BindingId, number][] {
  const body = fn.body;
  const calls = body.refs.flatMap((reference) =>
    reference.kind === "Binding" && reference.call === true ? [reference] : [],
  );
  if (!calls.length) return [];
  let root: unknown;
  try {
    root = parseCodeSource(body.code, codeKind(body, component)).root;
  } catch {
    return [];
  }
  const found: [BindingId, number][] = [];
  visit(root, (node) => {
    if (node.type !== "CallExpression") return;
    const callee = node["callee"] as { start: number; end: number };
    const reference = calls.find(
      ({ span }) =>
        span.start - body.span.start === callee.start && span.end - body.span.start === callee.end,
    );
    if (!reference) return;
    const args = node["arguments"] as { type: string; name?: string }[];
    args.forEach((argument, index) => {
      if (argument.type === "Identifier" && argument.name === name) {
        found.push([reference.binding, index]);
      }
    });
  });
  return found;
}

/** The function a handler runs: the setup function it names, or its own. */
function handlerFunction(
  handler: Handler,
  functions: ReadonlyMap<BindingId, FunctionCode>,
): FunctionCode | undefined {
  switch (handler.kind) {
    case "Function":
      return functions.get(handler.binding);
    case "Inline":
      return handler.function;
    default:
      return unreachable(handler);
  }
}

function unreachable(value: never): never {
  throw new Error(`Unexpected IR value: ${JSON.stringify(value)}`);
}
