'use strict';

const http = require('node:http');
const process = require('node:process');
const { URL } = require('node:url');

const DEFAULT_PORT = 3000;
const MIN_PORT = 1024;
const MAX_PORT = 65535;
const CONTENT_TYPE = 'text/plain';
const BODY_HELLO = 'Hello world';
const BODY_NOT_FOUND = 'Not Found';
const PARSE_BASE_URL = 'http://localhost';
const SHUTDOWN_MESSAGE = 'Shutting down server';

function sendText(response, statusCode, body) {
  // statusCode and setHeader let Node derive Content-Length from the single end() write;
  // writeHead() would serialise the header block first and force chunked framing instead.
  response.statusCode = statusCode;
  response.setHeader('Content-Type', CONTENT_TYPE);
  response.end(body);
}

function handleHello(request, response) {
  sendText(response, 200, BODY_HELLO);
}

function handleNotFound(request, response) {
  sendText(response, 404, BODY_NOT_FOUND);
}

const ROUTES = new Map([['GET /hello', handleHello]]);

function resolvePathname(requestTarget) {
  // An unparseable target such as 'http://[' raises ERR_INVALID_URL, which would end the process
  // if it escaped the request handler, so it falls back to the raw target as an unmatched route.
  try {
    return new URL(requestTarget, PARSE_BASE_URL).pathname;
  } catch {
    return requestTarget;
  }
}

function logRequest(method, pathname) {
  console.log(`${new Date().toISOString()} ${method} ${pathname}`);
}

function handleRequest(request, response) {
  const pathname = resolvePathname(request.url);
  logRequest(request.method, pathname);
  const handler = ROUTES.get(`${request.method} ${pathname}`);
  if (handler) {
    handler(request, response);
    return;
  }
  handleNotFound(request, response);
}

function parsePort(rawPort) {
  if (rawPort === undefined || rawPort === '') {
    return DEFAULT_PORT;
  }
  const port = Number(rawPort);
  if (Number.isInteger(port) && port >= MIN_PORT && port <= MAX_PORT) {
    return port;
  }
  console.error(
    `Error: PORT must be an integer between ${MIN_PORT} and ${MAX_PORT}; received "${rawPort}".`,
  );
  process.exit(1);
}

function startServer() {
  const port = parsePort(process.env.PORT);
  const server = http.createServer(handleRequest);

  function onListening() {
    console.log(`Server listening on port ${port}`);
  }

  // A repeated CTRL+C must not re-enter this shutdown: the first interrupt prints the
  // message, releases connections and starts the close that sets the exit status.
  let isShuttingDown = false;

  function shutdown() {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;
    console.log(SHUTDOWN_MESSAGE);
    // closeAllConnections() was added in Node.js 18.2.0, above the declared >=18.0.0 floor, so it
    // is called only where the running runtime provides it.
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    server.close(() => {
      process.exitCode = 0;
    });
  }

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      const message = `Error: port ${port} is already in use. Stop the process bound to it `
        + `or start the server with a different PORT.`;
      console.error(message);
    } else {
      console.error(`Error: server failed to start: ${error.code} - ${error.message}`);
    }
    process.exit(1);
  });

  process.on('SIGINT', shutdown);

  server.listen(port, onListening);
}

startServer();
