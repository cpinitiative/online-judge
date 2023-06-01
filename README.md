Massive todo list before this can be published:
- modify VPC settings to restrict internet access
- don't publish test cases
- ...
- handle batched grading (especially execution verdict typing)
- handle custom graders: execute now takes in an optional grader compiled file, as well as s3 link to expected output.
- IMPORTANT: Fix ECR lifecycle stuff

# Serverless Online Judge

From the Competitive Programming Initiative

## Goal

To create a low-cost, reliable, fast, and consistent online judge that supports C++, Java, and Python.

## Architecture

Everything is done with AWS Lambda functions. The online judge itself is split into two functions:

1. The main lambda function that the user calls. This lambda function calls the sandboxed code execution lambda function and returns the output to the user. It has full access to AWS resources, so it should not execute any user code.
2. The sandboxed code execution lambda function that either takes source code and returns a compiled binary, or takes a compiled binary and the input and returns the output. For security, this function has minimal access to AWS resources. This function is never directly called by the user, and can only be called by the main lambda function.

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

- If you get "Build Failed .... Path resolution for runtime: provided of binary: make was not successful", make sure `make` is installed.

### Building the image

```
sam build
```

### Testing locally

#### Setting up DynamoDB Locally

https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html

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

If you encounter timeout issues, change timeout in `template.yaml` temporarily.

---

Alternatively, you can run `npm run watch` followed by `node dist/src/runLambdaLocally.js` if you don't want to have to make a request to the API route.

#### Unit Tests with Jest

```
npm run test
```

If snapshots need to be updated:

```
npm run test -- -u
```

You can also run these tests in the Docker image itself, especially if you're getting some ulimit cannot be set error.

#### Setting up docker

NOTE: I never got this working (for running npm run test...)

```
cd execute
# maybe you only need the platform argument on mac?
# this took like 15 minutes on an M1
docker build . --platform linux/amd64 -t oj-execute
docker run --platform linux/amd64 -it --entrypoint /bin/bash oj-execute

# note: really slow D:
# AWS_EXECUTION_ENV is important! otherwise it will try and fail to use g++
AWS_EXECUTION_ENV=true npm run test -- -t "C\+\+"
```

#### Testing Builds

Source: https://docs.aws.amazon.com/AmazonECR/latest/userguide/amazon_linux_container_image.html

```
docker run -it public.ecr.aws/amazonlinux/amazonlinux /bin/bash
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

To deploy with a stack name:

```
sam deploy --stack-name Stage
```

## API

The API can be accessed at https://ggzk2rm2ad.execute-api.us-west-1.amazonaws.com/Prod

Staging: https://kmazh7pzpg.execute-api.us-west-1.amazonaws.com/Prod

- `POST /execute`: Code execution. Ex: USACO Guide IDE.
- `POST /submissions` (under development): Create a new problem submission. Ex: code submission on USACO Guide groups
- `GET /submissions/{submissionID}` (under development): Get the status of the submission associated with the given submission ID

Until API docs can be properly written, you can refer to `submit/src/types.ts` to get an idea of the payload and the response types.

Note: REST API is used over HTTP API because of [CORS issues](https://github.com/aws/aws-sam-cli/issues/2637) with HTTP.

**Warning**: Not for public use; contact us if you'd like to use the API. The API may change without warning.

## Misc Notes

### Installing GCC on Amazon Linux 2

The default version of GCC is not new enough to support some of the [`-fsanitize=undefined`](https://usaco.guide/general/debugging-lang/#-fsanitizeundefined) features. We can use [`devtoolset-10`](https://access.redhat.com/documentation/en-us/red_hat_developer_toolset/10/html-single/user_guide/index#part-Introduction) to get access to a newer version of GCC.

```
yum install -y yum-utils wget
yum-config-manager --add-repo http://mirror.centos.org/centos/7/sclo/x86_64/rh/
wget http://mirror.centos.org/centos/7/os/x86_64/Packages/libgfortran5-8.3.1-2.1.1.el7.x86_64.rpm
yum install libgfortran5-8.3.1-2.1.1.el7.x86_64.rpm -y
yum install -y devtoolset-10 --nogpgcheck
scl enable devtoolset-10 bash
```

You might be able to get away with just installing `devtoolset-10-toolchain`, but I haven't tried.

Note that the last line, `scl enable devtoolset-10 bash`, doesn't seem to work with AWS Lambda. Instead, the full path, `/opt/rh/devtoolset-10/root/usr/bin/g++`, is used.

Furthermore, some optional libraries need to be installed for flags like `fsanitize` to work. Optional libraries can be found with `yum list available devtoolset-10-\*`. I have no idea which are needed...
- `devtoolset-10-libubsan-devel.x86_64` is needed for `fsanitize=undefined`
- `devtoolset-10-libasan-devel.x86_64` is needed for `fsanitize=address`

Also see [this SO post](https://stackoverflow.com/questions/61165009/how-to-install-devtoolset-8-gcc-8-on-amazon-linux-2).

### Out of space -- CE

I encountered an issue where all compilations would fail because the `/tmp` directory was out of space. This turned out to be because AWS Lambda would generate core dump files anytime there is a runtime error. Solved with `ulimit -c 0`.

### InvalidSignatureException

I got this once:

```
2021-12-05T00:32:08.371Z	89cac995-f38c-43d1-bfb5-16a76aa83f70	ERROR	InvalidSignatureException: Signature expired: 20211205T002507Z is now earlier than 20211205T002708Z (20211205T003208Z - 5 min.)
    at deserializeAws_restJson1InvokeCommandError (/var/task/node_modules/@aws-sdk/client-lambda/dist-cjs/protocols/Aws_restJson1.js:5156:41)
    at runMicrotasks (<anonymous>)
    at processTicksAndRejections (internal/process/task_queues.js:95:5)
    at async /var/task/node_modules/@aws-sdk/middleware-serde/dist-cjs/deserializerMiddleware.js:6:20
    at async /var/task/node_modules/@aws-sdk/middleware-signing/dist-cjs/middleware.js:11:20
    at async StandardRetryStrategy.retry (/var/task/node_modules/@aws-sdk/middleware-retry/dist-cjs/StandardRetryStrategy.js:51:46)
    at async /var/task/node_modules/@aws-sdk/middleware-logger/dist-cjs/loggerMiddleware.js:6:22
    at async compile (/var/task/dist/src/helpers/compile.js:16:29)
    at async Promise.all (index 1)
    at async createSubmission (/var/task/dist/src/problemSubmission/createSubmission.js:24:47) {
  '$fault': 'client',
  '$metadata': {
    httpStatusCode: 403,
    requestId: '6642a280-9ae4-4de9-98f7-049727ebddca',
    extendedRequestId: undefined,
    cfId: undefined,
    attempts: 3,
    totalRetryDelay: 285
  }
}
```

May be able to be temporarily resolved by forcing lambdas to restart:

```
aws lambda update-function-configuration --function-name "online-judge-SubmitFunction" --description "upd"
aws lambda update-function-configuration --function-name "online-judge-ExecuteFunction" --description "upd"
```

### Stack Size

See https://github.com/cpinitiative/online-judge/issues/10