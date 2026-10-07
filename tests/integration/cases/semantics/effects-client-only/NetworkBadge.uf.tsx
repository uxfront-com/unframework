import { onMounted, ref, watch } from "unframework";

export default function NetworkBadge() {
  const online = ref<boolean>();
  const label = ref("Checking the connection");

  watch(online, (value) => {
    label.value = value ? "Online" : "Offline";
  });

  onMounted(() => {
    online.value = navigator.onLine;
  });

  return (
    <p class="network-badge" role="status" data-checked={online.value === undefined ? "no" : "yes"}>
      {label.value}
    </p>
  );
}
