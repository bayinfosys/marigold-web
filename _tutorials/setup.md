---
layout: tutorial
title: "Setting up Marigold: a self-hosted inference stack in one command"
description: "Clone, configure, and run Marigold locally with Docker Compose -- API, workers, and Open WebUI, no cloud dependency."
date: 2026-07-27
category: Engineering
reading_time: 6
canonical: "https://marigold.run/tutorials/setup.html"
og_title: "Setting up Marigold -- self-hosted in one command"
og_description: "Clone, configure, and run Marigold locally with Docker Compose. No cloud dependency, runs airgapped once set up."
schema: |
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": "Setting up Marigold: a self-hosted inference stack in one command",
    "datePublished": "2026-07-27",
    "dateModified": "2026-07-27",
    "author": { "@type": "Organization", "name": "Marigold" },
    "publisher": { "@type": "Organization", "name": "Marigold", "url": "https://marigold.run" },
    "mainEntityOfPage": { "@type": "TechArticle", "@id": "https://marigold.run/tutorials/setup.html" }
  }
  </script>
---

Marigold is a self-hosted inference platform: an OpenAI-compatible API, a
model-serving worker, and a chat interface, all running on your own
hardware. This tutorial gets you from a fresh clone to a working chat
session, and covers the conventions you need before customising anything.

## Prerequisites

- Docker and Docker Compose
- NVIDIA Container Toolkit, if you're running a GPU-backed model (the
  worker service requests one by default)
- A HuggingFace token, only if you plan to use a gated model such as
  anything under `meta-llama` -- not required for this walkthrough

## Clone the repository

```bash
git clone https://github.com/bayinfosys/marigold
cd marigold
```

## The three Compose files

Marigold's Docker Compose setup is split across three files:

- `docker-compose.core.yaml` -- the actual services: Postgres, the
  cache builder, the inference worker, and the API.
- `docker-compose.webui.yaml` -- Open WebUI, as an example chat
  frontend for the API.
- `docker-compose.yaml` -- includes both of the above. This is the
  file Compose picks up by default, so `docker compose up` on its own
  gives you the full stack.

You don't need the other two files directly for normal use; they exist
so the core services can run alone if you want a leaner stack, or a
different frontend in place of Open WebUI.

## `MARIGOLD_DIR`: one directory, nowhere else

Every piece of state a Marigold setup has -- which models to load, local
configuration, and everything the running containers produce -- lives
under one directory, pointed at by the `MARIGOLD_DIR` environment
variable. Nothing is stored anywhere else: no Docker named volumes, no
database outside this directory, no state held only inside a container.
If it matters, it's a file under `MARIGOLD_DIR`.

### What you provide

Two files, written by you before the first run:

```
your-setup/
  models.yaml     -- which models to load
  local.env       -- environment overrides for this setup
```

### What gets created

Everything else under `MARIGOLD_DIR` is produced by running the stack,
not written by hand:

```
your-setup/
  data/
    models/       -- downloaded model weights
    tmp/          -- offload storage used during inference
    outputs/      -- binary outputs (images, audio, etc.)
    webui/        -- Open WebUI's own state: chat history, uploaded
                     documents, and its internal vector store used for
                     document retrieval
```

`data/` doesn't need to exist beforehand -- Docker creates it as empty
directories the first time you run `docker compose up` against a new
`MARIGOLD_DIR`.

**`data/` is the entire state of your project.** Deleting it deletes
everything -- downloaded models, chat history, uploaded documents, all
of it -- and running `docker compose up` again rebuilds from nothing
but `models.yaml` and `local.env`. Nothing else to clean up anywhere: no
named volume to separately remove, no database sitting outside this
folder, no cache held by a container that survives the directory being
deleted.

## Writing `models.yaml`

This file lists which models get downloaded and served. Keep it small
and specific to what you're actually going to use -- model weights can
run into gigabytes each, so there's no reason to load more than you need
for a given setup.

A minimal example, one small instruct model and one small embedding
model:

```yaml
models:

  - name: qwen/qwen2.5-1.5b-instruct
    provider: huggingface
    type: instruct
    input: chat
    output: chat
    timeout: 600
    gpu_tier: sm
    gpu_units: 1
    memory_size: 2048
    extra_env:
      LOAD_IN_4BIT: "1"
    description: >
      Small instruction model, chosen to keep the download and VRAM
      footprint minimal.

  - name: sentence-transformers/all-minilm-l6-v2
    provider: huggingface
    type: text-embedding
    input: text
    output: vector/384
    gpu_tier: none
    gpu_units: 0
    parameters:
      vector_size: 384
    description: >
      Small, fast general-purpose embedding model.
```

Neither of these is gated, so no HuggingFace token is required for this
particular pair.

## Writing `local.env`

`local.env` tells Compose where your `MARIGOLD_DIR` is and which
catalogue file inside it to load:

```bash
# your-setup/local.env
# Used with: docker compose --env-file your-setup/local.env up

MARIGOLD_DIR=./your-setup
MODELS_CATALOGUE=/app/marigold/models.yaml

# Only needed if models.yaml includes a gated model.
HF_TOKEN=
```

Get this right first time: `MARIGOLD_DIR` must start with `./`, `../`,
or `/`. Docker Compose treats a bare path like `your-setup` (no leading
`./`) as the name of a named volume rather than a directory on disk,
which silently gives you an empty, disconnected volume instead of your
actual directory. If your models never seem to load and nothing looks
obviously wrong, check this first.

`MODELS_CATALOGUE` is a path *inside the container*, always
`/app/marigold/...`, since that's where `MARIGOLD_DIR` gets mounted --
not the path on your own machine.

## Running it

```bash
docker compose --env-file your-setup/local.env up
```

The first run downloads the models listed in `models.yaml` -- this can
take a while depending on model size and connection speed, and it's the
only point in this whole process where an internet connection is
actually required. The `cache-init` service runs to completion before
the worker and API start; that's expected, they wait on it deliberately.

## Confirming it worked

Two checks, in order:

1. **The API.** Visit `http://localhost:8000/docs` for the interactive
   API documentation, and check `GET /v1/models` lists the models from
   your `models.yaml`. If a model is missing here, nothing past this
   point will work correctly -- catch it here first.

2. **Open WebUI.** Visit `http://localhost:3000`. On a genuinely fresh
   `MARIGOLD_DIR`, this should show an empty chat history and no
   previous conversations -- if you see chats you don't recognise,
   `MARIGOLD_DIR` is pointing somewhere unexpected (see the leading-`./`
   note above), not at your new directory.

Send a message and confirm you get a response from the instruct model.

## Starting over

Because everything lives under `MARIGOLD_DIR`, resetting a setup
completely -- models, chat history, everything -- is one command:

```bash
rm -rf your-setup/data
```

The next `docker compose up` recreates it from scratch.

## Running air-gapped

Once `data/models` has been populated, every model your setup uses is
sitting on local disk -- inference itself makes no external request.
The compose files include the environment variables needed to stop
Open WebUI and the underlying HuggingFace libraries attempting any
network call once the models are cached, so after the first successful
run you can disconnect entirely and Marigold keeps working.

## What's next

This setup is the foundation the other tutorials build on: local
document search (RAG), running agents against Marigold with LangGraph,
and connecting IDE tools like Continue.dev. Each of those assumes a
working `MARIGOLD_DIR` from this guide -- they won't repeat this part.
