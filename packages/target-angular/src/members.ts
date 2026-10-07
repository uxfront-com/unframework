// The component class's members (plan §6, ADR-0034, ADR-0046), in the order an Angular class reads:
// inputs, outputs, view queries and injected services, the function fields (a local function code
// passes as a value), then the setup's state, derived values, ids, constants and variables in source
// order, the members that hold effects, then the members the template reads for globals; the
// constructor (effects that need no input: `watchEffect`, `onMounted`), `ngOnInit` (what needs the
// inputs: seeded values, watchers), `ngOnDestroy` (cleanups that may emit, `onUnmounted`), then the
// methods. The function fields come first: a field initialiser that runs code (an initial value
// that calls a function, which passes one of them on) runs while the class constructs, in field
// order, and a function field declared after it would not be there yet, where the source's
// function, hoisted, is.
import {
  functionBodyText,
  functionText,
  js,
  kebabCase,
  parameterText,
  pascalCase,
  rewriteCode,
} from "@unframework/codegen";
import type { Placeholders, RewriteRules } from "@unframework/codegen";
import type { Code, Prop, TypeDeclaration } from "@unframework/ir";

import { arrow, lifecycleCode, watchEffectCode, watcherCode } from "./effects.ts";
import type { EffectCode, EffectNames } from "./effects.ts";
import type { HandlerMethod } from "./listeners.ts";
import { bindingById, formOf, unreachable } from "./plan.ts";
import type { Plan } from "./plan.ts";
import { outputType, tidied } from "./rules.ts";
import { parenthesised, valueType } from "./seeded.ts";
import { withoutUndefined } from "./types.ts";

type Member = ReturnType<typeof js.propertyDefinition> | ReturnType<typeof js.methodDefinition>;

/** The services the class injects, in the order it declares them. */
const SERVICES = ["injector", "platformId", "appRef"] as const;

/** Each service's token, by the member that holds it. */
const TOKENS: Readonly<Record<(typeof SERVICES)[number], string>> = {
  injector: "Injector",
  platformId: "PLATFORM_ID",
  appRef: "ApplicationRef",
};

/** What the class's members need from the rest of the emitter. */
export interface MemberContext {
  plan: Plan;
  placeholders: Placeholders;
  /** The types the props reach, for an input with a default whose type admits `undefined`. */
  declarations: readonly TypeDeclaration[];
  rules: RewriteRules;
  /** The members the template reads, which it sees only when they are `protected`. */
  templateMembers: ReadonlySet<string>;
  /** The globals the template reads: each is a member of its own name. */
  globals: readonly string[];
  /** The methods listeners' handlers moved to. */
  handlers: readonly HandlerMethod[];
  /** The members that remember the elements a once listener ran on (./listeners.ts). */
  guards: readonly string[];
  /** The guard method a group's once listener runs under, when one does (./listeners.ts). */
  once?: string;
  /** The `nextTick` helper's name, when code calls `nextTick()`. */
  nextTick?: string;
  /** The module-level counter ids are made from, when the component declares one. */
  nextId?: string;
}

