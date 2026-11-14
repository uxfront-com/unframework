// The main component of hydrate/ids: the server wrote `hint`, the hydrated DOM has `tip`, and the
// client render has `tip` too, so only the raw ids differ.
export default {
  html: '<p id="tip">Pick one size.</p>',
  hydrated: '<p id="tip">Pick one size.</p>',
};
