// A project that lets its own typeface into live captures, while its example draws in the
// system's font, which it doesn't list: that example still fails `font-fallback`.
export default {
  targets: ["vue"],
  liveFonts: ["Inkline Sans", "Inkline Mono"],
};
