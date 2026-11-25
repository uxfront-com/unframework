// An async setup on React (ADR-0101). React has no async component: a component that suspends
// on a promise it makes in render gets a new promise at each retry, and React throws after 100.
// So one module holds three functions. A module-level `async` function runs the awaits in order
// and returns what they resolved to (`profileSetup`). The exported component starts it once,
// holds its promise in state and renders, inside a `<Suspense>`, the component as it is without
// awaits (`ProfileResolved`), whose first statement reads the setup with `use`. The fallback,
// a `SetupPending` component, renders nothing and tells the component once the setup settles, so
// React shows the content at once rather than after its fallback throttle. It mounts only where
// the fallback commits: never on the server and never while the client hydrates, where a render
// of the boundary with new props would make React drop the server's DOM.
import { js, typeNames } from "@unframework.dev/codegen";
import type { JsxContext } from "@unframework.dev/codegen";
import type { AwaitItem, BindingId, TypeParameter, UfComponent } from "@unframework.dev/ir";

import type { ReactPlan } from "./plan.ts";
import type { ReactCode } from "./rules.ts";

type FunctionNode = ReturnType<typeof js.functionDeclaration>;
type Parameter = Parameters<typeof js.functionDeclaration>[1][number];

/** The awaits of a component's setup, in order: they open it (S1). */
export function awaitsOf(component: UfComponent): Array<AwaitItem> {
  return component.setup.filter((item): item is AwaitItem => item.kind === "Await");
}

/** The component without its awaits: the resolved component prints what the rest reads. */
export function withoutAwaits(component: UfComponent): UfComponent {
  return { ...component, setup: component.setup.filter((item) => item.kind !== "Await") };
}

/** The awaited bindings the resolved component reads, in the setup's order. */
function readAwaits(component: UfComponent, context: JsxContext): Array<AwaitItem> {
  return awaitsOf(component).filter((item) => context.referenced.has(item.binding));
}

/**
 * The setup function, `async function profileSetup({ id }: { id: string }) { … }`: each await
 * as the source writes it, then the values the resolved component reads. It takes the props
 * the awaits read, with their defaults, typed as the component's props, and the type
 * parameters that type names; nothing where the awaits read no prop. An awaited value only a
 * later await reads, or none, is awaited without a name, which would be unused (L5).
 */
export function setupFunction(plan: ReactPlan, code: ReactCode, context: JsxContext): string {
  const names = plan.helpers.async!;
  const component = plan.owner;
  const awaits = awaitsOf(component);
  const returned = readAwaits(component, context);
  const needed = new Set<BindingId>(returned.map(({ binding }) => binding));
  const props = new Set<BindingId>();
  for (const item of awaits) {
    for (const reference of item.value.refs) {
      if (reference.kind !== "Binding") {
        continue;
      }
      const kind = plan.bindings.get(reference.binding)?.kind;
      if (kind === "awaited") {
        needed.add(reference.binding);
      } else if (kind === "prop") {
        props.add(reference.binding);
      }
    }
  }
  const lines = awaits.map((item) => {
    const value = `await ${code.code(item.value, "pure")};`;
    if (!needed.has(item.binding)) {
      return value;
    }
    const type = item.type ? `: ${item.type.code}` : "";
    return `const ${plan.bindings.get(item.binding)!.name}${type} = ${value}`;
  });
  if (returned.length) {
    const members = returned.map(({ binding }) => plan.bindings.get(binding)!.name);
    lines.push(`return { ${members.join(", ")} };`);
  }
  const parameter = setupParameter(component, props);
  const generic = setupTypeParameters(component, props.size > 0);
  const declared = generic.length ? `<${generic.map(typeParameterText).join(", ")}>` : "";
  return `async function ${names.setup}${declared}(${parameter}) {\n${lines.join("\n")}\n}`;
}

/** The setup function's parameter: the props the awaits read, as the component declares them. */
function setupParameter(component: UfComponent, read: ReadonlySet<BindingId>): string {
  const parameter = component.propsParameter;
  if (!parameter || !read.size) {
    return "";
  }
  if (parameter.form === "object") {
    return `${parameter.name!}: ${parameter.type.code}`;
  }
  const properties = component.props.flatMap((prop) =>
    prop.binding !== undefined && read.has(prop.binding)
      ? [prop.default ? `${prop.name} = ${prop.default.code}` : prop.name]
      : [],
  );
  return `{ ${properties.join(", ")} }: ${parameter.type.code}`;
}

/**
 * The type parameters of a generic component that the props' type names, with those their
 * constraints and defaults name in turn (ADR-0068): the setup function declares them where it
 * takes the props, and the resolved component's `setup` prop passes them.
 */
