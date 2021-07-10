import { NextFunction, RequestHandler } from "express";
import express from "express";
import { getIsolateVersion, grade } from "./grader";
import https from "https";
import fs from "fs";
import morgan from "morgan";
import path from "path";
import { Language } from "./utils";
import axios from "axios";
import AdmZip from "adm-zip";

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

    if (!params || !params.code || !params.id) {
        res.send("Error: no body");
        return;
    }
    const testCaseReq = await axios.get(
        `https://onlinejudge.blob.core.windows.net/test-cases/${params.id}.zip`
    );

    const zip = new AdmZip(testCaseReq.data);
    const files = zip.getEntries().map((zipEntry) => ({
        name: zipEntry.entryName,
        value: zip.readAsText(zipEntry.entryName),
    }));
    if (files.length % 2 !== 0) {
        res.send("Error: Unexpected test data. Nathan was wrong.");
        return;
    }
    const cases = Array(files.length / 2).map(() => ({
        input: "",
        expectedOutput: "",
    }));
    files.forEach(({ name, value }) => {
        if (name.indexOf(".in") !== -1) {
            cases[parseInt(name.replace(".in", ""), 10)].input = value;
        } else {
            cases[parseInt(name.replace(".in", ""), 10)].expectedOutput = value;
        }
    });
    const result = await grade(cases, "test", req.body.code, params.language);
    res.json(result);
});

server.listen(port, () => {
    console.log(`Server is now listening for requests on port ${port}.`);
});
