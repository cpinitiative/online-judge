import { GetItemCommand } from "@aws-sdk/client-dynamodb";
import { dbClient } from "../clients";

export default async function getSubmission(submissionID: string) {
  const dbGetParams = {
    TableName: "online-judge",
    Key: {
      submissionID: {
        S: submissionID,
      },
    },
  };

  const getCommand = new GetItemCommand(dbGetParams);
  const response = await dbClient.send(getCommand);

  return response.Item;
}
