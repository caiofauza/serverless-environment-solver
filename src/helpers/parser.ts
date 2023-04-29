export const extractStringBeforeNumber = (str: string) =>
    str.match(/^(\D+)\d+/)?.[1] || "";
