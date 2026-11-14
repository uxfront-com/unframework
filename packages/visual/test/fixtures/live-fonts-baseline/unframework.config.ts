// The live-fonts fixture compared with committed baselines, which take the bundled font alone,
// whatever the project lists.
export default {
  targets: ["vue"],
  liveFonts: (process.env.UF_FIXTURE_FONTS ?? "").split(",").filter(Boolean),
};
