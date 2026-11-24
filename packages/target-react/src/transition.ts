// `<Transition name appear>` on React (ADR-0100): React has no transition primitive, so a
// component, `Transition`, runs Vue's classes. Each branch of the child's conditional takes a key
// of its own, so a change of branch is a change of key: the helper keeps the old element, frozen at
// its last render, beside the new one until its leave ends. It owns the classes in state, since
// React writes the whole `class` attribute whenever `className` changes, and sets state only in
// frame and event callbacks, or while it renders when its child changes. The server and the
// hydrating client see no class: `useSyncExternalStore` tells a client mount from them.
import { js, jsxAttributeValue, jsxNode } from "@unframework.dev/codegen";
import type { ImportSet, JsxDialect } from "@unframework.dev/codegen";

import { keyedBranches } from "./branches.ts";
import type { ReactPlan, TransitionNames } from "./plan.ts";

/** The dialect's `transition` hook: `<Transition name="fade">{open ? <p key={0} /> : null}</Transition>`. */
export function transitionCall(plan: ReactPlan): JsxDialect["transition"] {
  const names = plan.helpers.transition;
  if (!names) return undefined;
  return (node, context) => {
    const [child] = node.children;
    const content =
      child?.kind === "If" ? keyedBranches(child, context, plan.names) : jsxNode(child!, context);
    return js.jsxElement(
      names.component,
      [
        js.jsxAttribute("name", jsxAttributeValue(node.name)),
        ...(node.appear ? [js.jsxAttribute("appear")] : []),
      ],
      [content.type === "JSXElement" ? content : js.jsxExpressionContainer(content)],
    );
  };
}

/**
 * The inline helpers a transition needs, after the component: its store subscription only where
 * no teleport's helpers declare it already.
 */
