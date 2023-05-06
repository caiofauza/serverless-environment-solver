import {
  HandlersUsedVariable,
  Serverless,
  ServerlessFunctions,
  ServerlessOptions,
} from "./types";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { RuntimeDefinitions } from "./runtimeDefinitions";
import { extractStringBeforeNumber } from "./helpers/parser";

export default class EnvironmentSolver {
  public serverless: Serverless;
  public options: ServerlessOptions;
  public basePath: string;
  public provider: string;
  public environment: { [key: string]: string };
  public hooks: object;
  public runtime: string;

  constructor(serverless: Serverless, options: ServerlessOptions) {
    this.serverless = serverless;
    this.options = options;
    this.basePath = this.serverless.serviceDir;
    this.provider = this.serverless.getProvider("aws");
    this.environment = this.serverless.configurationInput.provider.environment;
    this.runtime = extractStringBeforeNumber(
      this.serverless.configurationInput.provider.runtime
    );

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

    const environmentVariableReference = `${
      RuntimeDefinitions[this.runtime].environmentVariableReference
    }.`;

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

    if (handlersNames.length === 0)
      throw new Error("No function handlers found.");

    const runtimeExtension = this.getRuntimeExtension(handlersNames, functions);

    const handlersPaths = handlersNames.map((handlerName) => {
      const targetPath = functions[handlerName].handler.split(".");
      targetPath.pop();

      return `${this.basePath}/${targetPath.join(".")}.${runtimeExtension}`;
    });

    return [handlersPaths, handlersNames];
  }

  private getRuntimeExtension(
    handlersNames: string[],
    functions: ServerlessFunctions
  ): string {
    const availableExtensions = RuntimeDefinitions[this.runtime].fileExtensions;

    const targetPath = functions[handlersNames[0]].handler.split(".");
    targetPath.pop();

    for (const extension of availableExtensions) {
      const fullPath = `${this.basePath}/${targetPath.join(".")}.${extension}`;
      if (existsSync(fullPath)) return extension;
    }

    throw new Error(
      `No supported file extension could be found for runtime ${
        this.runtime
      }. Available file extensions are ${availableExtensions.join(", ")}`
    );
  }

  private async getFileStringContent(
    content: string,
    basePath: string
  ): Promise<string> {
    const importRegex = RuntimeDefinitions[this.runtime].importRegex;
    const importPathIndex = RuntimeDefinitions[this.runtime].importPathIndex;

    const match = content.match(importRegex);
    if (!match) return content;

    const importStatement = match[0];
    const importPath = match[importPathIndex].replace(/"|'|`/g, "");

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
