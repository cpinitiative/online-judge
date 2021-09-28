const aws = require("aws-sdk");
const { v4: uuidv4 } = require('uuid');

const lambda = new aws.Lambda({
  region: "us-west-1"
});
const docClient = new aws.DynamoDB.DocumentClient();

exports.handler = function (event, context, callback) {
  const submissionId = uuidv4();
  lambda.invoke({
    FunctionName: 'execute',
    Payload: JSON.stringify({
      type: "compile",
      language: event.language,
      compilerOptions: event.compilerOptions,
      filename: event.filename,
      sourceCode: event.sourceCode,
    }, null, 2)
  }, function(error, data) {
    if (error) {
      context.done('error', error);
    }
    if(data.Payload){
      lambda.invoke({
        FunctionName: 'execute',
        Payload: JSON.stringify({
          type: "execute",
          payload: JSON.parse(data.Payload.toString()).output,
          input: event.input
        }, null, 2)
      }, function(error, data) {
        if (error) {
          context.done('error', error);
        }
        if(data.Payload){
          context.succeed(JSON.parse(data.Payload));
        }
      });
    }
  });
}
