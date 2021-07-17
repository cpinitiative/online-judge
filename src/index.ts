import express, { NextFunction } from "express";
import { getIsolateVersion, grade } from "./grader";
import https from "https";
import fs from "fs";
import morgan from "morgan";
import path from "path";
import { Language, Submission } from "./utils";
import axios from "axios";
import { unzip } from "unzipit";
import * as admin from "firebase-admin";
import winston from "winston";
import serviceAccountKey from "../serviceAccountKey.json";
import { firestore } from "firebase-admin/lib/firestore";

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

        // maxSize = 10000000 is 10MB
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
const port = 443;
const queue: {
    submission: Submission;
    submissionRef: admin.firestore.DocumentReference;
}[] = [];
let processingQueue = false;
const processQueue = async () => {
    if (processingQueue) return;
    processingQueue = true;
    while (queue.length !== 0) {
        const first:
            | {
                  submission: Submission;
                  submissionRef: admin.firestore.DocumentReference;
              }
            | undefined = queue.shift();

        if (!first) return;
        const { submission, submissionRef } = first;

        await submissionRef.update({
            gradingStatus: "in_progress",
        });

        if (submission.type == "Self Graded") continue;

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
            continue;
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
            continue;
        }

        const cases = Array(numFiles / 2)
            .fill(null)
            .map(() => ({
                input: "",
                expectedOutput: "",
            }));

        // print all entries and their sizes
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

        const result = await grade(
            logger,
            cases,
            "Main",
            submission.code,
            submission.language,
            submissionRef
        );
    }
    processingQueue = false;
};
app.use(express.json());

const server = https.createServer(
    {
        key: fs.readFileSync("sslcert/judge.usaco.guide.key", "utf8"),
        cert: fs.readFileSync("sslcert/judge.usaco.guide.crt", "utf8"),
    },
    app
);

app.use(express.json());
const accessLogStream = fs.createWriteStream(
    path.join(__dirname, "access.log"),
    { flags: "a" }
);

app.use(morgan("combined", { stream: accessLogStream }));
app.use(
    morgan("dev", {
        skip: function (req, res) {
            return res.statusCode < 400;
        },
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
    res.send("Hello World from typescript!");
});

app.get("/isolate", async (req, res) => {
    res.send((await getIsolateVersion()).replace(/\n/g, "<br/>"));
});

app.post("/grade", async function (req, res) {
    // validate shape with yup?
    const params = req.body;
    logger.data("Received new request", req.body);
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

    queue.push({
        submission,
        submissionRef,
    });
    logger.debug("Queue length after current submission: " + queue.length);
    res.json({
        success: true,
        message: "The program has been added to the queue.",
        queuePlace: queue.length,
    });

    processQueue().then(() => {
        /* do nothing */
    });
});

server.listen(port, () => {
    console.log(`Server is now listening for requests on port ${port}.`);
});
