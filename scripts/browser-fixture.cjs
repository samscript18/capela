const http = require("node:http");
const esbuild = require("esbuild");
async function main() {
  const bundle = await esbuild.build({
    entryPoints: ["tests/browser/fixture.tsx"],
    bundle: true,
    write: false,
    platform: "browser",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"test"' },
  });
  http
    .createServer((req, res) => {
      if (req.url === "/bundle.js") {
        res.setHeader("Content-Type", "text/javascript");
        res.end(bundle.outputFiles[0].text);
        return;
      }
      if (req.url !== "/") {
        res.writeHead(404);
        res.end();
        return;
      }
      res.setHeader("Content-Type", "text/html");
      res.end(
        `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Capela fixture checks</title><style>body{background:#080a08;color:#e8eddf;font-family:system-ui;line-height:1.6;margin:24px}main{max-width:960px;margin:auto}button,summary{cursor:pointer;padding:12px}button{background:#9fad7c;color:#10140d;border:1px solid #788274;border-radius:18px;margin:4px}details,section{border:1px solid #788274;border-radius:18px;padding:20px;margin-top:16px}blockquote{border-left:2px solid #9fad7c;padding:16px}pre{white-space:pre-wrap;overflow-wrap:anywhere}dd{margin:0}dt{color:#b8c1b2}a{color:#c8d1aa}*:focus-visible{outline:3px solid #c8d1aa}</style><div id="root"></div><script src="/bundle.js"></script></html>`,
      );
    })
    .listen(4178, "127.0.0.1", () => console.log("Isolated fixture http://127.0.0.1:4178"));
}
main().catch(() => {
  console.error("Fixture build failed");
  process.exitCode = 1;
});
