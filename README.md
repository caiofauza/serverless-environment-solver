# Serverless environment solver

<p>
<a href="https://www.serverless.com">  
    <img src="http://public.serverless.com/badges/v3.svg">  
</a>
<a>
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square">
</a>
<img src="https://img.shields.io/npm/l/serverless-offline.svg?style=flat-square">  
</p>
  
This plugin automatically assigns environment variables from a .env file to AWS Lambdas that reference the values. It ensures only necessary variables are applied, saving time and reducing errors. Easy to install and customize for specific project needs. Integrate env variables into AWS Lambda code seamlessly without manual management.

## Why should I need this plugin?

If you use a separate .env file for each environment and assign variables in the serverless.yml configuration, all the variables defined will be received by all your AWS Lambdas, even if the code doesn't use them. This plugin ensures that any AWS Lambdas created with the serverless framework receive only the environment variables that the code actually references.

## Installation

You can install the package with **npm** or **yarn**:

```sh
npm install --save-dev serverless-environment-solver
```

or

```sh
yarn add --dev serverless-environment-solver
```

After that, add the plugin to your `serverless.yml` file:

```yaml
...

plugins:
  - serverless-environment-solver
```

## Languages and cloud providers support

Currently, only functions written in the following programming languages ​​are supported:

- Javascript/Typescript

Currently, only the following cloud providers are supported:

- Amazon Web Services

Our expectation is to support **all** available languages in serverless functions across **all** public cloud providers. To achieve this, we would love to have your contribution.

## Usage example

You can find a usage example inside the **examples** folder, where two AWS lambdas are declared and an environment variable file is started. The plugin will automatically ensure that each lambda will only receive the environment variables that are used within the code.
