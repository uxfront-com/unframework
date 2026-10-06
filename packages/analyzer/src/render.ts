import type { Binding, BindingId } from "@unframework/ir";
import type { AST } from "@unframework/parser";

import type { Reporter } from "./context.ts";
import type { Scopes } from "./scope.ts";
import type { TypeTable } from "./types/from-type.ts";
import type { Kinds } from "./types/kinds.ts";

/**
 * A component's function: a declaration, or the arrow function or function expression a `const`
 * holds, which is reported (UF1102) and still analysed, so that its fix reveals nothing new.
 */
export type ComponentFunction = AST.Function | AST.ArrowFunctionExpression;

/** A prop as expressions read it. */
export interface PropBinding {
  name: string;
  /** The binding expressions read it through: absent when the destructured form leaves it out. */
  id: BindingId | undefined;
  /** Its kinds: the member's type, with `undefined` when optional without a default. */
  kinds: Kinds;
}

/** A list's item or index. */
export interface LoopVariable {
  name: string;
  id: BindingId;
  kinds: Kinds;
  /** The parameter that declares it. */
  declaration: object;
}

/** What lowering a component's returned JSX needs to know about the component and module. */
export interface RenderContext {
  readonly source: string;
  readonly reporter: Reporter;
  readonly scopes: Scopes;
  readonly types: TypeTable;
  /** The component's function: its parameters are the props. */
  readonly component: ComponentFunction;
  /** The props, by name: every member of the props type. */
  readonly props: ReadonlyMap<string, PropBinding>;
  /** The destructured props, by the identifier that declares each. */
  readonly propsByDeclaration: ReadonlyMap<object, PropBinding>;
  /** The object form's parameter: what declares it, and its name. */
  readonly propsObject: { declaration: object; name: string } | undefined;
  /** The loop variables of the lists lowered so far, by the parameter that declares each. */
  readonly loopVariables: Map<object, LoopVariable>;
  /** The loop variables of the lists around the node being lowered, outermost first. */
  readonly enclosing: LoopVariable[];
  /** The bindings the component declares: the props', then each list's as it is lowered. */
  readonly bindings: Binding[];
  /** The module's comments: lint directives must not reach an output. */
  readonly comments: readonly AST.Comment[];
}
