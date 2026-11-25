// Named like Vue's built-in `<Transition>`: a template that wrote the tag would render that.
export default function Transition({ step }: { step: string }) {
  return <p class="step">Step: {step}</p>;
}
