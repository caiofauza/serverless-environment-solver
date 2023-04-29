import { HandlersUsedVariable, Serverless, ServerlessOptions } from "./types";
import { readFile } from "fs/promises";
import { LanguageDefinitions } from "./languageDefinitions";
import { extractStringBeforeNumber } from "./helpers/parser";

export default class EnvironmentSolver {
  public serverless: Serverless;
  public options: ServerlessOptions;
  public basePath: string;
  public provider: string;
  public environment: { [key: string]: string };
  public hooks: object;

  constructor(serverless: Serverless, options: ServerlessOptions) {
    this.serverless = serverless;
    this.options = options;
    this.basePath = this.serverless.serviceDir;
    this.provider = this.serverless.getProvider("aws");
    this.environment = this.serverless.configurationInput.provider.environment;

    this.hooks = {
      initialize: () =>
        this.start().then(() =>
          console.info(
            "[Environment Variables Solver] Environment variables solved ✔"
          )
        ),
    };
  }

  public async start() {
    const [handlersFilePaths, handlersNames] =
      this.getHandlersFilePathsAndNames();

    const handlersFileContents = await this.getHandlerFilesContent(
      handlersFilePaths
    );

    const handlersUsedVariables = this.getHandlersUsedVariables(
      handlersNames,
      handlersFileContents
    );

    this.replaceEnvironmentVariables(handlersNames, handlersUsedVariables);
  }

  private getHandlersUsedVariables(
    handlersNames: string[],
    handlersFileContents: string[]
  ): HandlersUsedVariable[] {
    const handlersUsedVariables: HandlersUsedVariable[] = [];

    const language = extractStringBeforeNumber(
      this.serverless.configurationInput.provider.runtime
    );
    const environmentVariableReference = `${LanguageDefinitions[language].environmentVariableReference}.`;

    handlersFileContents.forEach((handlerFileContent, index) => {
      const usedVariables = this.getHandlerContentUsedVariables(
        handlerFileContent,
        environmentVariableReference
      );

      handlersUsedVariables.push({
        name: handlersNames[index],
        variables: usedVariables,
      });
    });

    return handlersUsedVariables;
  }

  private getHandlerContentUsedVariables(
    handlerFileContent: string,
    environmentVariableReference: string
  ): string[] {
    const variables = [];
    let position = handlerFileContent.indexOf(environmentVariableReference);

    while (position > -1) {
      const targetPosition = position + environmentVariableReference.length;
      const variableLastCharacterIndex = handlerFileContent.indexOf(
        "}",
        targetPosition
      );

      variables.push(
        handlerFileContent.substring(targetPosition, variableLastCharacterIndex)
      );
      position = handlerFileContent.indexOf(
        environmentVariableReference,
        variableLastCharacterIndex + 1
      );
    }

    return variables;
  }

  private replaceEnvironmentVariables(
    handlersNames: string[],
    handlersUsedVariables: HandlersUsedVariable[]
  ): void {
    handlersNames.forEach((handlerName) => {
      const targetHandler = handlersUsedVariables.find(
        (usedVariable) => usedVariable.name === handlerName
      );

      const environmentVariables = Object.assign(
        {},
        ...targetHandler.variables.map((variable) => ({
          [variable]: this.environment[variable],
        }))
      );

      this.serverless.configurationInput.functions[handlerName].environment =
        environmentVariables;
    });

    this.serverless.configurationInput.provider.environment = null;
  }

  private getHandlersFilePathsAndNames(): [string[], string[]] {
    const functions = this.serverless.configurationInput.functions;
    const handlersNames = Object.keys(functions);

    const handlersPaths = handlersNames.map((handlerName) => {
      const targetPath = functions[handlerName].handler.split(".");
      targetPath.pop();

      return `${this.basePath}/${targetPath.join(".")}.js`;
    });

    return [handlersPaths, handlersNames];
  }

  private async getFileStringContent(
    content: string,
    basePath: string
  ): Promise<string> {
    const importRegex = /(^|\s|;|\{)import\s.*?from\s['"`](.*?)['"`]/s;

    const match = content.match(importRegex);
    if (!match) return content;

    const importStatement = match[0];
    const importPath = match[2].replace(/"|'|`/g, "");

    const endOfLinePosition = content.indexOf("\n", match.index) + 1;

    const importedContent = await readFile(
      `${basePath}/${importPath}.js`,
      "utf-8"
    );

    const remainingFileContent = await this.getFileStringContent(
      content.slice(endOfLinePosition),
      basePath
    );

    return `${await this.getFileStringContent(
      importedContent,
      basePath
    )}\n${importStatement}${remainingFileContent}`;
  }

  private async getHandlerFilesContent(paths: string[]): Promise<string[]> {
    const readFileContentsPromises = paths.map((path) =>
      readFile(path, "utf-8")
    );

    const fileContents = await Promise.all(readFileContentsPromises);

    const stringContentRetrievePromises = fileContents.map(
      async (content, index) => {
        const basePath = paths[index].split("/").slice(0, -1).join("/");
        return await this.getFileStringContent(content, basePath);
      }
    );

    return await Promise.all(stringContentRetrievePromises);
  }
}

module.exports = EnvironmentSolver;
