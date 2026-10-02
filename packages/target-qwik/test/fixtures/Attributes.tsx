import { component$ } from "@qwik.dev/core";

export default component$(() => {
  return (
    <form class="attributes" noValidate>
      <label for="note" accessKey="n">
        Note
      </label>
      <input id="note" readOnly data-state="" autocomplete="off" />
      <time dateTime="2026-10-01" itemProp="date">
        Today
      </time>
      <img
        src="data:image/gif;base64,R0lGODlhAQABAAAAACw="
        alt=""
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
      />
      <button type="submit" formNoValidate disabled>
        Send
      </button>
      <svg viewBox="0 0 1 1" aria-hidden="true">
        <foreignObject width="1" height="1">
          <p contentEditable="true">Edit</p>
        </foreignObject>
      </svg>
    </form>
  );
});
