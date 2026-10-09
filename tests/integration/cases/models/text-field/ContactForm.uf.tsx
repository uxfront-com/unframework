import { ref } from "unframework";

export default function ContactForm() {
  const name = ref("Ada");
  const email = ref("");
  return (
    <form aria-label="Contact">
      <label>
        Name <input v-model={name.value} />
      </label>
      <label>
        Email <input type="email" v-model={email.value} />
      </label>
      <output>
        {name.value} at {email.value || "no address"}
      </output>
      <button type="button" onClick={() => (name.value = "Grace")}>
        Use Grace
      </button>
    </form>
  );
}
