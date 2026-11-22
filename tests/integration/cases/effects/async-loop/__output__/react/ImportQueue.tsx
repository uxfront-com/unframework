import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { useNextTick } from "./_unframework/useNextTick";
import {
  type CSSProperties,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export interface ImportQueueProps {
  files: string[];
}

export interface ImportQueueEvents {
  onProgress?: (status: string, attempts: number) => void;
}

export interface ImportQueueAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function ImportQueue({
  files,
  onProgress,
  className,
  style,
  ...attributes
}: ImportQueueProps & ImportQueueEvents & ImportQueueAttributes) {
  const filesRef = useRef(files);
  useLayoutEffect(() => {
    filesRef.current = files;
  });

  const nextTick = useNextTick();
  const [status, setStatus] = useState("idle");
  const statusRef = useRef(status);
  const [attempts, setAttempts] = useState(0);
  const attemptsRef = useRef(attempts);

  const previousStatusAttempts = useRef<[typeof status, typeof attempts]>([status, attempts]);
  const onStatusAttemptsChange = useEffectEvent(
    ([nextStatus, nextAttempts]: [typeof status, typeof attempts]) => {
      onProgress?.(nextStatus, nextAttempts);
    },
  );
  useEffect(() => {
    const previous = previousStatusAttempts.current;
    if (Object.is(previous[0], status) && Object.is(previous[1], attempts)) return;
    previousStatusAttempts.current = [status, attempts];
    onStatusAttemptsChange([status, attempts]);
  }, [status, attempts]);

  async function importAll() {
    statusRef.current = "starting";
    setStatus(statusRef.current);
    for (const file of filesRef.current) {
      attemptsRef.current += 1;
      setAttempts(attemptsRef.current);
      await nextTick();
      statusRef.current = `imported ${file}`;
      setStatus(statusRef.current);
    }
    statusRef.current = "done";
    setStatus(statusRef.current);
  }

  return (
    <section
      className={cx("import-queue", className)}
      aria-label="Import"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <button type="button" onClick={importAll}>
        Import all
      </button>
      <p role="status">
        {status}, {attempts} attempts
      </p>
    </section>
  );
}
