export interface Serverless {
  serviceDir: string;
  configurationFilename: string;
  configurationInput: {
    service: string;
    frameworkVersion: string;
    provider: {
      name: string;
      endpointType: string;
      stage: string;
      runtime: string;
      region: string;
      timeout: number;
      memorySize: number;
      versionFunctions: boolean;
      environment: { [key: string]: string };
    };
    functions: ServerlessFunctions[];
  };
  getProvider: (provider: string) => string;
}

export interface ServerlessFunctions {
  [key: string]: {
    handler: string;
    description?: string;
    environment?: { [key: string]: string }[];
  };
}
export interface ServerlessOptions {}

export interface HandlersUsedVariable {
  name: string;
  variables: string[];
}
