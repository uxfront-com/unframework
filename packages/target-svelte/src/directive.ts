// A directive as a Svelte attachment factory (ADR-0099): `{@attach vFocusTrap(() => open)}`. The
// factory reads the value through its getter, `getValue`, only inside the attachment, which Svelte runs once
// the element is mounted and tears down once it leaves, so the attachment is never rebuilt. It
// runs `mounted` untracked, `updated` from an effect of its own that reads the value, behind
// `Object.is`, and `unmounted` from its teardown. Attachments never run on the server. Not an
// action: an action's `update` treats an object as always changed.
import {
  dependencyImports,
  directiveDependencies,
  directiveElement,
  directiveHook,
  directiveHooksObject,
  directiveModuleNames,
  hookCall,
  hookParameters,
  NameScope,
  wrapperNames,
} from "@unframework.dev/codegen";
import type { Container, EmitContext, OutputFile } from "@unframework.dev/codegen";
import { childrenOf } from "@unframework.dev/ir";
import type {
  DirectiveAttribute,
  ElementNode,
  FragmentNode,
  IfBranch,
  RenderNode,
  UfDirective,
} from "@unframework.dev/ir";

/** The local names an attachment factory reads: Svelte's `untrack` and its `Attachment` type. */
export interface AttachmentNames {
  untrack: string;
  attachment: string;
}

/** `function vFocusTrap(value: () => boolean): Attachment<HTMLElement> { … }`. */
export function attachmentCode(
  directive: UfDirective,
  names: AttachmentNames,
  exported = false,
): string {
  const { untrack, attachment } = names;
  // Its own names, apart from every name a hook reads.
  const own = wrapperNames(directive, [
    "hooks",
    "getValue",
    "element",
    "current",
    "next",
    "previous",
  ] as const);
  const mounted = directiveHook(directive, "mounted");
  const updated = directiveHook(directive, "updated");
  const unmounted = directiveHook(directive, "unmounted");
  const body: string[] = [];
  if (updated) body.push(`let ${own.current} = ${untrack}(${own.getValue});`);
  if (mounted) {
    const value = updated ? own.current : `${untrack}(${own.getValue})`;
    body.push(`${untrack}(() => ${hookCall(own.hooks, mounted, [own.element, value])});`);
  }
  if (updated) {
    // The previous value only where the hook takes it.
    const previous = hookParameters(updated).length > 2;
    body.push(
      "$effect(() => {",
      `  const ${own.next} = ${own.getValue}();`,
      `  if (Object.is(${own.next}, ${own.current})) return;`,
      ...(previous ? [`  const ${own.previous} = ${own.current};`] : []),
      `  ${own.current} = ${own.next};`,
      `  ${untrack}(() => ${hookCall(own.hooks, updated, [own.element, own.next, own.previous])});`,
      "});",
    );
  }
  if (unmounted) body.push(`return () => ${hookCall(own.hooks, unmounted, [own.element])};`);
  const element = directiveElement(directive);
  const hooks = directiveHooksObject(directive).replaceAll("\n", "\n  ");
  return [
    // A directive with only `unmounted` reads no value: its getter is unused.
    `${exported ? "export " : ""}function ${directive.name}(${mounted || updated ? own.getValue : `_${own.getValue}`}: () => ${directive.value.code}): ${attachment}<${element}> {`,
    `  const ${own.hooks} = ${hooks};`,
    `  return (${own.element}) => {`,
    ...body.map((line) => `    ${line}`),
    "  };",
    "}",
  ].join("\n");
}

/** `vFocusTrap.svelte.ts`: a `.uf.ts` module's directive, as an attachment factory. */
export function emitDirective(directive: UfDirective, context: EmitContext): OutputFile[] {
  const dependencies = directiveDependencies(directive, context.module);
  // Svelte's names, apart from everything the copied code declares or reads.
  const scope = new NameScope(directiveModuleNames(directive, dependencies));
  const untrack = scope.claim("untrack");
  const attachment = scope.claim("Attachment");
  const named = (imported: string, local: string) =>
    imported === local ? local : `${imported} as ${local}`;
  // `untrack` reads the value for `mounted` and `updated`, which a directive may leave out.
  const reads = directiveHook(directive, "mounted") || directiveHook(directive, "updated");
  const code = [
    [
      ...(reads ? [`import { ${named("untrack", untrack)} } from "svelte";`] : []),
      `import type { ${named("Attachment", attachment)} } from "svelte/attachments";`,
      ...dependencyImports(dependencies),
    ].join("\n"),
    ...dependencies.types,
    ...(dependencies.constants.length ? [dependencies.constants.join("\n")] : []),
    attachmentCode(directive, { untrack, attachment }, true),
  ].join("\n\n");
  return [{ path: `${directive.name}.svelte.ts`, contents: `${code}\n` }];
}

/**
 * The directives in a branch whose value reads a binding, by the innermost branch, each with the
 * name of the constant the branch declares from it, `{@const markValue = user.name}`. The
 * attachment's getter reads the constant, whose type is what the branch narrows: TypeScript keeps
 * no narrowing of a reassigned `$state` in a closure, nor one a `!` can't write (`typeof`), and
 * the analyser records only the narrowings a read needs (ADR-0099).
 */
export function narrowedDirectiveValues(
  render: ElementNode | FragmentNode,
  claim: (base: string) => string,
): Map<Container, { attribute: DirectiveAttribute; name: string }[]> {
  const found = new Map<Container, { attribute: DirectiveAttribute; name: string }[]>();
  const visit = (node: RenderNode | FragmentNode, branch: IfBranch | undefined): void => {
    if (node.kind === "If") {
      for (const each of node.branches) {
        for (const child of each.children) visit(child, each);
      }
      return;
    }
    if (node.kind === "Element" && branch) {
      for (const attribute of node.attributes) {
        if (attribute.kind !== "Directive" || !attribute.value.refs.length) continue;
        const name = claim(`${attribute.name[1]!.toLowerCase()}${attribute.name.slice(2)}Value`);
        found.set(branch, [...(found.get(branch) ?? []), { attribute, name }]);
      }
    }
    for (const child of childrenOf(node)) visit(child, branch);
  };
  visit(render, undefined);
  return found;
}