function setupTypeParameters(component: UfComponent, takesProps: boolean): Array<TypeParameter> {
  const parameters = component.typeParameters ?? [];
  const type = component.propsParameter?.type;
  if (!takesProps || !parameters.length || !type) {
    return [];
  }
  const named = new Set(typeNames(type));
  let kept: Array<TypeParameter> = [];
  while (true) {
    const next = parameters.filter(({ name }) => named.has(name));
    if (next.length === kept.length) {
      return kept;
    }
    kept = next;
    for (const { constraint, default: initial } of kept) {
      for (const text of [constraint, initial]) {
        if (text) {
          for (const name of typeNames(text)) {
            named.add(name);
          }
        }
      }
    }
  }
}

/** A type parameter as its component declares it, `T extends Item = Item` (ADR-0068). */
function typeParameterText(parameter: TypeParameter): string {
  const constraint = parameter.constraint ? ` extends ${parameter.constraint.code}` : "";
  return `${parameter.name}${constraint}${parameter.default ? ` = ${parameter.default.code}` : ""}`;
}

/**
 * The type of the props the outer component passes the resolved one besides its own:
 * `{ setup: ReturnType<typeof profileSetup>; settled: boolean }`.
 */
export function resolvedPropsType(plan: ReactPlan): string {
  const names = plan.helpers.async!;
  const component = plan.owner;
  const takesProps = setupFunctionTakesProps(component, plan);
  const generic = setupTypeParameters(component, takesProps);
  const passed = generic.length ? `<${generic.map(({ name }) => name).join(", ")}>` : "";
  return `{ ${names.promise}: ReturnType<typeof ${names.setup}${passed}>; ${names.settled}: boolean }`;
}

/** Whether the awaits read a prop, so that the setup function takes the props. */
function setupFunctionTakesProps(component: UfComponent, plan: ReactPlan): boolean {
  return awaitsOf(component).some((item) =>
    item.value.refs.some(
      (reference) =>
        reference.kind === "Binding" && plan.bindings.get(reference.binding)?.kind === "prop",
    ),
  );
}

/**
 * The resolved component's first statement: `const { user } = use(setup);`, or `use(setup);`
 * where it reads no awaited value. A props object reads the promise off it.
 */
export function useSetup(plan: ReactPlan, context: JsxContext): string {
  const names = plan.helpers.async!;
  const use = plan.names.add("react", "use");
  const parameter = plan.owner.propsParameter;
  const promise =
    parameter?.form === "object" ? `${parameter.name!}.${names.promise}` : names.promise;
  const read = readAwaits(plan.owner, context).map(
    ({ binding }) => plan.bindings.get(binding)!.name,
  );
  return read.length ? `const { ${read.join(", ")} } = ${use}(${promise});` : `${use}(${promise});`;
}

/**
 * The exported component: it starts the setup once, as its first render's props give it, and
 * renders the resolved component with every prop it takes (className, style, slots, models,
 * events, scope attributes and the `ref` its handle goes to) inside a `<Suspense>` whose fallback
 * is `SetupPending`. `settled` re-renders the boundary with new props once the setup settles,
 * so React Compiler's memoised element cannot keep the content waiting.
 */
export function outerComponent(
  plan: ReactPlan,
  context: JsxContext,
  propsType: string | undefined,
): FunctionNode {
  const names = plan.helpers.async!;
  const component = plan.owner;
  const useState = plan.names.add("react", "useState");
  const suspense = plan.names.add("react", "Suspense");
  const passes = propsType !== undefined;
  const argument = passes && setupFunctionTakesProps(component, plan) ? names.props : "";
  const spread = passes ? `{...${names.props}} ` : "";
  const body = [
    `const [${names.promise}] = ${useState}(() => ${names.setup}(${argument}));`,
    `const [${names.settled}, ${names.setSettled}] = ${useState}(false);`,
    "",
    "return (",
    `<${suspense} fallback={<${names.pending} setup={${names.promise}} onSettled={${names.setSettled}} />}>`,
    `<${names.resolved} ${spread}${names.promise}={${names.promise}} ${names.settled}={${names.settled}} />`,
    `</${suspense}>`,
    ");",
  ].join("\n");
  const parameters: Array<Parameter> = passes
    ? [js.bindingIdentifier(names.props, context.placeholders.type(propsType))]
    : [];
  return js.functionDeclaration(component.name, parameters, [
    context.placeholders.statements(body),
  ]);
}

/**
 * `SetupPending`: the fallback that renders nothing and calls `onSettled(true)` once the setup
 * settles, resolved or rejected, unless it has unmounted by then.
 */
export function setupPendingHelper(name: string, useEffect: string): string {
  return `/**
 * Renders nothing while a setup runs, and tells the component once it settles, so React shows the
 * content at once rather than after its fallback throttle. Only a fallback React commits runs it:
 * never on the server, and never while the client hydrates.
 */
function ${name}({
  setup,
  onSettled,
}: {
  setup: Promise<unknown>;
  onSettled: (settled: boolean) => void;
}): null {
  ${useEffect}(() => {
    let live = true;
    const settle = () => {
      if (live) onSettled(true);
    };
    setup.then(settle, settle);
    return () => {
      live = false;
    };
  }, [setup, onSettled]);
  return null;
}`;
}
