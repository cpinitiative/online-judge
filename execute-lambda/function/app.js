const { exec, execFile, execFileSync } = require('child_process');
const { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync, rmdirSync } = require('fs');

exports.handler = function (event, context, callback) {
  if (event.type === "compile") {
    if (!existsSync('/tmp/out')) mkdirSync('/tmp/out');
    writeFileSync(`/tmp/out/${event.filename}`, event.sourceCode);

    if (!["cpp", "java"].includes(event.language)) {
      callback("Unknown Language");
      return;
    }

    const command = {
      'cpp': "g++",
      'java': "javac",
    }[event.language];

    const compile = execFile(
      command,
      [
        ...event.compilerOptions.split(" "),
        ...(event.language === 'cpp' ? ['-o', '/tmp/out/prog'] : ['-d', 'out']),
        `/tmp/out/${event.filename}`
      ].filter(x => !!x),
      (error, stdout, stderr) => {
        if (error) {
          callback(error);
        }

        writeFileSync("/tmp/out/run.sh", event.language === "cpp" ? "./prog" : "java \"" + event.filename.split(".")[0] + "\"");
        execFileSync('zip', ['-r', '/tmp/out.zip', '-j', '/tmp/out']);

        const base64Output = readFileSync('/tmp/out.zip', { encoding: 'base64' });

        callback(null, {
          status: "success",
          output: base64Output
        });

        unlinkSync('/tmp/out.zip');
        rmdirSync('/tmp/out', { recursive: true });
      }
    );
  } else if (event.type === "execute") {
    if (!existsSync('/tmp/out')) mkdirSync('/tmp/out');
    writeFileSync("/tmp/program.zip", event.payload, "base64");
    writeFileSync("/tmp/input.txt", event.input);
    execFileSync("unzip", ["-o", "/tmp/program.zip", "-d", "/tmp/program"]);
    exec("cd /tmp/program; sh /tmp/program/run.sh < /tmp/input.txt", (error, stdout, stderr) => {
      if (error) {
        callback(error);
      }
      callback(null, {
        status: "success",
        stdout,
        stderr,
      });
      unlinkSync('/tmp/program.zip');
      unlinkSync('/tmp/input.txt');
      rmdirSync('/tmp/program', { recursive: true });
      rmdirSync('/tmp/out', { recursive: true });
    });
  }
}