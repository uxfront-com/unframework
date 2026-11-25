import { mergeRefs } from "./_unframework/mergeRefs";
import {
  type ComponentPropsWithRef,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";

export type NameFieldAttributes = Omit<ComponentPropsWithRef<"input">, "label" | "children">;

export default function NameField({
  label,
  className,
  style,
  onFocus,
  ref,
  ...attributes
}: { label: string } & NameFieldAttributes) {
  const input = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const mountedRef = useRef(mounted);

  const onMount = useEffectEvent(() => {
    mountedRef.current = input.current !== null;
    setMounted(mountedRef.current);
  });
  useEffect(() => {
    onMount();
  }, []);

  function fill() {
    if (input.current && !input.current.value && mountedRef.current) input.current.value = "Ada";
  }

  const rootRef = useMemo(() => mergeRefs(input, ref), [input, ref]);

  return (
    <input
      ref={rootRef}
      name="name"
      aria-label={label}
      onFocus={(event) => {
        fill();
        onFocus?.(event);
      }}
      className={className}
      style={style}
      {...attributes}
    />
  );
}
