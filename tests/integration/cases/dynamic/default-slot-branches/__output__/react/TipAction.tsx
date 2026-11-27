import { mergeRefs } from "./_unframework/mergeRefs";
import { subscribeNothing } from "./_unframework/subscribeNothing";
import { teleport } from "./_unframework/teleport";
import {
  type ComponentPropsWithoutRef,
  type DOMAttributes,
  type ReactNode,
  type Ref,
  useMemo,
  useSyncExternalStore,
} from "react";

export interface TipActionSlots {
  children?: ReactNode;
}

export type TipActionAttributes = Omit<
  ComponentPropsWithoutRef<"a"> & ComponentPropsWithoutRef<"button">,
  "href" | "label" | "children" | keyof DOMAttributes<HTMLAnchorElement | HTMLButtonElement>
> &
  Omit<
    DOMAttributes<HTMLAnchorElement | HTMLButtonElement>,
    "children" | "dangerouslySetInnerHTML"
  > & { ref?: Ref<HTMLAnchorElement | HTMLButtonElement> };

export default function TipAction({
  href,
  label,
  children,
  className,
  style,
  ref,
  ...attributes
}: { href?: string; label: string } & TipActionSlots & TipActionAttributes) {
  const mounted = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );

  const rootRef = useMemo(() => mergeRefs(ref), [ref]);

  const Tag = href ? "a" : "button";

  return (
    <Tag
      href={Tag === "a" ? href : undefined}
      className={className}
      style={style}
      ref={rootRef}
      {...attributes}
    >
      {label}
      {mounted
        ? teleport(
            <p data-teleported="true" className="tip" role="note">
              {children ?? label}
            </p>,
            "body",
          )
        : null}
    </Tag>
  );
}
