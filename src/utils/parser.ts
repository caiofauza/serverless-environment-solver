export const extractStringBeforeNumber = (str: string) =>
  str.match(/^(\D+)\d+/)?.[1] || "";

export const findEndOfVariableAssignmentIndex = (
  content: string,
  startIndex: number
) => content.slice(startIndex).search(/\s|,|;|:|\n|\r|}/) + startIndex;