export function transitionHelpers(
  names: TransitionNames,
  imports: ImportSet,
  subscribes: boolean,
): string[] {
  const react = (name: string) => imports.add("react", name);
  const type = (name: string) => imports.add("react", name, { type: true });
  const { component, item, entry, subscribe, attach } = names;
  const element = `${type("ReactElement")}<{ className?: string; ref?: ${type("Ref")}<Element> }>`;
  return [
    `/** One element a \`${component}\` renders: its key, its last render and the phase it is in. */
interface ${entry} {
  key: string;
  node: ${element};
  phase?: "enter" | "leave";
  step: "from" | "to";
  time: number;
}`,
    ...(subscribes
      ? [
          `/** Subscribes to nothing: whether the component renders on a client never changes once it does. */
function ${subscribe}(): () => void {
  return () => {};
}`,
        ]
      : []),
    `/**
 * Runs Vue's transition classes of \`name\` on the element \`children\` renders, keyed by its
 * branch, as it enters and leaves: \`-from\` and \`-active\` first, \`-to\` for \`-from\` two frames
 * later, and none once the element's own \`transitionend\` or \`animationend\` fires, or its longest
 * duration and delay pass. A leaving element stays, as it last rendered, until its leave ends.
 */
function ${component}({
  name,
  appear = false,
  children,
}: {
  name: string;
  appear?: boolean;
  children: ${element} | null;
}): ${type("ReactNode")} {
  // False on the server and while the client hydrates: only a client mount runs \`appear\`.
  const client = ${react("useSyncExternalStore")}(${subscribe}, () => true, () => false);
  const [shown, setShown] = ${react("useState")}(children);
  const [entries, setEntries] = ${react("useState")}<${entry}[]>(() =>
    children
      ? [{ key: String(children.key), node: children, ...(appear && client ? { phase: "enter" as const } : {}), step: "from", time: 0 }]
      : [],
  );
  const elements = ${react("useRef")}(new Map<string, Element>());
  const [register] = ${react("useState")}(() => (key: string, element: Element | null) => {
    if (element) elements.current.set(key, element);
    else elements.current.delete(key);
  });
  if (children !== shown) {
    setShown(children);
    const before = shown === null ? undefined : String(shown.key);
    const after = children === null ? undefined : String(children.key);
    if (before !== after) {
      // The shown element leaves as it last rendered, and the new one enters.
      const next = entries.flatMap((each): ${entry}[] => {
        if (each.key === after) return [];
        return each.key === before && each.phase !== "leave" && shown
          ? [{ key: each.key, node: shown, phase: "leave", step: "from", time: 0 }]
          : [each];
      });
      if (children && after !== undefined) next.push({ key: after, node: children, phase: "enter", step: "from", time: 0 });
      setEntries(next);
    }
  }
  ${react("useLayoutEffect")}(() => {
    const stops: (() => void)[] = [];
    const settle = (entry: ${entry}) =>
      setEntries((list) =>
        entry.phase === "leave"
          ? list.filter((each) => each !== entry)
          : list.map((each) => (each === entry ? { key: each.key, node: each.node, step: "from", time: 0 } : each)),
      );
    for (const entry of entries) {
      const element = elements.current.get(entry.key);
      if (!entry.phase || !element) continue;
      if (entry.step === "from") {
        let frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => {
            const style = getComputedStyle(element);
            const longest = (delays: string, durations: string) => {
              const each = (list: string) => list.split(", ").map((time) => Number(time.slice(0, -1)) * 1000);
              const delay = each(delays);
              return Math.max(0, ...each(durations).map((duration, index) => duration + (delay[index % delay.length] ?? 0)));
            };
            const time = Math.max(
              longest(style.transitionDelay, style.transitionDuration),
              longest(style.animationDelay, style.animationDuration),
            );
            if (!time) settle(entry);
            else setEntries((list) => list.map((each) => (each === entry ? { ...each, step: "to", time } : each)));
          });
        });
        stops.push(() => cancelAnimationFrame(frame));
        continue;
      }
      const end = (event?: Event) => {
        if (event && event.target !== element) return;
        settle(entry);
      };
      element.addEventListener("transitionend", end);
      element.addEventListener("animationend", end);
      const timer = setTimeout(end, entry.time + 1);
      stops.push(() => {
        clearTimeout(timer);
        element.removeEventListener("transitionend", end);
        element.removeEventListener("animationend", end);
      });
    }
    return () => {
      for (const stop of stops) stop();
    };
  }, [entries]);
  return entries.map((entry) => {
    const node = entry.phase === "leave" || !children ? entry.node : children;
    const classes = entry.phase
      ? [\`\${name}-\${entry.phase}-\${entry.step}\`, \`\${name}-\${entry.phase}-active\`]
      : [];
    return (
      <${item}
        key={entry.key}
        id={entry.key}
        node={node}
        className={[node.props.className, ...classes].filter(Boolean).join(" ") || undefined}
        register={register}
      />
    );
  });
}`,
    `/** Renders one element of a \`${component}\` with its classes, its own ref kept beside the transition's. */
function ${item}({
  id,
  node,
  className,
  register,
}: {
  id: string;
  node: ${element};
  className: string | undefined;
  register: (key: string, element: Element | null) => void;
}): ${type("ReactNode")} {
  const own = node.props.ref;
  const ref = ${react("useCallback")}(
    (element: Element) => {
      register(id, element);
      const detach = ${attach}(own, element);
      return () => {
        register(id, null);
        detach();
      };
    },
    [id, own, register],
  );
  return ${react("cloneElement")}(node, { className, ref });
}`,
    `/** Gives a ref the element, as React would, and returns what takes it back. */
function ${attach}(ref: ${type("Ref")}<Element> | undefined, element: Element): () => void {
  if (typeof ref === "function") {
    const cleanup = ref(element);
    return typeof cleanup === "function" ? cleanup : () => ref(null);
  }
  if (ref) ref.current = element;
  return () => {
    if (ref) ref.current = null;
  };
}`,
  ];
}
