# Node.js Tutorial: Hello World HTTP Server

## 1. Project purpose

This project is a complete HTTP server written directly on Node.js's built-in `http` module — **no framework, no middleware library and no routing library of any kind**, and no packages to install. The entire application is the single file `server.js`, short enough to read from the first line to the last in one sitting.

Frameworks such as Express, Fastify and Koa hide the machinery this server leaves in plain sight. Reading it from top to bottom shows you:

- how `http.createServer()` turns an incoming network connection into a `request` object and a `response` object;
- how a route table maps an HTTP method and a path to the function that answers it, and how every other method-and-path pair falls through to one "not found" answer;
- how the port the server listens on is read from an environment variable;
- how each request is logged, and how the process shuts down cleanly when you press `CTRL+C`.

## 2. Prerequisites

- **Node.js v18.0.0 or newer.** Check which version you have:

```bash
node --version
```

The output looks like `v22.23.3`; the first number must be `18` or higher.

- **Nothing else.** No packages to install, no build step, no database, no configuration file, and no other tool.

The requirement is also declared in `package.json` under `"engines": { "node": ">=18.0.0" }`. npm treats that field as advisory, so the version check above is the one that matters.

## 3. Installation

None is required beyond Node.js. This project has no dependencies, so there is nothing to download and nothing to build — do not run `npm install`. The project folder holds three files: `server.js` (the whole application), `package.json` (project metadata) and this README. Open a terminal in that folder and go on to the next section.

## 4. Execution

Start the server from a terminal open in the project folder:

```bash
node server.js
```

```text
Server listening on port 3000
```

The command keeps running in the foreground — that is the server at work. A *port* is the numbered channel on your machine that the server listens on; `3000` is the default. Leave this terminal as it is, because it is busy running the server and prints a line for every request it handles. Open a second terminal for the requests in section 5.

You can start the same server through npm instead:

```bash
npm start
```

```text

> nodejs-tutorial-hello-world@1.0.0 start
> node server.js

Server listening on port 3000
```

The two `>` lines are npm's own banner, printed before the server starts. Depending on your npm version, npm may also print a short `npm notice` block when the command ends; that block is npm's message about npm itself, not output from the server.

A third form starts the very same file:

```bash
node .
```

Node reads the `"main": "server.js"` field in `package.json` and runs `server.js`, so the output is identical to `node server.js`.

To listen on a different port, set the `PORT` environment variable for the command; section 8 covers that in full.

```bash
PORT=8080 node server.js
```

```text
Server listening on port 8080
```

## 5. Testing the server

With the server running in one terminal, send requests from a second terminal. The examples use `curl`, a command-line HTTP client that is included with macOS and with current Windows builds.

Ask for the one route the server implements:

```bash
curl http://localhost:3000/hello
```

```text
Hello world
```

`Hello world` is the response *body*. It is written without a trailing newline, so your shell prompt appears on the same line as the text.

Add `-i` to print the complete HTTP response — the status line, the headers and the body:

```bash
curl -i http://localhost:3000/hello
```

```text
HTTP/1.1 200 OK
Content-Type: text/plain
Date: Sun, 18 Oct 2026 12:53:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Content-Length: 11

Hello world
```

Reading that response, line by line:

- the status line gives the HTTP version, a three-digit *status code* and its meaning in words — `200` is "OK", so the request succeeded;
- *headers* are the `name: value` pairs that carry metadata about the response, and they end at the blank line;
- `Content-Type: text/plain` says the body is plain text rather than HTML or JSON;
- `Content-Length: 11` says the body is 11 bytes long;
- `Date`, `Connection` and `Keep-Alive` are added by Node.js itself. The `Date` value is the current time on the server; Node refreshes it about once a second and reuses it in between, so requests sent in quick succession carry the same value.

Ask for a path that does not exist:

```bash
curl -i http://localhost:3000/invalid
```

```text
HTTP/1.1 404 Not Found
Content-Type: text/plain
Date: Sun, 18 Oct 2026 12:53:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Content-Length: 9

Not Found
```

`404` means the server has no route for the method-and-path pair that was requested.

Now use a method other than `GET` on the one path that does exist:

```bash
curl -i -X POST http://localhost:3000/hello
```

```text
HTTP/1.1 404 Not Found
Content-Type: text/plain
Date: Sun, 18 Oct 2026 12:53:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Content-Length: 9

Not Found
```

