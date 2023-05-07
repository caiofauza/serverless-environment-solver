import {
  HandlersUsedVariable,
  Serverless,
  ServerlessFunctions,
  ServerlessOptions,
} from "./types";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { RuntimeDefinitions } from "./runtimeDefinitions";
import {
  extractStringBeforeNumber,
  findEndOfVariableAssignmentIndex,
} from "./utils/parser";

export default class EnvironmentSolver {
  public serverless: Serverless;
  public options: ServerlessOptions;
  public basePath: string;
  public provider: string;
  public environment: { [key: string]: string };
  public hooks: object;
  public handlersNames: string[];
  public runtime: string;
  public runtimeFileExtension: string;

  constructor(serverless: Serverless, options: ServerlessOptions) {
    this.serverless = serverless;
    this.options = options;
    this.basePath = this.serverless.serviceDir;
    this.provider = this.serverless.getProvider("aws");
    this.environment = this.serverless.configurationInput.provider.environment;
    this.handlersNames = this.serverless.configurationInput.functions
      .map((item) => Object.keys(item))
      .flat();

    this.runtime = extractStringBeforeNumber(
      this.serverless.configurationInput.provider.runtime
    );
    this.runtimeFileExtension = this.getRuntimeFileExtension();

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
    }`;

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
    const usedVariables: string[] = [];
    let currentPosition = handlerFileContent.indexOf(
      environmentVariableReference
    );

    while (currentPosition > -1) {
      const targetPosition =
        currentPosition + environmentVariableReference.length;

      switch (handlerFileContent[targetPosition]) {
        case "[": {
          const variableEndIndex = handlerFileContent.indexOf(
            "]",
            targetPosition
          );
          const variable = handlerFileContent.substring(
            targetPosition + 2,
            variableEndIndex - 1
          );
          usedVariables.push(variable);

          currentPosition = handlerFileContent.indexOf(
            environmentVariableReference,
            variableEndIndex
          );
          break;
        }

        case ".": {
          const variableEndIndex = findEndOfVariableAssignmentIndex(
            handlerFileContent,
            targetPosition
          );
          const variable = handlerFileContent.substring(
            targetPosition + 1,
            variableEndIndex
          );
          usedVariables.push(variable);

          currentPosition = handlerFileContent.indexOf(
            environmentVariableReference,
            variableEndIndex
          );
          break;
        }

        default:
          currentPosition = handlerFileContent.indexOf(
            environmentVariableReference,
            targetPosition
          );
          break;
      }
    }

    return usedVariables;
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

    if (this.handlersNames.length === 0)
      throw new Error("No function handlers found.");

    const handlersPaths = this.handlersNames.map((handlerName) => {
      const targetPath = functions[handlerName].handler.split(".");
      targetPath.pop();

      return `${this.basePath}/${targetPath.join(".")}.${
        this.runtimeFileExtension
      }`;
    });

    return [handlersPaths, this.handlersNames];
  }

  private getRuntimeFileExtension(): string {
    const functions = this.serverless.configurationInput.functions;
    const availableExtensions = RuntimeDefinitions[this.runtime].fileExtensions;

    const targetPath = functions[0][this.handlersNames[0]].handler.split(".");
    targetPath.pop();

    for (const extension of availableExtensions) {
      const handlerPath = `${this.basePath}/${targetPath.join(
        "."
      )}.${extension}`;
      if (existsSync(handlerPath)) return extension;
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
    const importReplaceRegex =
      RuntimeDefinitions[this.runtime].importReplaceRegex;
    const importPathIndex = RuntimeDefinitions[this.runtime].importPathIndex;

    const match = content.match(importRegex);
    if (!match) return content;

    const importStatement = match[0];

    const importPath = match[importPathIndex]?.replace(importReplaceRegex, "");
    const endOfLinePosition = content.indexOf("\n", match.index) + 1;

    const filePath = `${basePath}/${importPath}.${this.runtimeFileExtension}`;
    if (!existsSync(filePath)) return content;

    const importedContent = await readFile(filePath, "utf-8");

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
