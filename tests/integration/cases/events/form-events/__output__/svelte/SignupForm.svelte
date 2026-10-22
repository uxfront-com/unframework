<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = {
    onsignup?: (fullName: string, email: string, plan: string, newsletter: boolean) => void;
    class?: ClassValue;
    style?: string;
  };

  let { onsignup, class: className, style, ...attributes }: Props = $props();

  let fullName = $state("");
  let email = $state("");
  let plan = $state("free");
  let newsletter = $state(false);
  let focused = $state("none");

  function submit(event: SubmitEvent) {
    event.preventDefault();
    onsignup?.(fullName, email, plan, newsletter);
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<form
  class={["signup-form", className]}
  aria-label="Sign up"
  onsubmit={submit}
  {style}
  {...scopeAttributes(attributes)}
>
  <label>Name<input
    name="name"
    onchange={(event) => (fullName = (event.currentTarget as HTMLInputElement).value)}
    onfocus={() => (focused = "name")}
    onblur={() => (focused = "none")}
  /></label
  ><label>Email<input
    name="email"
    type="email"
    oninput={(event) => (email = (event.currentTarget as HTMLInputElement).value)}
    onfocus={() => (focused = "email")}
    onblur={() => (focused = "none")}
  /></label
  ><label>Plan<select
    name="plan"
    onchange={(event) => (plan = (event.currentTarget as HTMLSelectElement).value)}
  ><option value="free">Free</option><option value="pro">Pro</option></select></label
  ><label><input
    name="newsletter"
    type="checkbox"
    onchange={(event) => (newsletter = (event.currentTarget as HTMLInputElement).checked)}
  />Send me the newsletter</label
  ><p
    role="status"
  >{`Name: ${fullName}; email: ${email}; plan: ${plan}; newsletter: ${newsletter ? "yes" : "no"}; focus: ${focused}`}</p
  ><button type="submit">Sign up</button>
</form>
