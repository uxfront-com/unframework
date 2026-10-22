import {
  type CSSProperties,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export interface ProfileMenuEvents {
  onClosed?: () => void;
}

export interface ProfileMenuAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function ProfileMenu({
  onClosed,
  className,
  style,
  ...attributes
}: ProfileMenuEvents & ProfileMenuAttributes) {
  const onClosedRef = useRef(onClosed);
  useLayoutEffect(() => {
    onClosedRef.current = onClosed;
  });

  const [open, setOpen] = useState(false);
  const openRef = useRef(open);
  const menu = useRef<HTMLDivElement>(null);

  const [onDocumentClick] = useState(() => (event: MouseEvent) => {
    const element = menu.current;
    if (openRef.current && element && !element.contains(event.target as Node)) {
      openRef.current = false;
      setOpen(openRef.current);
      onClosedRef.current?.();
    }
  });

  const onMount = useEffectEvent(() => {
    document.addEventListener("click", onDocumentClick);
  });
  useEffect(() => {
    onMount();
  }, []);

  const onUnmount = useEffectEvent(() => {
    document.removeEventListener("click", onDocumentClick);
  });
  useEffect(() => () => onUnmount(), []);

  return (
    <section
      className={cx("profile-menu", className)}
      aria-label="Profile"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <div className="menu" ref={menu}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            openRef.current = !openRef.current;
            setOpen(openRef.current);
          }}
        >
          Account
        </button>
        {open ? (
          <ul aria-label="Account actions">
            <li>
              <button type="button">Settings</button>
            </li>
            <li>
              <button type="button">Sign out</button>
            </li>
          </ul>
        ) : null}
      </div>
      <p>Outside the menu</p>
    </section>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
