// Servidor estático mínimo para conferir o export (out/) localmente: node scripts/serve.mjs [porta]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve("out");
const port = Number(process.argv[2] || 5201);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".avif": "image/avif", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".mp4": "video/mp4", ".webm": "video/webm", ".woff2": "font/woff2", ".woff": "font/woff", ".pdf": "application/pdf", ".txt": "text/plain", ".glb": "model/gltf-binary", ".md": "text/markdown; charset=utf-8", ".hdr": "image/vnd.radiance" };
http
  .createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let f = path.join(root, p);
    if (!f.startsWith(root)) return res.writeHead(403).end();
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
    if (!fs.existsSync(f)) {
      f = path.join(root, "404.html");
      res.statusCode = 404;
    }
    const stat = fs.statSync(f);
    const type = types[path.extname(f)] || "application/octet-stream";
    const range = req.headers.range;
    if (range && /^bytes=/.test(range)) {
      const [s, e] = range.replace("bytes=", "").split("-");
      const start = Number(s);
      const end = e ? Number(e) : stat.size - 1;
      res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Accept-Ranges": "bytes", "Content-Length": end - start + 1 });
      return fs.createReadStream(f, { start, end }).pipe(res);
    }
    res.writeHead(res.statusCode || 200, { "Content-Type": type, "Content-Length": stat.size, "Accept-Ranges": "bytes" });
    fs.createReadStream(f).pipe(res);
  })
  .listen(port, () => console.log(`serving out/ on http://localhost:${port}`));
