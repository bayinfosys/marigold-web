---
title: "Cursor Local Model: Connect a Self-Hosted LLM"
description: "Use a self-hosted Marigold model in Cursor through its OpenAI base URL override: the tunnel it needs, which features use it, and a VS Code route that stays on your machine."
date: 2026-10-01
last_modified_at: 2026-10-01
category: Engineering
reading_time: 6
related: [setup, chat, adding-a-model]
---

Cursor can use a local model for chat through its "Override OpenAI Base
URL" setting. Cursor sends those requests from its own servers, so a
`localhost` address is unreachable: the model needs a public HTTPS URL,
and prompts and code context pass through Cursor on the way. This
tutorial connects a Cursor local model served by Marigold, states which
Cursor features use it, and covers VS Code with Continue as the route
where requests go straight from the editor to your machine.

This assumes the [setup guide](/tutorials/setup.html) is done and the
[chat example](/examples/chat.html) is running.

## How Cursor reaches a custom model

- Requests to a custom base URL come from Cursor's servers, not the
  editor. Tools such as [curxy](https://github.com/ryoppippi/curxy)
  exist for this reason: they tunnel a local server to a public URL.
- Tab completion always uses Cursor's built-in models. Agent and Edit
  rely on Cursor's own models; tool calls may fail against a
  self-hosted model even when chat works
  ([ngrok: connect a coding agent to custom models](https://ngrok.com/docs/ai-gateway/guides/use-with-coding-agents)).
- With the override on, all OpenAI-family requests go to your endpoint,
  including models picked from Cursor's built-in list
  ([Cursor forum, staff reply, 21 August 2026](https://forum.cursor.com/t/cursor-managed-models-are-routed-through-override-openai-base-url/169088)).

Cursor changes this behaviour between releases. Check it against the
version you run.

## 1. Check the endpoint locally

```bash
curl http://localhost:8000/v1/models
```

Copy a model `id` from the response, then send one chat request:

```bash
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "<model id>", "messages": [{"role": "user", "content": "Say hello."}]}'
```

## 2. Give it a public URL

Marigold requires no API key and accepts requests from any caller. A
public tunnel therefore exposes the model to anyone who has the URL.

For a short test, a Cloudflare quick tunnel prints a temporary
`trycloudflare.com` address:

```bash
cloudflared tunnel --url http://localhost:8000
```

Stop the tunnel when the test ends. For regular use, put an
authenticating proxy in front of the API that rejects requests without
the key you set in Cursor.

## 3. Configure Cursor

In Cursor Settings, under Models:

1. Turn on **OpenAI API Key** and enter a value. Marigold ignores it;
   an authenticating proxy checks it.
2. Turn on **Override OpenAI Base URL** and enter
   `https://<tunnel host>/v1`.
3. Select **Add model** and enter the model `id` from step 1.

Select that model in a chat and send a message.

## What to expect

| Feature | Model used |
|---|---|
| Chat | Your Marigold model |
| Tab completion | Cursor's built-in models |
| Agent and Edit | Cursor's own models |

Two Marigold limits apply to chat. `stream=true` returns correctly
framed chunks without token-level streaming, so each reply appears at
once. Only one tool call per assistant turn round-trips correctly.

To return to Cursor's own models, turn the base URL override off.

## Keeping code on your machine: VS Code with Continue

Continue, an extension for VS Code, calls the configured `apiBase`
directly, so a local LLM in VS Code needs no tunnel and no third party
sees the prompts. Add the model to Continue's `config.yaml`:

```yaml
name: Local config
version: 0.0.1
schema: v1

models:
  - name: Marigold
    provider: openai
    model: <model id>
    apiBase: http://localhost:8000/v1
    apiKey: unused
```

The same OpenAI-compatible endpoints serve any local AI IDE or client
that accepts a custom base URL. Clients that need token streaming or
parallel tool calls will hit the two limits above.

## Changing the model

The model comes from the running package's `models.yaml`.
[Adding a new model](/tutorials/adding-a-model.html) covers the edit,
rebuild and populate loop.
