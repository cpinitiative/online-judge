# Serverless Online Judge

From the Competitive Programming Initiative

## Goal

To create a low-cost, reliable, fast, and consistent online judge that supports C++, Java, and Python.

## Architecture

Everything is done with AWS Lambda functions. The online judge itself is split into three functions:

1. The main lambda function that the user calls to create a new submission, along with the source code and test data. This function calls other lambdas to compile and execute the code, then updates the database as new results come in.
2. The sandboxed code execution lambda function that either takes source code and returns a compiled binary, or takes a compiled binary and the input and returns the output. For security, this function has minimal access to AWS resources. This function is never directly called by the user, and can only be called by the main lambda function.
3. The status check lambda function that the user calls to check the status of their submission. This function queries the database and returns the submission status.

## Main Lambda Function

User passes in language, source code, and either input or problem ID. The main lambda function compiles the code, then sends a base64-encoded executable to the execution lambda function along with the input. If given a problem ID (and there are multiple test cases), the main lambda function will send the executable to `n` different execution lambda functions, so that each test case can be graded simultaneously. As the code execution lambda functions complete, the main lambda function updates the submission results in the database.

## Code Execution Lambda

This internal lambda accepts a base64-encoded executable, the input, and returns the output of the program. The lambda **does not** sandbox code execution due to lack of root privileges; **the lambda itself is the sandbox.** Therefore:

- the lambda should not be given the expected output
- the lambda should not have internet access (blocked by AWS VPC)
- the lambda should not have dangerous permissions (blocked by AWS IAM roles)
- the lambda should be able to handle malicious code (if the lambda crashes then AWS auto-spawns a new one)

With these restrictions in place, I *think* the most malicious code can do is screw around with future submissions that are executed on the same lambda. But hopefully nobody is malicious enough to do that.

This lambda is also responsible for code compilation.

Note that since Java compilation often results in multiple output files, this lambda should accept base64-encoded ZIP files.

## Status Check Lambda

The user passes in the submission ID, and this lambda queries the database and returns the status of the submission.

## Deployment

```
docker build -t execute .
aws ecr get-login-password --region us-west-1 | docker login --username AWS --password-stdin 417600709600.dkr.ecr.us-west-1.amazonaws.com
aws ecr create-repository --repository-name execute --image-scanning-configuration scanOnPush=true --image-tag-mutability MUTABLE
docker tag  execute:latest 417600709600.dkr.ecr.us-west-1.amazonaws.com/execute:latest
docker push 417600709600.dkr.ecr.us-west-1.amazonaws.com/execute:latest
```

(only first, fourth, and fifth commands need to be run for updates)

```
docker run -d -v ~/.aws-lambda-rie:/aws-lambda -p 9000:8080 \
    --entrypoint /aws-lambda/aws-lambda-rie \
    execute:latest \
        /usr/bin/npx aws-lambda-ric app.handler
```