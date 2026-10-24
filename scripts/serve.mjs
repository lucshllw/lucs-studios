// Servidor estático mínimo para o export (out/). Uso: node scripts/serve.mjs out 4318
// v5: gzip para texto (html/js/css/svg/json/xml/txt), como numa CDN — medições de Lighthouse locais comparáveis.
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { createGzip } from "node:zlib";

const root = resolve(process.argv[2] ?? "out");
const port = Number(process.argv[3] ?? 4318);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".xml": "application/xml",
  ".jpg": "image/jpeg",
  ".webm": "video/webm",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
};

createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
  let p = normalize(join(root, url));
  if (!p.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, "index.html");
  if (!existsSync(p) && existsSync(p + ".html")) p += ".html";
  if (!existsSync(p)) {
    res.writeHead(404).end("404");
    return;
  }
  const size = statSync(p).size;
  const type = types[extname(p)] ?? "application/octet-stream";
  const range = req.headers.range;
  if (range) {
    const [a, b] = range.replace("bytes=", "").split("-");
    const start = Number(a);
    const end = b ? Number(b) : size - 1;
    res.writeHead(206, {
      "Content-Type": type,
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": end - start + 1,
    });
    createReadStream(p, { start, end }).pipe(res);
    return;
  }
  const text = /^(text[/]|application[/](json|xml)|image[/]svg)/.test(type);
  if (text && String(req.headers["accept-encoding"] ?? "").includes("gzip")) {
    res.writeHead(200, { "Content-Type": type, "Content-Encoding": "gzip", Vary: "Accept-Encoding" });
    createReadStream(p).pipe(createGzip()).pipe(res);
    return;
  }
  res.writeHead(200, { "Content-Type": type, "Content-Length": size, "Accept-Ranges": "bytes" });
  createReadStream(p).pipe(res);
}).listen(port, "127.0.0.1", () => console.log(`Portfólio Lucas Melo em http://127.0.0.1:${port}`));
