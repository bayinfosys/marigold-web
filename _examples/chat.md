---
title: "chat -- private chat on your own hardware"
description: "Self-hosted chat via Open WebUI, backed entirely by a Marigold-served instruct model. No cloud dependency."
og_description: "Private chat, self-hosted, backed by an open-weight instruct model."
category: Examples
last_modified_at: 2026-10-01
related: [setup, local-rag, cursor-local-model]
---

Private chat on your own hardware: Marigold as the Open WebUI backend,
serving a self-hosted instruct model. This assumes the
[setup guide](/tutorials/setup.html) is done.

## Run

```bash
marigold package create marigold-examples/chat -o /tmp
marigold package install /tmp/chat-<version>.tar.gz
marigold cache populate chat
marigold application start chat
```

Open `http://localhost:3000` and chat with the model using
[Open WebUI](https://docs.openwebui.com/).

The package lists `webui` in its `compose_files`, so starting it adds
Open WebUI to the platform, as a client of the API. The package's
application checks that its model is in the catalogue and exits;
`marigold application status chat` shows exit code 0 when it is.

Open WebUI lists every model in the catalogue, including models cached
for other packages.

## Models

- `qwen/qwen3-8b` -- instruct

This package runs Qwen locally out of the box. To change the model, see
[adding a new model](/tutorials/adding-a-model.html).

## From your own code

Open WebUI reaches the model through Marigold's OpenAI-compatible
endpoints. Any OpenAI SDK client can do the same at
`http://localhost:8000/v1`; the
[setup guide](/tutorials/setup.html#call-it-from-your-own-code) has a
Python example, and
[Cursor and VS Code](/tutorials/cursor-local-model.html) covers editors.

## Stop

```bash
marigold application stop chat          # the application container
marigold platform stop --applications   # everything, Open WebUI included
```

Open WebUI runs with the platform, so stopping the application leaves
it running.
