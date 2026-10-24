// How the Astro output spells the component's references (ADR-0046). Astro renders once, on
// the server, so a value is the value itself: a `ref`'s and a `computed`'s `count.value` is
// `count`, which the frontmatter declares as a constant. Everything else is spelled as written,
// but for the names the compiled component already declares in the frontmatter's scope.
import { NameScope, sourceNames } from "@unframework/codegen";
import type { RewriteRules } from "@unframework/codegen";
import { RESERVED_PROP_NAMES } from "@unframework/ir";
import type { Binding, BindingId, UfComponent, UfModule } from "@unframework/ir";

/**
 * Names the compiled component already gives a meaning in the frontmatter's scope: the global
 * a component reads its props from, and the component Astro's compiler renders `<>` with. A
 * props object or a setup binding the source names after one is declared under another name.
 * (A prop cannot take either name, and a setup binding cannot be named `Fragment`.)
 */
const ASTRO_NAMES: ReadonlySet<string> = new Set(["Astro", "Fragment"]);

/** The names the output declares, and how its code spells each reference. */
export interface Spelling {
  /** The rules every printed expression and piece of setup code is rewritten by. */
  rules: RewriteRules;
  /** The name the output declares a binding under: its own, unless Astro takes it. */
  name(id: BindingId): string;
  /** The name of the props object in the object form, when the source names it after one Astro takes. */
  propsObject?: string;
  /** The names taken, for the target's own: helpers, a block getter's function. */
  scope: NameScope;
  /**
   * The name each scoped slot's render prop is read under (ADR-0054): the slot's own, or
   * `<slot>Slot` where the slot's name is no prop name a frontmatter can bind (`default`, a
   * reserved word, `class`, `style`).
   */
  renderProps: ReadonlyMap<string, string>;
}

/**
 * The prop a scoped slot's render prop is passed as: the slot's name, or `classSlot` and
 * `styleSlot`, since `class` and `style` are the props a component's root takes from its
 * consumer (fallthrough, ADR-0054). `taken` holds the component's props and models, which the
 * analyser keeps apart from its slots' names but not from these (`styleSlot2` then). The
 * component and its consumers compute the same name from its API.
 */
export function renderPropName(slot: string, taken: ReadonlySet<string>): string {
  if (slot !== "class" && slot !== "style") return slot;
  let name = `${slot}Slot`;
  for (let index = 2; taken.has(name); index++) name = `${slot}Slot${index}`;
  return name;
}

/**
 * The spelling of a component's output. The object form keeps its object's name unless Astro
 * takes it (`Astro`, `Fragment`), and then reads `props.x`: a prop reference spans the whole
 * `name.member`, so only its object changes. A `state`, `derived` or `templateRef` reference
 * spans `count.value` and becomes the binding's name. Every other binding keeps its name as
 * written, a setup binding named `Astro` excepted.
 */
export function spellingOf(component: UfComponent, module: UfModule): Spelling {
  const scope = new NameScope([...sourceNames(component, module), ...ASTRO_NAMES]);
  const parameter = component.propsParameter;
  const propsObject =
    parameter?.form === "object" && ASTRO_NAMES.has(parameter.name!)
      ? scope.claim("props")
      : undefined;
  const names = new Map<BindingId, string>();
  for (const binding of component.bindings) {
    const taken = ASTRO_NAMES.has(binding.name) && declaredBySetup(binding);
    names.set(binding.id, taken ? scope.claim(binding.name) : binding.name);
  }
  const name = (id: BindingId) => names.get(id)!;
  const renderProps = new Map<string, string>();
  for (const slot of component.slots?.slots ?? []) {
    if (slot.props) {
      const name = RESERVED_PROP_NAMES.has(slot.name) ? `${slot.name}Slot` : slot.name;
      renderProps.set(slot.name, scope.claim(name));
    }
  }
  return {
    rules: {
      // A named slot's presence is Astro's own; a scoped slot is a render prop, present when
      // passed.
      slot: ({ slot }) => renderProps.get(slot) ?? `Astro.slots.has(${JSON.stringify(slot)})`,
      binding: (_, binding, written) => {
        switch (binding.kind) {
          case "prop":
            return propsObject === undefined
              ? written
              : `${propsObject}${written.slice(parameter!.name!.length)}`;
          case "loopVar":
          case "slotScope":
          case "component":
            return written;
          case "state":
          case "derived":
          case "templateRef":
          case "localConst":
          case "localFn":
          case "localVar":
          case "emit":
          case "model":
          case "slots":
          case "context":
          // `emit` reports UF1002 for these first (ADR-0069, ADR-0070).
          case "moduleConst":
          case "import":
          case "argument":
          case "usedState":
          case "usedDerived":
          case "usedFn":
          case "usedConst":
            return name(binding.id);
          default:
            return unreachable(binding.kind);
        }
      },
    },
    name,
    ...(propsObject === undefined ? {} : { propsObject }),
    scope,
    renderProps,
  };
}

/** Whether a binding is one the frontmatter declares at its top level, beside Astro's own. */
function declaredBySetup(binding: Binding): boolean {
  switch (binding.kind) {
    case "prop":
    case "loopVar":
    case "slotScope":
    case "component":
      return false;
    case "state":
    case "derived":
    case "templateRef":
    case "localConst":
    case "localFn":
    case "localVar":
    case "emit":
    case "model":
    case "slots":
    case "context":
    // `emit` reports UF1002 for these first (ADR-0069, ADR-0070).
    case "moduleConst":
    case "import":
    case "argument":
    case "usedState":
    case "usedDerived":
    case "usedFn":
    case "usedConst":
      return true;
    default:
      return unreachable(binding.kind);
  }
}

/** The `never` default of an exhaustive switch: a kind added to the IR fails type checking. */
export function unreachable(value: never): never {
  throw new Error(`Unexpected IR value: ${JSON.stringify(value)}`);
}
