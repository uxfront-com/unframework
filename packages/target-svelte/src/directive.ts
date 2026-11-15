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
  hookCall,
} from "@unframework.dev/codegen";
import type { EmitContext, OutputFile } from "@unframework.dev/codegen";
import type { UfDirective } from "@unframework.dev/ir";

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
  const mounted = directiveHook(directive, "mounted");
  const updated = directiveHook(directive, "updated");
  const unmounted = directiveHook(directive, "unmounted");
  const body: string[] = [];
  if (updated) body.push(`let current = ${untrack}(getValue);`);
  if (mounted) {
    body.push(
      `${untrack}(() => ${hookCall("hooks", mounted, ["element", updated ? "current" : `${untrack}(getValue)`])});`,
    );
  }
  if (updated) {
    // The previous value only where the hook takes it.
    const previous = updated.parameters.length > 2;
    body.push(
      "$effect(() => {",
      "  const next = getValue();",
      "  if (Object.is(next, current)) return;",
      ...(previous ? ["  const previous = current;"] : []),
      "  current = next;",
      `  ${untrack}(() => ${hookCall("hooks", updated, ["element", "next", "previous"])});`,
      "});",
    );
  }
  if (unmounted) body.push(`return () => ${hookCall("hooks", unmounted, ["element"])};`);
  const element = directiveElement(directive);
  const hooks = directiveHooksObject(directive).replaceAll("\n", "\n  ");
  return [
    `${exported ? "export " : ""}function ${directive.name}(getValue: () => ${directive.value.code}): ${attachment}<${element}> {`,
    `  const hooks = ${hooks};`,
    `  return (element) => {`,
    ...body.map((line) => `    ${line}`),
    "  };",
    "}",
  ].join("\n");
}

/** `vFocusTrap.svelte.ts`: a `.uf.ts` module's directive, as an attachment factory. */
export function emitDirective(directive: UfDirective, context: EmitContext): OutputFile[] {
  const dependencies = directiveDependencies(directive, context.module);
  const code = [
    [
      'import { untrack } from "svelte";',
      'import type { Attachment } from "svelte/attachments";',
      ...dependencyImports(dependencies),
    ].join("\n"),
    ...dependencies.types,
    ...(dependencies.constants.length ? [dependencies.constants.join("\n")] : []),
    attachmentCode(directive, { untrack: "untrack", attachment: "Attachment" }, true),
  ].join("\n\n");
  return [{ path: `${directive.name}.svelte.ts`, contents: `${code}\n` }];
}
