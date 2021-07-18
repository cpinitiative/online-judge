import express, { NextFunction } from "express";
import { getIsolateVersion, grade } from "./grader";
import https from "https";
import fs from "fs";
import morgan from "morgan";
import { getJobPath, Language, Submission, SubmissionQueueItem } from "./utils";
import axios from "axios";
import { unzip } from "unzipit";
import * as admin from "firebase-admin";
import winston from "winston";
import serviceAccountKey from "../serviceAccountKey.json";
import Bull from "bull";

const args = process.argv.slice(2);
const port = args.length > 0 ? args[0] : 443;

admin.initializeApp({
    credential: admin.credential.cert(serviceAccountKey),
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
            filename: "error.log",
            level: "warning",
            maxsize: 10000000,
        }),
        new winston.transports.File({
            filename: "combined.log",
            maxsize: 10000000,
        }),
    ],
});

const app = express();

const submissionQueue = new Bull<SubmissionQueueItem>("submission_queue");
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

app.use(express.json());

const server = https.createServer(
    {
        key: fs.readFileSync("sslcert/judge.usaco.guide.key", "utf8"),
        cert: fs.readFileSync("sslcert/judge.usaco.guide.crt", "utf8"),
    },
    app
);

app.use(express.json());

app.use(
    morgan("combined", {
        stream: { write: (message) => logger.info(message.trim()) },
    })
);

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
app.use((error: any, req: Request, res: Response, next: NextFunction) => {
    // Will get here
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    res.json({ status: error.statusCode, message: error.message });
});

app.get("/", (req, res) => {
    res.send(
        "Welcome to judge.usaco.guide. This is a server. Humans aren't allowed here!"
    );
});

app.get("/isolate", async (req, res) => {
    res.send((await getIsolateVersion()).replace(/\n/g, "<br/>"));
});

app.get("/status", async (req, res) => {
    const jobCounts = await submissionQueue.getJobCounts();
    res.json({
        ok: true,
        queue: jobCounts,
    });
});

app.post("/grade", async function (req, res) {
    // validate shape with yup?
    const params = req.body;
    logger.debug("Received new request", req.body);
    if (
        !params ||
        !params.groupId ||
        !params.postId ||
        !params.problemId ||
        !params.submissionId
    ) {
        res.json({
            success: false,
            errorCode: "INVALID_PARAMETERS",
            errorMessage:
                "Invalid POST parameters. Expected groupId, postId, problemId, and submissionId",
        });
        return;
    }
    const submissionRef = admin
        .firestore()
        .collection("groups")
        .doc(params.groupId)
        .collection("posts")
        .doc(params.postId)
        .collection("problems")
        .doc(params.problemId)
        .collection("submissions")
        .doc(params.submissionId);
    const submissionDoc = await submissionRef.get();
    const submission: Submission = submissionDoc.data() as Submission;
    if (!submission) {
        res.json({
            success: false,
            errorCode: "SUBMISSION_NOT_FOUND",
            errorMessage: "Submission not found.",
        });
        return;
    }

    if (submission.type !== "Online Judge") {
        res.json({
            success: false,
            errorCode: "INVALID_SUBMISSION_TYPE",
            errorMessage: "The submission must be of type Online Judge.",
        });
        return;
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (submission.language === "py") {
        submission.language = Language.PYTHON;
    }
    if (!["python", "cpp", "java"].includes(submission.language)) {
        res.send({
            success: false,
            errorCode: "UNKNOWN_LANGUAGE",
            errorMessage:
                "unsupported language. You must specify python, java, or cpp",
        });
        return;
    }

    await submissionQueue.add({
        groupId: params.groupId,
        postId: params.postId,
        problemId: params.problemId,
        submissionId: params.submissionId,
    });

    const jobCounts = await submissionQueue.getJobCounts();
    logger.debug("Queue counts: ", jobCounts);
    console.log(
        "Queue length including current submission: " +
            JSON.stringify(jobCounts)
    );
    res.json({
        success: true,
        message: "The program has been added to the queue.",
        queuePlace: jobCounts.waiting,
    });
});

server.listen(port, () => {
    console.log(`Server is now listening for requests on port ${port}.`);
});
