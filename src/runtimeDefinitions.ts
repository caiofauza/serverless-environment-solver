export const RuntimeDefinitions = {
  nodejs: {
    environmentVariableReference: "process.env",
    fileExtensions: ["js", "ts"],
    importRegex: /(^|\s|;|\{)import\s.*?from\s['"`](.*?)['"`]/s,
    importReplaceRegex: /"|'|`/g,
    importPathIndex: 2,
  },
  python: {
    environmentVariableReference: "os.environ",
    fileExtensions: ["py"],
    importRegex: /(?<=from |import ).*?(?= |$)/,
    importReplaceRegex: /\./g,
    importPathIndex: 0,
  },
};
