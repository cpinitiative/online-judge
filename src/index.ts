import { NextFunction, RequestHandler } from "express";
import express from "express";
import { getIsolateVersion, grade } from "./grader";
import https from "https";
import fs from "fs";
import morgan from "morgan";
import path from "path";
import { GradeResult, Language, Submission } from "./utils";
import axios from "axios";
import { unzip } from "unzipit";
import * as admin from "firebase-admin";

import serviceAccountKey from "../serviceAccountKey.json";
import { firestore } from "firebase-admin/lib/firestore";
import Timestamp = firestore.Timestamp;

admin.initializeApp({
    credential: admin.credential.cert(serviceAccountKey),
    databaseURL: "https://usaco-guide.firebaseio.com",
});

const app = express();
const port = 443;

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

    if (!["python", "cpp", "java"].includes(submission.language)) {
        res.send(
            "Error: unsupported language. You must specify python, java, or cpp"
        );
    }
    const testCaseReq = await axios.get(
        `https://onlinejudge.blob.core.windows.net/test-cases/${submission.judgeProblemId}.zip`,
        { responseType: "arraybuffer" }
    );
    if (!testCaseReq.data) {
        res.send("Error: unable to download test data");
        return;
    }

    const { entries } = await unzip(new Uint8Array(testCaseReq.data));
    const numFiles = Object.keys(entries).length;
    if (numFiles % 2 !== 0) {
        res.send("Error: Unexpected test data. Nathan was wrong.");
        return;
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

    res.json({
        success: true,
        message: "The program has been added to the queue.",
        queuePlace: 0,
    });

    const result = await grade(
        cases,
        "test",
        submission.code,
        submission.language,
        submissionRef
    );
});

server.listen(port, () => {
    console.log(`Server is now listening for requests on port ${port}.`);
});
