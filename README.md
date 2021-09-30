# Serverless Online Judge

From the Competitive Programming Initiative

## Goal

To create a low-cost, reliable, fast, and consistent online judge that supports C++, Java, and Python.

## Architecture

Everything is done with AWS Lambda functions. The online judge itself is split into three functions:

1. The main lambda function that the user calls to create a new submission, along with the source code and test data. This function calls other lambdas to compile and execute the code, then updates the database as new results come in.
2. The sandboxed code execution lambda function that either takes source code and returns a compiled binary, or takes a compiled binary and the input and returns the output. For security, this function has minimal access to AWS resources. This function is never directly called by the user, and can only be called by the main lambda function.
3. The status check lambda function that the user calls to check the status of their submission. This function queries the database and returns the submission status.

### Submit Function

The submit function supports two modes: Execution (designed for the USACO Guide IDE) and submission (designed for problem submission with USACO Guide groups, or problems with multiple test cases).

### Code Execution

User passes in language, source code, and either input. The submit function uses the execution lambda to compile the code, then uses the execution lambda to run the code. Finally, the result of the code execution is returned synchronously.

### Problem Submission (POST)

User passes in language, source code, and problem ID. The submit function creates a new submission ID, adds it to the database, and returns the submission ID to the user. Then, it calls the execution lambda to compile the code, updating the submission status in the database accordingly. Finally, for each test case, it calls another execution lambda to execute the code, updating the submission submission status as each result comes in.

### Problem Submission (GET)

The user passes in the submission ID they received from the Problem Submission POST request, and the lambda function queries the database and returns the status of the submission.

### Execution Lambda

This internal lambda accepts a base64-encoded executable, the input, and returns the output of the program. The lambda **does not** sandbox code execution due to lack of root privileges; **the lambda itself is the sandbox.** Therefore:

- the lambda should not be given the expected output
- the lambda should not have internet access (blocked by AWS VPC)
- the lambda should not have dangerous permissions (blocked by AWS IAM roles)
- the lambda should be able to handle malicious code (if the lambda crashes then AWS auto-spawns a new one)

With these restrictions in place, I *think* the most malicious code can do is screw around with future submissions that are executed on the same lambda. But hopefully nobody is malicious enough to do that.

This lambda is also responsible for code compilation. For languages that don't need compilation, like Python, all "compilation" entails is putting the Python file as well as the Python command into a base64-encoded ZIP file.

Note that since Java compilation often results in multiple output files, this lambda should accept base64-encoded ZIP files.

## Development

We use the [AWS Serverless Application Model (SAM)](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-getting-started.html).

### Building the image

```
sam build
```

### Testing locally

#### Testing Execution Lambda (Compile) locally

You can change the event JSON file accordingly to test various parts of the execution lambda.

```
sam build --cached --parallel && sam local invoke ExecuteFunction -e execute/events/compile.json
```

#### Testing submission lambda locally

1. Remove `.aws-sam` folder, so that `sam local invoke` will default to the source folder
2. Run `npm run watch` inside `submit/`
3. Run `sam local start-api`
4. Make a request to `http://localhost:3000/execute` or the appropriate API route

You don't have to rerun `sam local start-api` when your code changes. Note that the execute lambda this calls is the execution lambda that's currently deployed on AWS, not the local execution lambda.

#### Unit Tests with Jest

```
npm run test
```

If snapshots need to be updated:

```
npm run test -- -u
```

### Prettier

```
npx prettier --write .
```

## Deployment

```
sam build
sam deploy
```

## API

The API can be accessed at https://oh2kjsg6kh.execute-api.us-west-1.amazonaws.com/Prod

- `POST /execute`: Code execution. Ex: USACO Guide IDE
- `POST /submissions`: Create a new problem submission. Ex: code submission on USACO Guide groups
- `GET /submissions/{submissionId}`: Get the status of the submission associated with the given submission ID

Note: REST API is used over HTTP API because of [CORS issues](https://github.com/aws/aws-sam-cli/issues/2637) with HTTP.