/** The class's members, and the interfaces it implements (`OnInit`). */
export function classMembers(context: MemberContext): {
  members: Member[];
  implements: string[];
} {
  const { plan, placeholders } = context;
  const { component, imports } = plan;
  const core = (name: string) => imports.add("@angular/core", name);
  const members: Member[] = component.props.map((prop) =>
    inputMember(prop, core("input"), placeholders, context.declarations),
  );
  for (const event of component.emits?.events ?? []) {
    members.push(
      js.propertyDefinition(
        event.name,
        js.callExpression(
          js.identifier(core("output")),
          [],
          [placeholders.type(outputType(event))],
        ),
        { readonly: true },
      ),
    );
  }
  // View queries next to the inputs and outputs, as Angular's guide groups them.
  for (const item of component.setup) {
    if (item.kind !== "TemplateRef") continue;
    const name = bindingById(plan, item.binding).name;
    const element = `${core("ElementRef")}<${item.type?.code ?? "unknown"}>`;
    members.push(
      js.propertyDefinition(
        name,
        js.callExpression(
          js.identifier(core("viewChild")),
          [js.stringLiteral(name)],
          [placeholders.type(element)],
        ),
        { accessibility: "private", readonly: true },
      ),
    );
  }

  // Injected services, claimed on first use (code is built before the members are listed).
  const injected = new Map<string, { member: string; token: string }>();
  const names: EffectNames = {
    core,
    common: (name) => imports.add("@angular/common", name),
    type: (name) => imports.add("@angular/core", name, { type: true }),
    member: (name) => {
      let entry = injected.get(name);
      if (!entry) {
        entry = { member: plan.members.claim(name), token: TOKENS[name] };
        injected.set(name, entry);
      }
      return entry.member;
    },
  };

  const fields: Member[] = [];
  const arrows: Member[] = [];
  // Each a block of statements: a hook or a watcher, or the reads of the seeded values.
  const constructorCode: string[] = [];
  const initCode: string[] = [];
  const destroyCode: string[] = [];
  const unmounted: string[] = [];
  const refs: Member[] = [];
  /** Adds an effect's code: its statements, its member, what `ngOnDestroy` runs. */
  const effect = (into: string[], code: EffectCode, hook = false) => {
    if (code.code !== undefined) into.push(code.code);
    if (code.ref) {
      const member = js.propertyDefinition(code.ref.name, null, {
        accessibility: "private",
        readonly: !code.ref.optional,
        typeAnnotation: placeholders.type(code.ref.type),
      });
      refs.push(code.ref.optional ? { ...member, optional: true } : member);
    }
    if (code.destroy !== undefined) (hook ? unmounted : destroyCode).push(code.destroy);
  };
  let pins: string[] | undefined;
  /**
   * Reads a seeded value in `ngOnInit` (`this.amount();`), or assigns a seeded `let`, so that it
   * keeps the inputs' first values.
   */
  const pin = (statement: string) => {
    if (pins === undefined) {
      pins = ["// Read once the inputs are set: these keep the values they start with."];
      initCode.push("");
    }
    pins.push(statement);
    initCode[initCode.length - 1] = pins.join("\n");
  };
  const methods: Member[] = [];
  const visibility = (name: string) =>
    context.templateMembers.has(name) ? ("protected" as const) : ("private" as const);
  const expression = (code: string) => placeholders.expression(code);
  const typed = (type: string | undefined) => (type ? [placeholders.type(type)] : []);

  for (const item of component.setup) {
    switch (item.kind) {
      case "State": {
        const { name } = bindingById(plan, item.binding);
        const form = formOf(plan, bindingById(plan, item.binding));
        const type = item.type
          ? item.initial
            ? item.type.code
            : `${parenthesised(item.type.code)} | undefined`
          : undefined;
        const initial = item.initial ? pure(context, item.initial) : "undefined";
        let value: ReturnType<typeof js.callExpression>;
        switch (form) {
          case "linked":
            value = js.callExpression(
              js.identifier(core("linkedSignal")),
              [expression(arrow(`${core("untracked")}(${arrow(initial)})`))],
              typed(type),
            );
            pin(`this.${name}();`);
            break;
          case "signal":
            value = js.callExpression(
              js.identifier(core("signal")),
              [expression(initial)],
              typed(type),
            );
            break;
          default:
            throw new Error(`A state is declared as ${form}.`);
        }
        fields.push(
          js.propertyDefinition(name, value, { accessibility: visibility(name), readonly: true }),
        );
        break;
      }
      case "Derived": {
        const { name } = bindingById(plan, item.binding);
        const getter = functionText(item.getter, component, context.rules, "pure");
        fields.push(
          js.propertyDefinition(
            name,
            js.callExpression(
              js.identifier(core("computed")),
              [expression(getter)],
              typed(item.type?.code),
            ),
            { accessibility: visibility(name), readonly: true },
          ),
        );
        break;
      }
      case "TemplateRef":
        break;
      case "Id": {
        const { name } = bindingById(plan, item.binding);
        if (context.nextId === undefined) throw new Error("An id is declared without a counter.");
        // Angular has no id API: a module counter, as Angular Material writes its ids. The
        // component's name keeps two components' ids apart.
        const id = `\`uf-id-${kebabCase(component.name)}-\${${context.nextId}++}\``;
        fields.push(
          js.propertyDefinition(name, expression(id), {
            accessibility: visibility(name),
            readonly: true,
          }),
        );
        break;
      }
      case "Const": {
        const binding = bindingById(plan, item.binding);
        const value = pure(context, item.value);
        const form = formOf(plan, binding);
        switch (form) {
          case "once":
            fields.push(
              js.propertyDefinition(
                binding.name,
                js.callExpression(
                  js.identifier(core("computed")),
                  [expression(arrow(`${core("untracked")}(${arrow(value)})`))],
                  typed(item.type?.code),
                ),
                { accessibility: visibility(binding.name), readonly: true },
              ),
            );
            pin(`this.${binding.name}();`);
            break;
          case "value":
            fields.push(
              js.propertyDefinition(binding.name, expression(value), {
                accessibility: visibility(binding.name),
                readonly: true,
                ...(item.type ? { typeAnnotation: placeholders.type(item.type.code) } : {}),
              }),
            );
            break;
          default:
            throw new Error(`A constant is declared as ${form}.`);
        }
        break;
      }
      case "Variable": {
        const { name } = bindingById(plan, item.binding);
        if (plan.seeded.has(item.binding) && item.initial) {
          // Its initial value reads an input: assigned once the inputs are set, in source order
          // with the seeded values, and declared with its type, which nothing infers then.
          let type = item.type?.code ?? valueType(item.initial, plan, context.declarations);
          if (type === undefined) {
            const initial = plan.members.claim(`initial${pascalCase(name)}`);
            type = `ReturnType<typeof this.${initial}>`;
            methods.push(
              js.methodDefinition(
                initial,
                [],
                statements(placeholders, `return ${pure(context, item.initial)};`),
                { accessibility: "private" },
              ),
            );
            pin(`this.${name} = this.${initial}();`);
          } else {
            pin(`this.${name} = ${pure(context, item.initial)};`);
          }
          // Definitely assigned: `ngOnInit` assigns it before any code reads it.
          const field = js.propertyDefinition(name, null, {
            accessibility: "private",
            typeAnnotation: placeholders.type(type),
          });
          fields.push({ ...field, definite: true });
          break;
        }
        // Without an initial value its type admits `undefined` (UF2021), as the field's does.
        fields.push(
          js.propertyDefinition(
            name,
            item.initial ? expression(pure(context, item.initial)) : null,
            {
              accessibility: "private",
              ...(item.type ? { typeAnnotation: placeholders.type(item.type.code) } : {}),
            },
          ),
        );
        break;
      }
      case "Function": {
        const binding = bindingById(plan, item.binding);
        const fn = item.function;
        if (formOf(plan, binding) === "arrow") {
          arrows.push(
            js.propertyDefinition(
              binding.name,
              expression(
                tidied(functionText(fn, component, context.rules, "client"), "expression"),
              ),
              { accessibility: visibility(binding.name), readonly: true },
            ),
          );
          break;
        }
        methods.push(
          js.methodDefinition(
            binding.name,
            fn.parameters.map((parameter) => placeholders.parameter(parameterText(parameter))),
            statements(
              placeholders,
              tidied(functionBodyText(fn, component, context.rules, "client"), "statements"),
            ),
            {
              accessibility: visibility(binding.name),
              ...(fn.async ? { async: true } : {}),
              ...(fn.returnType ? { returnType: placeholders.type(fn.returnType.code) } : {}),
            },
          ),
        );
        break;
      }
      case "Watch":
        effect(initCode, watcherCode(item, plan, context.rules, names));
        pins = undefined;
        break;
      case "WatchEffect":
        effect(constructorCode, watchEffectCode(item, plan, context.rules, names));
        break;
      case "Lifecycle":
        effect(constructorCode, lifecycleCode(item, plan, context.rules, names), true);
        break;
      default:
        unreachable(item);
    }
  }

  for (const guard of context.guards) {
    // The elements a once listener ran on, which it never runs on again (./listeners.ts).
    fields.push(
      js.propertyDefinition(guard, expression("new WeakSet<EventTarget>()"), {
        accessibility: "protected",
        readonly: true,
      }),
    );
  }
  for (const handler of context.handlers) {
    methods.push(
      js.methodDefinition(
        handler.name,
        handler.parameters.map((parameter) => placeholders.parameter(parameter)),
        statements(placeholders, handler.body),
        { accessibility: "protected", ...(handler.async ? { async: true } : {}) },
      ),
    );
  }
  if (context.once !== undefined) {
    // `{ once: true }` removes a listener from its own element, before it runs: so a once
    // listener of a group runs the first time its element hears the event (ADR-0047).
    methods.push(
      js.methodDefinition(
        context.once,
        [
          placeholders.parameter("elements: WeakSet<EventTarget>"),
          placeholders.parameter("event: Event"),
        ],
        statements(
          placeholders,
          [
            "const element = event.currentTarget;",
            "if (element === null || elements.has(element)) return false;",
            "elements.add(element);",
            "return true;",
          ].join("\n"),
        ),
        { accessibility: "protected", returnType: placeholders.type("boolean") },
      ),
    );
  }
  if (context.nextTick !== undefined) {
    // Vue's `nextTick` (ADR-0048): Vue renders pending writes in a microtask, and `nextTick()`
    // resolves after it, so its continuation runs in the same task, before the next event of the
    // same input. Angular schedules its render for a later task: the helper renders the pending
    // change itself in a microtask, `ApplicationRef.tick()` (render hooks included), and resolves
    // after it.
    const appRef = names.member("appRef");
    methods.push(
      js.methodDefinition(
        context.nextTick,
        [],
        statements(placeholders, `await Promise.resolve();\nthis.${appRef}.tick();`),
        {
          accessibility: "private",
          async: true,
          returnType: placeholders.type("Promise<void>"),
        },
      ),
    );
  }

  const services = SERVICES.flatMap((name) => injected.get(name) ?? []).map(({ member, token }) =>
    js.propertyDefinition(
      member,
      js.callExpression(js.identifier(core("inject")), [js.identifier(core(token))]),
      { accessibility: "private", readonly: true },
    ),
  );
  const globals = context.globals.map((name) =>
    js.propertyDefinition(name, js.identifier(name), {
      accessibility: "protected",
      readonly: true,
    }),
  );
  const lifecycle: Member[] = [];
  const implementing: string[] = [];
  if (constructorCode.length) {
    lifecycle.push(
      js.methodDefinition(
        "constructor",
        [],
        statements(placeholders, constructorCode.join("\n\n")),
        {
          kind: "constructor",
        },
      ),
    );
  }
  if (initCode.length) {
    implementing.push(imports.add("@angular/core", "OnInit", { type: true }));
    lifecycle.push(
      js.methodDefinition("ngOnInit", [], statements(placeholders, initCode.join("\n\n")), {
        returnType: js.keywordType("void"),
      }),
    );
  }
  const teardown = [...destroyCode, ...unmounted];
  if (teardown.length) {
    implementing.push(imports.add("@angular/core", "OnDestroy", { type: true }));
    const why = destroyCode.length
      ? ["// Before Angular stops the outputs: a cleanup may still emit, as on every target."]
      : [];
    lifecycle.push(
      js.methodDefinition(
        "ngOnDestroy",
        [],
        statements(placeholders, [...why, ...destroyCode, ...unmounted].join("\n")),
        { returnType: js.keywordType("void") },
      ),
    );
  }
  return {
    members: [
      ...members,
      ...services,
      ...arrows,
      ...fields,
      ...refs,
      ...globals,
      ...lifecycle,
      ...methods,
    ],
    implements: implementing,
  };
}

