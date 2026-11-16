import type { Attachment } from "svelte/attachments";

export function vMark(_getValue: () => string): Attachment<HTMLElement> {
  const hooks = {
    unmounted(el: HTMLElement) {
      document.dispatchEvent(new CustomEvent("mark-unmounted", { detail: el }));
    },
  };
  return (element) => {
    return () => hooks.unmounted(element);
  };
}
