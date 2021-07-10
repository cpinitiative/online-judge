// validate shape with yup?
import axios from "axios";
import { unzip } from "unzipit";
import * as fs from "fs";
(async () => {
    const params = {
        code:
            "nums = list(sorted(map(int,input().split())))\na,b = nums[0],nums[1]\nc = nums[-1]-a-b\nprint(a,b,c)",
        language: "python",
        id: "usaco-1059",
    };

    if (!params || !params.code || !params.id) {
        console.log("Error: no body");
    }

    const testCaseReq = await axios.get(
        `https://onlinejudge.blob.core.windows.net/test-cases/${params.id}.zip`,
        { responseType: "arraybuffer" }
    );
    if (!testCaseReq.data) {
        console.log("Error: unable to download test data");
    }

    fs.writeFile("zip.zip", testCaseReq.data, () => console.log("hi"));

    const { entries } = await unzip(new Uint8Array(testCaseReq.data));
    const numFiles = Object.keys(entries).length;
    if (numFiles % 2 !== 0) {
        console.log("Error: Unexpected test data. Nathan was wrong.");
        return;
    }

    const cases = Array(numFiles / 2)
        .fill(null)
        .map(() => ({
            input: "",
            expectedOutput: "",
        }));
    console.log(numFiles, cases);

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
    console.log(cases);
})();
