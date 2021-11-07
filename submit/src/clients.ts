import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { S3Client } from "@aws-sdk/client-s3";

export const lambdaClient = new LambdaClient({ region: "us-west-1" });
export const dbClient = new DynamoDBClient({ region: "us-west-1" });
export const s3Client = new S3Client({ region: "us-west-1" });
