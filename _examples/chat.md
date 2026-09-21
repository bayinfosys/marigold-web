---
layout: tutorial
title: "chat -- private chat on your own hardware"
description: "Self-hosted chat via Open WebUI, backed entirely by a Marigold-served instruct model. No cloud dependency."
canonical: "https://marigold.run/examples/chat.html"
og_title: "chat -- Marigold example"
og_description: "Private chat, self-hosted, backed by an open-weight instruct model."
category: Examples
---

Private chat through Open WebUI, backed by a self-hosted instruct
model. This assumes the [setup guide](/tutorials/setup.html) is done.

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

To change it, see [adding a new model](/tutorials/adding-a-model.html).

## Stop

```bash
marigold application stop chat          # the application container
marigold platform stop --applications   # everything, Open WebUI included
```

Open WebUI runs with the platform, so stopping the application leaves
it running.
