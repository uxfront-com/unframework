import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { useNextTick } from "./_unframework/useNextTick";
import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";

export interface SaveDraftEvents {
  onSaved?: (attempt: number, status: string) => void;
}

export interface SaveDraftAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function SaveDraft({
  onSaved,
  className,
  style,
  ...attributes
}: SaveDraftEvents & SaveDraftAttributes) {
  const onSavedRef = useRef(onSaved);
  useLayoutEffect(() => {
    onSavedRef.current = onSaved;
  });

  const nextTick = useNextTick();
  const [status, setStatus] = useState("Not saved");
  const statusRef = useRef(status);
  const [attempts, setAttempts] = useState(0);
  const attemptsRef = useRef(attempts);

  async function save() {
    statusRef.current = "Saving";
    setStatus(statusRef.current);
    attemptsRef.current += 1;
    setAttempts(attemptsRef.current);
    await Promise.resolve();
    statusRef.current = "Checking";
    setStatus(statusRef.current);
    await nextTick();
    statusRef.current = `Saved, attempt ${attemptsRef.current}`;
    setStatus(statusRef.current);
    onSavedRef.current?.(attemptsRef.current, statusRef.current);
  }

  return (
    <section
      className={cx("save-draft", className)}
      aria-label="Draft"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <p role="status">{status}</p>
      <button type="button" onClick={save}>
        Save the draft
      </button>
    </section>
  );
}