/** Code the setup evaluates (an initial value, a constant), spelled for the class. */
function pure(context: MemberContext, code: Code): string {
  return rewriteCode(code, context.plan.component, context.rules, "pure");
}

/** A method's body as one statements placeholder, or none for an empty body. */
function statements(
  placeholders: Placeholders,
  code: string,
): ReturnType<Placeholders["statements"]>[] {
  return code.trim() === "" ? [] : [placeholders.statements(code)];
}

/**
 * A prop as a signal input, typed by its member's type as written:
 * - required: `readonly label = input.required<string>();`
 * - optional without a default: `readonly count = input<number>();`, whose value is
 *   `number | undefined` (Angular's own spelling of an optional input);
 * - with a default: `readonly tone = input<Tone, Tone | undefined>("info", { transform })`, whose
 *   transform turns `undefined` into the default. A destructured default applies to an absent
 *   prop and to an explicit `undefined` alike, while Angular's initial value covers only the
 *   first (`setInput(name, undefined)` sets `undefined`). `null` is a value, as in JavaScript,
 *   so the test is `=== undefined`, never `??` (ADR-0034).
 */
function inputMember(
  prop: Prop,
  input: string,
  placeholders: Placeholders,
  declarations: readonly TypeDeclaration[],
): Member {
  const callee = js.identifier(input);
  const { type, default: initial } = prop;
  if (!prop.optional) {
    const required = js.memberExpression(callee, "required");
    return readonlyField(prop, js.callExpression(required, [], [placeholders.type(type.code)]));
  }
  if (initial === undefined) {
    return readonlyField(prop, js.callExpression(callee, [], [placeholders.type(type.code)]));
  }
  const value = withoutUndefined(type.code, declarations);
  const transform = js.arrowFunction(
    [js.bindingIdentifier("value")],
    js.conditionalExpression(
      js.binaryExpression("===", js.identifier("value"), js.identifier("undefined")),
      placeholders.expression(initial.code),
      js.identifier("value"),
    ),
  );
  return readonlyField(
    prop,
    js.callExpression(
      callee,
      [placeholders.expression(initial.code), js.objectExpression([["transform", transform]])],
      [
        placeholders.type(value),
        js.unionType([placeholders.type(value), js.keywordType("undefined")]),
      ],
    ),
  );
}

/** `readonly name = …;`: public, as `strictInputAccessModifiers` requires of an input. */
function readonlyField(prop: Prop, value: Parameters<typeof js.propertyDefinition>[1]): Member {
  return js.propertyDefinition(prop.name, value, { readonly: true });
}
