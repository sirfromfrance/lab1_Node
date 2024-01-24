"use strict";

import * as http from "node:http";
import * as net from "node:net";

const CRLF = "\r\n";
const PORT = 8080;
const DEFAULT_HTTP_PORT = 80;

const receiveBody = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);

  return Buffer.concat(chunks);
};

const server = http.createServer(async (req, res) => {
  console.log("\nRequest received (HTTP)");

  const { remoteAddress, remotePort } = req.socket;

  console.log(`Connection from ${remoteAddress}:${remotePort} to ${req.url}`);

  const { headers, url, method } = req;
  const { pathname, hostname } = new URL(url.substring(1)); //REMOVE '/';
  const options = new URL(url.substring(1));
  options.method = method;
  options.headers = headers;
  options.headers.host = hostname; // Set the Host header
  // const options = { hostname, path: pathname, method, headers, };
  const request = http.request(options, (result) => void result.pipe(res));

  if (method !== "GET" && method !== "HEAD") {
    const body = await receiveBody(req);
    request.write(body);
  }

  request.end();
});

server.on("connect", (req, socket, head) => {
  console.log("\nRequest received (HTTPS)");

  socket.write("HTTP/1.1 200 Connection Established" + CRLF + CRLF);

  const { remoteAddress, remotePort } = socket;

  const { hostname, port } = new URL(`http://${req.url}`);

  const targetPort = parseInt(port, 10) || DEFAULT_HTTP_PORT;

  const proxy = net.connect(targetPort, hostname, () => {
    if (head) proxy.write(head);
    socket.pipe(proxy).pipe(socket);
  });

  console.log(
    `Connection from ${remoteAddress}:${remotePort} to ${hostname}:${targetPort}`,
  );

  proxy.on("error", (err) => {
    console.error(`Proxy connection error: ${err.message}\n`);

    socket.end();
  });

  socket.on("error", (err) => {
    console.error(`Socket error: ${err.message}\n`);

    proxy.end();
  });

  socket.on("end", () => {
    console.log(`Connection from ${remoteAddress}:${remotePort} closed\n`);

    proxy.end();
  });
});

console.log(`Starting HTTP proxy server on port ${PORT}...`);

server.listen(PORT);
process.on("SIGTERM", () => {
  server.close((error) => {
    if (error) {
      console.log(error);
      process.exit(1);
    }
  });
});
