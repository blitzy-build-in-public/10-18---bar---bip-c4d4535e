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
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;
const LOG_PATH_DELIMITER_PATTERN = /[?#]/;

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
  // The logged field is the request path, so a target that failed to parse is cut at its first
  // '?' or '#': the parsed pathname never carries either, and neither is part of a path.
  const loggedPath = pathname.split(LOG_PATH_DELIMITER_PATTERN, 1)[0];
  // The one-line invariant is kept at the sink rather than inherited from the parser's charset,
  // where a lenient parser or a widened field would break it; for reachable inputs the bytes
  // emitted are unchanged.
  console.log(
    `${new Date().toISOString()} ${escapeControlCharacters(method)} `
    + `${escapeControlCharacters(loggedPath)}`,
  );
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

function escapeControlCharacters(value) {
  return value.replace(CONTROL_CHARACTER_PATTERN, (character) => {
    const characterCode = character.charCodeAt(0);
    return `\\u${characterCode.toString(16).padStart(4, '0')}`;
  });
}

function parsePort(rawPort) {
  if (rawPort === undefined || rawPort === '') {
    return DEFAULT_PORT;
  }
  const port = Number(rawPort);
  if (Number.isInteger(port) && port >= MIN_PORT && port <= MAX_PORT) {
    return port;
  }
  const escapedValue = escapeControlCharacters(rawPort);
  console.error(
    `Error: PORT must be an integer between ${MIN_PORT} and ${MAX_PORT}; received `
    + `"${escapedValue}".`,
  );
  process.exitCode = 1;
  return null;
}

// A stdout write that cannot be delivered (a pipe reader that has exited, a full disk, a closed
// descriptor) is reported as an 'error' event on the stream, and Node rethrows an unhandled one.
// The process would then die with a stack trace and exit status 1, and the SIGINT status 0 would
// stop being deterministic. Consuming the event loses only the line that could not be delivered,
// so the server keeps serving and every exit status stays the one the lifecycle sets.
function handleUndeliverableLogLine() {
  // The sink that could not take the line is the broken one: there is nowhere left to report the
  // loss to, so there is nothing further to do.
}

function startServer() {
  // Registered before the first console write, so a sink failure cannot escape as an uncaught
  // exception.
  process.stdout.on('error', handleUndeliverableLogLine);
  const port = parsePort(process.env.PORT);
  if (port === null) {
    return;
  }
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
    // close() reports a server that never listened through its callback's error argument; a failed
    // bind has already set exit status 1, so the success status is asserted only on a clean close.
    server.close((error) => {
      if (error) {
        return;
      }
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
    process.exitCode = 1;
  });

  process.on('SIGINT', shutdown);

  server.listen(port, onListening);
}

startServer();
