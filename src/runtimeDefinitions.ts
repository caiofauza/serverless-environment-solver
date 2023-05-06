export const RuntimeDefinitions = {
  nodejs: {
    environmentVariableReference: "process.env",
    fileExtensions: ["js", "ts"],
    importRegex: /(^|\s|;|\{)import\s.*?from\s['"`](.*?)['"`]/s,
    importPathIndex: 2,
  },
  python: {
    environmentVariableReference: "os.environ",
    fileExtensions: ["py"],
    importRegex: /(^|\s)from\s(.*?)\simport\s/g,
    importPathIndex: 2,
  },
};
