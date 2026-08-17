---
layout: tutorial
title: "chat -- private chat on your own hardware"
description: "Self-hosted chat via Open WebUI, backed entirely by a Marigold-served instruct model. No cloud dependency."
canonical: "https://marigold.run/examples/chat.html"
og_title: "chat -- Marigold example"
og_description: "Private chat, self-hosted, backed by an open-weight instruct model."
category: Examples
---

Private chat via Open WebUI, backed by a self-hosted instruct model.

## Run

```bash
marigold deployment start marigold-examples/chat
```

Open `http://localhost:3000`. Chat with the model using
[Open WebUI](https://docs.openwebui.com/).

## Models

- `qwen/qwen3-8b` -- instruct

## Stop

```bash
marigold deployment stop marigold-examples/chat
```
