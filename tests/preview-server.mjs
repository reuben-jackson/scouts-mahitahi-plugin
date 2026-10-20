import http from "node:http";
import { readFile } from "node:fs/promises";
const files = new Map([
    ["/s/reports", ["invoice-preview.html", "text/html"]],
    ["/src/styles.css", ["../src/styles.css", "text/css"]],
    ["/src/invoice-export.js", ["../src/invoice-export.js", "text/javascript"]],
    ["/src/invoice-ui.js", ["../src/invoice-ui.js", "text/javascript"]]
]);
http.createServer(async (req, res) => {
    const file = files.get(req.url);
    if (!file) { res.writeHead(404).end(); return; }
    try {
        const data = await readFile(new URL(file[0], import.meta.url));
        res.writeHead(200, {"Content-Type": file[1] + "; charset=utf-8", "Cache-Control": "no-store"}).end(data);
    } catch { res.writeHead(500).end(); }
}).listen(8766, "127.0.0.1", () => console.log("Fake-data converter preview: http://127.0.0.1:8766/s/reports"));
