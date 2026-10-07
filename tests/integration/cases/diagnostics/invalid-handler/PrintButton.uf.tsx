// UF3029 invalid-handler: an HTML-style string handler. A handler is a setup function's name or
// an arrow function: `onClick={print}`, `onClick={() => print()}`.
export default function PrintButton() {
  return (
    <button type="button" class="print-button" onClick="window.print()">
      Print
    </button>
  );
}
