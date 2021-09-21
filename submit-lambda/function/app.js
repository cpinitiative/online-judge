const { execFile, execFileSync } = require('child_process');
const { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync, rmdirSync } = require('fs');

exports.handler = function (event, context, callback) {
  writeFileSync(event.filename, event.sourceCode);
  if (!existsSync('out')) mkdirSync('out');

  if (!["cpp", "java", "py"].includes(event.language)) {
    callback("Unknown Language");
    return;
  }

  if (event.language === "py") {

  } else {
    const command = {
      'cpp': "g++",
      'java': "javac",
    }[event.language];

    const compile = execFile(
      command,
      [
        ...event.compilerOptions.split(" "),
        ...(event.language === 'c++' ? ['-o', 'out/prog'] : ['-d', 'out']),
        event.filename
      ].filter(x => !!x),
      (error, stdout, stderr) => {
        if (error) {
          callback(error);
        }

        execFileSync('zip', ['-r', 'out.zip', 'out']);

        const base64Output = readFileSync('out.zip', { encoding: 'base64' });

        callback(base64Output);

        unlinkSync(event.filename);
        unlinkSync('out.zip');
        rmdirSync('out', { recursive: true });
      }
    );
  }
}