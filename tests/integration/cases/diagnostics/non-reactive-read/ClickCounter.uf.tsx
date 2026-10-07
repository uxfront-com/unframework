// UF2010 non-reactive-read: `clicks` is a setup `let`, which is not reactive, read in the
// template: the count would never update. Hold a value the template reads in a `ref`.
export default function ClickCounter() {
  let clicks = 0;

  function count() {
    clicks += 1;
  }

  return (
    <button type="button" onClick={count}>
      Clicked {clicks} times
    </button>
  );
}
