// A project whose engine plugin fails to start: every preview server fails alike, and says why.
export default {
  targets: ["vue", "react"],
  vitePlugins: () => {
    throw new Error("no licence key found in styleframe.config.ts");
  },
};
