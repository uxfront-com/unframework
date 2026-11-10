import { ref } from "unframework";

import Chart from "./Chart.uf.tsx";

export default function ReportPanel() {
  const open = ref(false);

  function show() {
    open.value = true;
  }

  return (
    <section aria-label="Report">
      <button type="button" onClick={show}>
        Show the chart
      </button>
      {open.value ? <Chart /> : null}
    </section>
  );
}
