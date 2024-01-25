import http from "http";
import net from "net";
// Create an HTTP tunneling proxy
const proxy = http.createServer((req, res) => {
  //res.writeHead(200, { "Content-Type": "text/plain", "Proxy-agent": "NodeJS" });
  //res.end(`received a request ${req.url}`);
});

proxy.on("request", (req, res) => {
  const url = new URL(req.url);
  const options = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    method: req.method,
    headers: req.headers,
  };

  console.log(`Sending request to ${url.href}`);
  // Create a request to the target server
  const serverReq = http.request(options, (serverRes) => {
    console.log(`Received response from ${url.href}`);
    // Add the custom header
    //res.setHeader("Proxy-agent", "Node.js-Proxy");
    // Write the response headers
    res.writeHead(serverRes.statusCode, serverRes.headers);

    // Pipe the server response to the client response
    serverRes.pipe(res);
  });

  // Pipe the client request to the server request
  req.pipe(serverReq);

  // Handle errors
  serverReq.on("error", (err) => {
    console.error(`Error occurred on server request: ${err.message}`);
    res.writeHead(500);
    res.end(`Error occurred: ${err.message}`);
  });

  serverReq.on("uncaughtException", (err) => {
    console.error("There was an uncaught error", err);
    process.exit(1); //mandatory (as per the Node.js docs)
  });
});

proxy.on("connect", (req, clientSocket, head) => {
  // Check if the URL is empty
  if (!req.url || req.url === "/") {
    clientSocket.write(
      "HTTP/1.1 400 Bad Request\r\n" +
        "Proxy-agent: Node.js-Proxy\r\n" +
        "\r\n",
    );
    clientSocket.end();
    return;
  }

  // Connect to an origin server
  const { port, hostname } = new URL(`http://${req.url}`);
  const serverSocket = net.connect(port || 80, hostname, () => {
    clientSocket.write(
      "HTTP/1.1 200 Connection Established\r\n" +
        "Proxy-agent: Node.js-Proxy\r\n" +
        "\r\n",
    );
    serverSocket.write(head);
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);
  });

  // Handle errors on the client socket
  clientSocket.on("error", (err) => {
    console.error(`Error occurred on client socket: ${err.message}`);
  });

  // Handle errors on the server socket
  serverSocket.on("error", (err) => {
    console.error(`Error occurred on server socket: ${err.message}`);
  });
});

// Now that proxy is running
proxy.listen(1337, "127.0.0.1", () => {
  console.log("Proxy server is running on http://127.0.0.1:1337");
});
