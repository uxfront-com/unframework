import { useEffect, useEffectEvent, useRef, useState } from "react";

export default function NetworkBadge() {
  const [online, setOnline] = useState<boolean>();
  const onlineRef = useRef(online);
  const [label, setLabel] = useState("Checking the connection");
  const labelRef = useRef(label);

  const previousOnline = useRef(online);
  const onOnlineChange = useEffectEvent((value: typeof online) => {
    labelRef.current = value ? "Online" : "Offline";
    setLabel(labelRef.current);
  });
  useEffect(() => {
    const previous = previousOnline.current;
    if (Object.is(previous, online)) return;
    previousOnline.current = online;
    onOnlineChange(online);
  }, [online]);

  const onMount = useEffectEvent(() => {
    onlineRef.current = navigator.onLine;
    setOnline(onlineRef.current);
  });
  useEffect(() => {
    onMount();
  }, []);

  return (
    <p className="network-badge" role="status" data-checked={online === undefined ? "no" : "yes"}>
      {label}
    </p>
  );
}
