import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { dbClient } from "../clients";
import { CodeExecutionRequestData } from "../types";

export default async function updateCodeExecutionStatistics(requestData: {
  language: "cpp" | "java" | "py";
}) {
  // we don't want to update execution statistics when running test code (like Jest)
  if (process.env.NODE_ENV === "test") return;

  let language: string = requestData.language;
  if (language !== "cpp" && language !== "java" && language !== "py") {
    // this shouldn't happen, but just in case someone sends
    // a malicious language and we fail to catch it earlier
    language = "unknown";
  }

  const updateDB = async () => {
    await dbClient.send(
      new UpdateItemCommand({
        Key: {
          id: {
            S: "codeExecutions",
          },
        },
        TableName: "online-judge-statistics",
        // Note: make sure a map called `byDate` already exists inside the table...
        UpdateExpression: `ADD totalCount :inc, #languageCount :inc, byDate.#dateCount :inc`,
        ExpressionAttributeNames: {
          "#languageCount": `${language}Count`,
          "#dateCount": new Date().toISOString().split("T")[0], // Ex: 2021-10-31
        },
        ExpressionAttributeValues: {
          ":inc": {
            N: "1",
          },
        },
      })
    );
  };

  try {
    await updateDB();
  } catch (e) {
    if (
      e instanceof Error &&
      e?.message ===
        "The document path provided in the update expression is invalid for update"
    ) {
      // For us to do ADD byDate.#dateCount, the byDate map must exist
      // If it doesn't exist and fails with the above error, create the byDate map and rerun the update
      await dbClient.send(
        new UpdateItemCommand({
          Key: {
            id: {
              S: "codeExecutions",
            },
          },
          TableName: "online-judge-statistics",
          // Note: make sure a map called `byDate` already exists inside the table...
          UpdateExpression: `SET byDate = :value`,
          ConditionExpression: "attribute_not_exists(byDate)",
          ExpressionAttributeValues: {
            ":value": {
              M: {},
            },
          },
        })
      );
      await updateDB();
    }
  }
}
