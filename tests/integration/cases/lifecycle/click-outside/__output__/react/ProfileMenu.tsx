import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";

export interface ProfileMenuEvents {
  onClosed?: () => void;
}

export default function ProfileMenu({ onClosed }: ProfileMenuEvents) {
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
    <section className="profile-menu" aria-label="Profile">
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
