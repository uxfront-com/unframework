import {
  type ComponentPropsWithRef,
  type Ref,
  type RefCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
} from "react";

export type IconLinkAttributes = Omit<ComponentPropsWithRef<"a">, "href" | "label" | "children">;

export default function IconLink({
  href,
  label,
  className,
  style,
  ref,
  ...attributes
}: { href: string; label?: string } & IconLinkAttributes) {
  const link = useRef<HTMLAnchorElement>(null);

  const onMount = useEffectEvent(() => {
    if (process.env.NODE_ENV !== "production") {
      const name = link.current?.getAttribute("aria-label") ?? link.current?.textContent?.trim();
      if (!name) console.warn("IconLink has no accessible name: give it a `label` or some text.");
    }
  });
  useEffect(() => {
    onMount();
  }, []);

  const rootRef = useMemo(() => mergeRefs(link, ref), [link, ref]);

  return (
    <a
      ref={rootRef}
      href={href}
      aria-label={label}
      className={className}
      style={style}
      {...attributes}
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M2 8h10M8 4l4 4-4 4" />
      </svg>
    </a>
  );
}

/** Joins an element's refs into one ref callback, whose cleanup clears each. */
function mergeRefs<E extends Element>(...refs: (Ref<E> | undefined)[]): RefCallback<E> {
  return (element) => {
    const cleanups = refs.map((ref) => {
      if (typeof ref === "function") {
        const cleanup = ref(element);
        return typeof cleanup === "function" ? cleanup : () => ref(null);
      }
      if (ref) ref.current = element;
      return () => {
        if (ref) ref.current = null;
      };
    });
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  };
}
