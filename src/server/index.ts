import express, { NextFunction } from "express";
import https from "https";
import fs from "fs";
import morgan from "morgan";
import { Language, Submission, SubmissionQueueItem } from "../utils";
import * as admin from "firebase-admin";
import winston from "winston";
import Bull from "bull";
import * as dotenv from "dotenv";
dotenv.config({ path: __dirname + "/.env" });

const args = process.argv.slice(2);
const port = args.length > 0 ? args[0] : 443;

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
            filename: "logs/server-error.log",
            level: "warning",
            maxsize: 10000000,
        }),
        new winston.transports.File({
            filename: "logs/server.log",
            maxsize: 10000000,
        }),
    ],
});

const app = express();

const submissionQueue = new Bull<SubmissionQueueItem>("submission_queue", {
    redis: {
        host: "judgedb.usaco.guide",
        password: process.env.REDIS_PASSWORD,
    },
});

app.use(express.json());

const index = https.createServer(
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
        logger.error(
            `Received unknown language "${submission.language}". Inferred language 'python', but this should be changed in the future.`
        );
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

index.listen(port, () => {
    console.log(`Server is now listening for requests on port ${port}.`);
});
