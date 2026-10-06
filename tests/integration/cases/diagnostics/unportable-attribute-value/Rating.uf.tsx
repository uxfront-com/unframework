// UF3008 unportable-attribute-value: a `javascript:` URL, which React blocks and the compiler
// cannot analyse, and an ARIA state with a value ARIA does not define ("yes").
export default function Rating() {
  return (
    <div class="rating">
      <p>
        <span aria-hidden="yes">★★★★☆</span> Four stars
      </p>
      <a href="javascript:void(0)">Rate it</a>
    </div>
  );
}
