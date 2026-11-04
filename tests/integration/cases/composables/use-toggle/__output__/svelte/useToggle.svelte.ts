export function useToggle(initial: boolean) {
  let on = $state.raw(initial);

  function toggle() {
    on = !on;
  }

  function close() {
    on = false;
  }

  return {
    get on() {
      return on;
    },
    toggle,
    close,
  };
}
