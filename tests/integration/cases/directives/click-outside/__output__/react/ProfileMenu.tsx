import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { useDirective } from "./_unframework/useDirective";
import { vClickOutside } from "./vClickOutside";
import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";

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

  const [close] = useState(() => () => {
    if (!openRef.current) return;
    openRef.current = false;
    setOpen(openRef.current);
    onClosedRef.current?.();
  });

  const clickOutsideRef = useDirective(vClickOutside, () => close);

  return (
    <section
      className={cx("profile-menu", className)}
      aria-label="Profile"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <div className="menu" ref={clickOutsideRef}>
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
