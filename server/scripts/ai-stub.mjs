import http from "node:http";

const port = Number(process.env.AI_STUB_PORT || 8799);

/** Controllable OpenAI-compatible stand-in. It records aborts and always sets a JSON body. */
const server = http.createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("ok");
    return;
  }

  const chunks = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", () => {
    let maxTokens = 0;
    let slow = false;
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
      maxTokens = Number(body.max_tokens || 0);
      slow = JSON.stringify(body.messages ?? "").includes("SLOW_DRAFT");
    } catch {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "invalid json" }));
      return;
    }
    if (!maxTokens) {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "max_tokens required" }));
      return;
    }
    const send = () => {
      if (response.writableEnded || response.destroyed) return;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          choices: [{ message: { content: "桩草稿 [你的看法]" } }],
          usage: { prompt_tokens: 12, completion_tokens: 6 },
        }),
      );
    };
    if (slow) setTimeout(send, 1500);
    else send();
  });
});

server.listen(port, "127.0.0.1");
