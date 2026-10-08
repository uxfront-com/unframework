// UF2004 in-place-mutation: `push` changes the array inside the ref in place, which React's and
// Solid's outputs never see; the likely fix replaces it whole, `tags.value = [...tags.value, …]`.
import { ref } from "unframework";

export default function TagList() {
  const tags = ref(["design"]);

  function addTag() {
    tags.value.push("systems");
  }

  return (
    <div class="tag-list">
      <ul>
        {tags.value.map((tag) => (
          <li key={tag}>{tag}</li>
        ))}
      </ul>
      <button type="button" onClick={addTag}>
        Add a tag
      </button>
    </div>
  );
}
