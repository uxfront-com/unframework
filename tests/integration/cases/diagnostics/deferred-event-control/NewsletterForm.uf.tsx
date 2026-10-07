// UF3033 deferred-event-control: `preventDefault()` after an `await` runs once the browser has
// already submitted the form; call it first, at the top of the handler.
import { nextTick, ref } from "unframework";

export default function NewsletterForm() {
  const sending = ref(false);

  async function subscribe(event: SubmitEvent) {
    sending.value = true;
    await nextTick();
    event.preventDefault();
    sending.value = false;
  }

  return (
    <form class="newsletter-form" aria-label="Newsletter" onSubmit={subscribe}>
      <label>
        Email
        <input name="email" type="email" />
      </label>
      <button type="submit" disabled={sending.value}>
        Subscribe
      </button>
    </form>
  );
}
