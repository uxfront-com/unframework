import { Show } from "solid-js";

export interface FileTransferProps {
  fileName: string;
  percent: number;
  paused: boolean;
  eta?: string;
}

export default function FileTransfer(props: FileTransferProps) {
  return (
    <div class="file-transfer">
      <svg class="file-transfer-progress" role="img" viewBox="0 0 36 36" width="36" height="36">
        <title>
          {props.fileName}: {props.percent}% sent. {props.eta}
        </title>
        <circle cx="18" cy="18" r="16" fill="none" stroke="#0969da" stroke-width="4" />
      </svg>
      <svg class="file-transfer-state" role="img" viewBox="0 0 16 16" width="16" height="16">
        <title>
          <Show when={props.paused} fallback={<>Sending {props.fileName}</>}>
            Transfer paused
          </Show>
        </title>
        <rect x="2" y="2" width="12" height="12" rx="2" fill="#1a7f37" />
      </svg>
    </div>
  );
}
