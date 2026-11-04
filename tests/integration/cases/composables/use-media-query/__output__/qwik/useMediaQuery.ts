import { $, useConstant, useSignal, useVisibleTask$ } from "@qwik.dev/core";

export function useMediaQuery(query: string) {
  const matches = useSignal(false);
  const list = useSignal<MediaQueryList | undefined>();

  const update = useConstant(() =>
    $(() => {
      matches.value = list.value?.matches ?? false;
    }),
  );

  useVisibleTask$(
    () => {
      list.value = window.matchMedia(query);
      matches.value = list.value?.matches ?? false;
      list.value.addEventListener("change", update);
    },
    { strategy: "document-ready" },
  );

  useVisibleTask$(
    ({ cleanup }) => {
      cleanup(() => {
        list.value?.removeEventListener("change", update);
      });
    },
    { strategy: "document-ready" },
  );

  return { matches };
}
