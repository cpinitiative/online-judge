import { NextFunction, RequestHandler } from "express";
import express from "express";
import { getIsolateVersion, grade } from "./grader";
import https from "https";
import fs from "fs";
import morgan from "morgan";
import path from "path";

const app = express();
const port = 8000; //443; (TODO switch back to 443)

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
    const result = await grade(
        req.body?.code ||
            "#!/usr/bin/env python3\n\n" + 'print("Hello world!")',
        {
            language: "python",
        }
    );
    res.json(result);
});

server.listen(port, () => {
    console.log(`Server is now listening for requests on port ${port}.`);
});
