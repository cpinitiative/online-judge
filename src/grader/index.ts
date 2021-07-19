import { grade } from "./grader";
import {
    getJobPath,
    Language,
    Submission,
    SubmissionQueueItem,
} from "../utils";
import axios from "axios";
import { unzip } from "unzipit";
import * as admin from "firebase-admin";
import winston from "winston";
import serviceAccountKey from "../../serviceAccountKey.json";
import Bull from "bull";
import * as dotenv from "dotenv";
dotenv.config({ path: __dirname + "/.env" });

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error("Missing environment variable: FIREBASE_SERVICE_ACCOUNT");
}
if (!process.env.REDIS_PASSWORD) {
    throw new Error("Missing environment variable: REDIS_PASWORD");
}

admin.initializeApp({
    credential: admin.credential.cert(
        JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
    databaseURL: "https://usaco-guide.firebaseio.com",
});

const logger = winston.createLogger({
    level: "debug",
    format: winston.format.simple(),
    transports: [
        //
        // - Write all logs with level `error` and below to `error.log`
        // - Write all logs with level `info` and below to `combined.log`
        //
        new winston.transports.Console({ level: "warning" }),

        // maxSize = 10000000 is approx 10MB
        new winston.transports.File({
            filename: "logs/grader-error.log",
            level: "warning",
            maxsize: 10000000,
        }),
        new winston.transports.File({
            filename: "logs/grader.log",
            maxsize: 10000000,
        }),
    ],
});

const submissionQueue = new Bull<SubmissionQueueItem>("submission_queue", {
    redis: {
        host: "judgedb.usaco.guide",
        password: process.env.REDIS_PASSWORD,
    },
});
submissionQueue.process(async (job) => {
    const { groupId, postId, problemId, submissionId } = job.data;

    // can't pass submission itself because Bull can't handle non-primitive data
    // types, since those can't be stored in redis for persistence
    const submissionRef = admin
        .firestore()
        .collection("groups")
        .doc(groupId)
        .collection("posts")
        .doc(postId)
        .collection("problems")
        .doc(problemId)
        .collection("submissions")
        .doc(submissionId);
    const submission = (await submissionRef.get()).data() as Submission;

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (submission.language === "py") {
        logger.error(
            `Received unknown language "${submission.language}". Inferred language 'python', but this should be changed in the future.`
        );
        submission.language = Language.PYTHON;
    }

    console.log("Queue processing job: " + submissionRef.path);
    logger.debug("Queue processing job: " + submissionRef.path);
    await submissionRef.update({
        gradingStatus: "in_progress",
    });

    if (submission.type == "Self Graded") return;

    const testCaseReq = await axios.get(
        `https://onlinejudge.blob.core.windows.net/test-cases/${submission.judgeProblemId}.zip`,
        { responseType: "arraybuffer" }
    );
    if (!testCaseReq.data) {
        await submissionRef.update({
            gradingStatus: "error",
            errorMessage:
                "Unable to download test data. Is judgeProblemId valid?",
        });
        return;
    }

    const { entries } = await unzip(new Uint8Array(testCaseReq.data));
    const numFiles = Object.keys(entries).length;
    if (numFiles === 0 || numFiles % 2 !== 0) {
        await submissionRef.update({
            gradingStatus: "error",
            errorMessage:
                "Malformed test data. Expected a zip file with 2 files for" +
                " each test case (NUM.in and NUM.out), and at least 1 test case. (Nathan screwed up; go yell at him)",
        });
        return;
    }

    const cases = Array(numFiles / 2)
        .fill(null)
        .map(() => ({
            input: "",
            expectedOutput: "",
        }));

    for (const e of Object.entries(entries)) {
        const [name, entry] = e;
        const value = await entry.text();
        if (name.indexOf(".in") !== -1) {
            cases[parseInt(name.replace(".in", ""), 10) - 1].input = value;
        } else {
            cases[
                parseInt(name.replace(".out", ""), 10) - 1
            ].expectedOutput = value;
        }
    }

    await grade(
        logger,
        cases,
        "Main",
        submission.code,
        submission.language,
        submissionRef
    );
});

submissionQueue.on("completed", function (job) {
    logger.info("Completed Job: " + getJobPath(job));
});

submissionQueue.on("failed", async function (job, error) {
    logger.error("Failed Job: " + getJobPath(job), error);
});
