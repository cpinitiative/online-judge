export const IS_STAGING = process.env.IS_STAGING === "true";

// note: might be better to do this through cloudformation environment variables...

// used for problem submissions
export const DB_NAME = IS_STAGING ? "online-judge-Stage" : "online-judge";

// used by updateCodeExecutionStatistics.ts
export const DB_STATS_NAME = IS_STAGING
  ? "online-judge-statistics-Stage"
  : "online-judge-statistics";

// the execute function has different staging / production URLs
// in the future we should link this with cloudformation environment variables
// rather than hardcoding like this...
export const API_PREFIX = IS_STAGING ? "kmazh7pzpg" : "ggzk2rm2ad";

export const EXECUTE_FUNCTION_NAME = IS_STAGING
  ? "online-judge-ExecuteFunction-Stage"
  : "online-judge-ExecuteFunction";
