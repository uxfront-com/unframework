// A project whose component throws when Astro renders it with its initial props, which leave out
// `items`, a prop the preview cannot set: `preview build` records the failure for the frame.
export default { targets: ["astro"] };
