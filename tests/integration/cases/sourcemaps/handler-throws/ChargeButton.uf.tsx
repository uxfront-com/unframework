export default function ChargeButton() {
  function charge() {
    throw new Error("The card was declined");
  }

  return (
    <button type="button" onClick={charge}>
      Charge
    </button>
  );
}
