// How the Vue output spells the component's bindings (ADR-0035, ADR-0045): the script is the
// source's own code, so it reads a ref through `.value` as written; the template reads a setup ref
// without it, because Vue unwraps a `<script setup>` binding's ref in templates. A binding whose
// name Vue reserves is declared, and read everywhere, under a local name of its own.
import { NameScope, sourceNames } from "@unframework/codegen";
import type { RewriteRules, RewriteSite } from "@unframework/codegen";
import { codeOf } from "@unframework/ir";
import type { Binding, BindingId, BindingKind, UfComponent, UfModule } from "@unframework/ir";

/**
 * The globals Vue's template compiler never prefixes (compiler-core's `canPrefix`: shared's
 * `GLOBALS_ALLOWED` and `require`): a template expression reads them, and nothing else that is
 * not a binding of the component.
 */
export const VUE_TEMPLATE_GLOBALS: ReadonlySet<string> = new Set([
  ..."Infinity,undefined,NaN,isFinite,isNaN,parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,Math,Number,Date,Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,BigInt,console,Error,Symbol".split(
    ",",
  ),
  "require",
]);

/**
 * The names a component's script cannot declare as they are:
 * - Vue's compiler macros: vue-tsc declares each one in the script's scope, so a local of the
 *   same name is TS2451 (and `const { defineProps } = defineProps<P>()` reads itself);
 * - the globals Vue's template compiler never prefixes ({@link VUE_TEMPLATE_GLOBALS}): in any
 *   expression but a lone identifier, `Map + label` reads the global `Map`, whatever the script
 *   declares. The prop and setup names the analyser accepts leave out the globals expressions
 *   may read (ADR-0034), but not these.
 */
export const VUE_RESERVED: ReadonlySet<string> = new Set([
  "defineProps",
  "withDefaults",
  "defineEmits",
  "defineExpose",
  "defineOptions",
  "defineSlots",
  "defineModel",
  ...VUE_TEMPLATE_GLOBALS,
]);

/** A component's names in its Vue output: the scope the script claims from, and the renames. */
export class VueNames {
  /** The output's names: the source's, Vue's reserved ones, and every name the target claims. */
  readonly scope: NameScope;
  /** The local name of each binding declared under another name than the source's. */
  readonly #locals = new Map<BindingId, string>();
  /** The object form's props object, when the script names it otherwise than the source. */
  #propsObject: { written: string; local: string } | undefined;

  constructor(component: UfComponent, module: UfModule) {
    const reserved = sourceNames(component, module);
    // The source reads `nextTick` as the authoring API, which `vue`'s takes the place of: where
    // every use is written `nextTick`, the import keeps the name. No local of that name can be
    // in scope there, or the source's `nextTick` would read it.
    const apis = codeOf(component).flatMap(({ code }) =>
      code.refs.flatMap((reference) =>
        reference.kind === "Api"
          ? [
              code.code.slice(
                reference.span.start - code.span.start,
                reference.span.end - code.span.start,
              ),
            ]
          : [],
      ),
    );
    if (apis.length > 0 && apis.every((name) => name === "nextTick")) reserved.delete("nextTick");
    this.scope = new NameScope(reserved);
    this.scope.reserve(...VUE_RESERVED);
    // A setup binding Vue reserves is declared under a name of its own, before anything else
    // claims one: every reference reads it there.
    for (const binding of component.bindings) {
      if (declaredBySetup(binding.kind) && VUE_RESERVED.has(binding.name)) {
        this.#locals.set(binding.id, this.scope.claim(binding.name));
      }
    }
  }

  /** Declares a binding under another local name (a destructured prop Vue reserves). */
  rename(binding: BindingId, local: string): void {
    this.#locals.set(binding, local);
  }

  /** The object form's props object goes by `local` where the source writes `written`. */
  renamePropsObject(written: string, local: string): void {
    this.#propsObject = { written, local };
  }

  /** The name the output declares a binding by. */
  local(binding: Binding): string {
    return this.#locals.get(binding.id) ?? binding.name;
  }

  /**
   * A reference as the script writes it: as the source does (`count.value`, `props.label`),
   * with a renamed binding's local name.
   */
  script(binding: Binding, written: string): string {
    const object = this.#propsObject;
    switch (binding.kind) {
      case "prop":
        // The object form's reference spans the whole `props.label`: only the object's name
        // changes. A destructured prop is renamed as any other binding.
        if (object && written.startsWith(`${object.written}.`)) {
          return `${object.local}${written.slice(object.written.length)}`;
        }
        break;
      case "loopVar":
      case "state":
      case "derived":
      case "templateRef":
      case "localConst":
      case "localFn":
      case "localVar":
      case "emit":
      case "model":
      case "slots":
      case "slotScope":
      case "context":
      case "component":
        break;
      default:
        return unreachable(binding.kind);
    }
    const local = this.#locals.get(binding.id);
    return local === undefined ? written : `${local}${written.slice(binding.name.length)}`;
  }

  /**
   * A reference as the template writes it: a setup ref's value (`state`, `derived`,
   * `templateRef`, `model`, an injected ref) is the ref itself, which Vue unwraps; everything
   * else as the script does.
   */
  template(binding: Binding, written: string): string {
    switch (binding.kind) {
      case "state":
      case "derived":
      case "templateRef":
      case "model":
        return this.local(binding);
      // An injected ref is read as `x.value`, the reference's whole text (ADR-0054), and the
      // template unwraps it as it unwraps the setup's own refs.
      case "context":
        return written === `${binding.name}.value`
          ? this.local(binding)
          : this.script(binding, written);
      case "prop":
      case "loopVar":
      case "localConst":
      case "localFn":
      case "localVar":
      case "emit":
      case "slots":
      case "slotScope":
      case "component":
        return this.script(binding, written);
      default:
        return unreachable(binding.kind);
    }
  }

  /**
   * The rules that spell the script's code: as written, renamed bindings and APIs aside.
   * `nextTick` gives the local name `vue`'s `nextTick` is imported under.
   */
  scriptRules(nextTick: () => string): RewriteRules {
    return {
      binding: (_reference, binding, written) => this.script(binding, written),
      api: (reference) => {
        switch (reference.api) {
          case "nextTick":
            return nextTick();
          default:
            return unreachable(reference.api);
        }
      },
    };
  }

  /** The rules that spell the template's code, its listeners' included. */
  templateRules(): RewriteRules {
    return {
      binding: (_reference, binding, written, _site: RewriteSite) =>
        this.template(binding, written),
    };
  }
}

/**
 * Whether the setup declares a binding of this kind (the script declares it as the source
 * does), as opposed to the props pattern or a template's list.
 */
function declaredBySetup(kind: BindingKind): boolean {
  switch (kind) {
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
      return true;
    default:
      return unreachable(kind);
  }
}

/** The `never` default of an exhaustive switch: a kind added to a union fails type checking. */
export function unreachable(value: never): never {
  throw new Error(`Unexpected IR value: ${JSON.stringify(value)}`);
}
