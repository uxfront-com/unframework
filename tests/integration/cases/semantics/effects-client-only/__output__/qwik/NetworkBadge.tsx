import { component$, useSignal, useTask$, useVisibleTask$ } from "@qwik.dev/core";

export default component$(() => {
  const online = useSignal<boolean>();
  const label = useSignal("Checking the connection");

  const previousOnline = useSignal(() => online.value);
  useTask$(
    ({ track }) => {
      const value = track(online);
      if (Object.is(value, previousOnline.value)) return;
      previousOnline.value = value;
      label.value = value ? "Online" : "Offline";
    },
    { deferUpdates: false },
  );

  useVisibleTask$(
    () => {
      online.value = navigator.onLine;
    },
    { strategy: "document-ready" },
  );

  return (
    <p class="network-badge" role="status" data-checked={online.value === undefined ? "no" : "yes"}>
      {label.value}
    </p>
  );
});
