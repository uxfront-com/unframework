/**
 * Tracks the framework a reader picks in the docs' Framework select, above the
 * sidebar or in the header's menu on smaller screens, as "Framework Selected"
 * in Amplitude: which of the seven the docs' readers work in. Every
 * `useFramework()` follows the pick through a storage event, this one
 * included. A pick restored from storage isn't tracked, and neither is one
 * made in another tab (the tab picked in has the focus).
 */
export default defineNuxtPlugin(() => {
  const { framework } = useFramework();

  watch(framework, (value) => {
    if (document.hasFocus()) window.amplitude?.track("Framework Selected", { framework: value });
  });
});