This answers `404`, not `405 Method Not Allowed`, and the response carries no `Allow` header. The route key is the method together with the path, so an unsupported method is treated exactly like an unknown path.

One detail of that comparison is worth knowing before you experiment. The path the server matches against the route key is the path Node.js's `URL` parser reads out of the request target, and that comparison is exact and case-sensitive, so `/hello` answers `200` while `/hello/`, `/HELLO` and `/` answer `404`. A query string is not part of the path, so `/hello?name=ada` still matches the route and answers `200`. The parser also removes `.` and `..` path segments before the comparison, so `/foo/../hello` and `/./hello` match `/hello` and answer `200` — and because `curl` removes those segments itself before the request leaves your machine, checking that needs `curl --path-as-is`.

Watch the first terminal while you send these requests: every request it handles is logged there as it arrives, including the ones that end in `404`. Section 6 shows those lines.

## 6. Expected output examples

The server terminal — the startup line, one log line per request, then the shutdown line after `CTRL+C`:

```text
Server listening on port 3000
2026-10-18T12:53:35.766Z GET /hello
2026-10-18T12:53:35.780Z GET /invalid
2026-10-18T12:53:35.786Z POST /hello
Shutting down server
```

Each request line has three parts: an ISO-8601 timestamp in UTC with millisecond precision (`2026-10-18T12:53:35.766Z`, where the trailing `Z` means UTC), the HTTP method, and the request path. The line is written before routing takes place, so a request that ends in `404` is logged just as a matched route is.

The complete response to `GET /hello`:

```text
HTTP/1.1 200 OK
Content-Type: text/plain
Date: Sun, 18 Oct 2026 12:53:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Content-Length: 11

Hello world
```

The complete response to any other method-and-path pair, here `GET /invalid`:

```text
HTTP/1.1 404 Not Found
Content-Type: text/plain
Date: Sun, 18 Oct 2026 12:53:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Content-Length: 9

Not Found
```

After `CTRL+C`, the server prints one last line and stops:

```text
Shutting down server
```

## 7. Shutdown instructions

Press `CTRL+C` in the terminal where the server is running. That key combination is the same on macOS, Linux and Windows. The server prints:

```text
Shutting down server
```

It then closes its connections, releases the port and exits with status code `0` — the number a program returns to the shell to mean it finished successfully. If you started it with `npm start`, the message is identical, but the status your shell reports is npm's rather than the server's, and npm reports `130` for a command it is interrupted with.

## 8. Environment variable configuration

The server reads one environment variable, `PORT`:

| `PORT` setting | What the server does |
| --- | --- |
| not set at all | listens on `3000` |
| set to an empty string | listens on `3000` |
| set to an integer from `1024` to `65535` | listens on that port |
| set to anything else | refuses to start |

To listen on port 8080 instead of the default:

```bash
PORT=8080 node server.js
```

```text
Server listening on port 8080
```

That form works in bash and similar shells on macOS and Linux. Windows PowerShell sets the variable first instead: `$env:PORT=8080; node server.js`.

If the value is not an integer inside `1024`–`65535`, the server refuses to start, writes one line to standard error and exits with status code `1`:

```bash
PORT=abc node server.js
```

```text
Error: PORT must be an integer between 1024 and 65535; received "abc".
```

The same message appears for `PORT=99`, `PORT=1023`, `PORT=3000.5`, `PORT=3000abc` and `PORT=65536`, each quoting the value it received. Ports below `1024` are privileged ports reserved for system services, and the server refuses them by design, so it never binds one without explicit configuration.

## Troubleshooting

### `Error: port 3105 is already in use. Stop the process bound to it or start the server with a different PORT.`

**Cause:** something else already holds the port the server tried to bind — most often an earlier copy of this server that is still running. The number in the message is the port that was requested.

**Fix:** stop the process holding the port, or start this one on a different port. On macOS and Linux, `lsof -i :3105` lists what holds a given port.

### `Error: PORT must be an integer between 1024 and 65535; received "abc".`

**Cause:** the `PORT` value is not an integer inside the accepted range; the message quotes the value it received. A port below `1024` is refused as well, because those privileged ports are reserved for system services.

**Fix:** set `PORT` to an integer from `1024` to `65535`, for example `PORT=8080 node server.js`.
