// A component's `<script setup lang="ts">` block (design §5.2, ADR-0034): the type declarations its
// props reach, copied as written, and one `defineProps` declaration. The template reads the props
// through it under the source's own names: a destructured prop is a binding of the script, and the
// object form's `props.label` reads the object `defineProps` returns.
import {
  componentTypes,
  NameScope,
  referencedBindings,
  sourceNames,
  typeDeclarationCode,
} from "@unframework/codegen";
import type { RewriteRules } from "@unframework/codegen";
import type { BindingId, Prop, PropsParameter, UfComponent, UfModule } from "@unframework/ir";

/** What a component's script gives its template. */
export interface ScriptSetup {
  /** The `<script setup lang="ts">` block: absent for a component that takes no props. */
  block?: string;
  /**
   * How the template spells references, when the script declares a prop under another local
   * name: the expressions are printed as written otherwise.
   */
  rewrite?: RewriteRules;
}

/**
 * The names a component's script cannot declare as they are:
 * - Vue's compiler macros: vue-tsc declares each one in the script's scope, so a local of the
 *   same name is TS2451 (and `const { defineProps } = defineProps<P>()` reads itself);
 * - the globals Vue's template compiler never prefixes (compiler-core's `canPrefix`: shared's
 *   `GLOBALS_ALLOWED` and `require`): in any expression but a lone identifier, `Map + label`
 *   reads the global `Map`, whatever the script declares. The prop names the analyser accepts
 *   leave out the globals expressions may read (ADR-0034), but not these.
 */
const VUE_RESERVED: ReadonlySet<string> = new Set([
  "defineProps",
  "withDefaults",
  "defineEmits",
  "defineExpose",
  "defineOptions",
  "defineSlots",
  "defineModel",
  ..."Infinity,undefined,NaN,isFinite,isNaN,parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,Math,Number,Date,Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,BigInt,console,Error,Symbol".split(
    ",",
  ),
  "require",
]);

/**
 * The script of a component that takes props. The declaration is `defineProps<P>()` with the
 * source's annotation, a reference to a copied declaration or an object type literal, so the
 * component's props type is the source's (M5's consumers type-check against it).
 *
 * Destructured (Vue 3.5's reactive props destructure), every optional prop gets a default: the
 * source's, or `undefined`. Vue casts an absent `Boolean` prop without a default to `false`,
 * where every other target leaves it `undefined` (ADR-0034); and once props are destructured,
 * `vue/require-default-prop` asks for a default for each optional one, read or not, so those
 * stay in the pattern even when nothing reads them (a destructured prop compiles to a read of
 * the props object, not a variable, and no linter takes it for an unused one). A required prop
 * is in the pattern when an expression reads it. A component that reads no prop declares them
 * with the macro alone: its defaults would change nothing, and the rule asks for none there.
 *
 * The object form is `const props = defineProps<P>()`, through `withDefaults` with an
 * `undefined` default for each optional prop, for the same two reasons.
 */
export function scriptSetup(component: UfComponent, module: UfModule): ScriptSetup {
  const parameter = component.propsParameter;
  if (!parameter) return {};
  const scope = new NameScope(sourceNames(component, module));
  scope.reserve(...VUE_RESERVED);
  const read = referencedBindings(component);
  const declaration =
    parameter.form === "object"
      ? objectDeclaration(component, parameter, scope, read)
      : destructuredDeclaration(component, parameter, scope, read);
  const code = [...componentTypes(component, module).map(typeDeclarationCode), declaration.code];
  return {
    block: `<script setup lang="ts">\n${escapeScriptEnd(code.join("\n\n"))}\n</script>`,
    ...(declaration.rewrite ? { rewrite: declaration.rewrite } : {}),
  };
}

interface Declaration {
  code: string;
  rewrite?: RewriteRules;
}

/** `const { label, tone = "info", count = undefined } = defineProps<P>();` */
function destructuredDeclaration(
  component: UfComponent,
  parameter: PropsParameter,
  scope: NameScope,
  read: ReadonlySet<BindingId>,
): Declaration {
  const macro = `defineProps<${parameter.type.code}>()`;
  const isRead = (prop: Prop) => prop.binding !== undefined && read.has(prop.binding);
  if (!component.props.some(isRead)) return { code: `${macro};` };
  const renamed = new Map<BindingId, string>();
  const entries = component.props
    .filter((prop) => isRead(prop) || prop.optional)
    .map((prop) => {
      // Vue 3.5 destructures a prop under another name too (`{ Map: Map_1 }`), and the
      // template reads the local.
      const local = VUE_RESERVED.has(prop.name) ? scope.claim(prop.name) : prop.name;
      if (local !== prop.name && prop.binding !== undefined) renamed.set(prop.binding, local);
      const target = local === prop.name ? prop.name : `${prop.name}: ${local}`;
      const value = prop.default?.code ?? (prop.optional ? "undefined" : undefined);
      return value === undefined ? target : `${target} = ${value}`;
    });
  return {
    code: `const { ${entries.join(", ")} } = ${macro};`,
    ...(renamed.size > 0
      ? {
          rewrite: {
            binding: (reference, binding, written) => renamed.get(binding.id) ?? written,
          },
        }
      : {}),
  };
}

/** `const props = withDefaults(defineProps<P>(), { title: undefined });` */
function objectDeclaration(
  component: UfComponent,
  parameter: PropsParameter,
  scope: NameScope,
  read: ReadonlySet<BindingId>,
): Declaration {
  const macro = `defineProps<${parameter.type.code}>()`;
  // In the object form, every prop is a binding, read as `props.label`.
  if (!component.props.some((prop) => prop.binding !== undefined && read.has(prop.binding))) {
    return { code: `${macro};` };
  }
  const optional = component.props.filter((prop) => prop.optional);
  const call = optional.length
    ? `withDefaults(${macro}, { ${optional.map((prop) => `${prop.name}: undefined`).join(", ")} })`
    : macro;
  const name = parameter.name!;
  const local = VUE_RESERVED.has(name) ? scope.claim(name) : name;
  return {
    code: `const ${local} = ${call};`,
    ...(local === name
      ? {}
      : {
          // A reference spans the whole `props.label`: only the object's name changes.
          rewrite: {
            binding: (reference, binding, written) =>
              binding.kind === "prop" ? `${local}${written.slice(name.length)}` : written,
          },
        }),
  };
}

/**
 * Code copied into the script, with `</script` written `<\/script`: Vue's parser ends the block
 * at the first `</script`, wherever it sits (design §4.4). It can only sit in a string or
 * template literal, or a comment, where `\/` is `/`. The analyser rejects both copied forms
 * that could hold it (defaults and type declarations), so this never changes a valid output.
 */
function escapeScriptEnd(code: string): string {
  return code.replace(/<\/(script)/gi, "<\\/$1");
}
