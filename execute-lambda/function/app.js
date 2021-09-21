const { execFile, execFileSync } = require('child_process');
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
        execFileSync('zip', ['-r', '/tmp/out.zip', '/tmp/out']);

        const base64Output = readFileSync('/tmp/out.zip', { encoding: 'base64' });

        callback(null, {
          status: "success",
          output: base64Output
        });

        unlinkSync(`/tmp/out/${event.filename}`);
        unlinkSync('/tmp/out.zip');
        rmdirSync('/tmp/out', { recursive: true });
      }
    );
  }
}