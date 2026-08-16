---
layout: tutorial
title: "Setting up Marigold: a self-hosted inference stack in one command"
description: "Install, configure, and run Marigold locally -- API, worker, and Open WebUI, no cloud dependency."
date: 2026-08-16
category: Engineering
reading_time: 6
canonical: "https://marigold.run/tutorials/setup.html"
og_title: "Setting up Marigold -- self-hosted in one command"
og_description: "Install, configure, and run Marigold locally. No cloud dependency, runs airgapped once set up."
schema: |
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": "Setting up Marigold: a self-hosted inference stack in one command",
    "datePublished": "2026-08-16",
    "dateModified": "2026-08-16",
    "author": { "@type": "Organization", "name": "Marigold" },
    "publisher": { "@type": "Organization", "name": "Marigold", "url": "https://marigold.run" },
    "mainEntityOfPage": { "@type": "TechArticle", "@id": "https://marigold.run/tutorials/setup.html" }
  }
  </script>
---

Marigold is a self-hosted inference platform: an OpenAI-compatible API, a
model-serving worker, and a chat interface, all running on your own
hardware. This tutorial gets you from nothing installed to a working
chat session, and covers the conventions you need before customising
anything.

## Prerequisites

- Docker and Docker Compose
- NVIDIA Container Toolkit, if you're running a GPU-backed model (the
  worker service requests one by default)
- A HuggingFace token, only if you plan to use a gated model -- not
  required for this walkthrough

## Install

```bash
pip install bayis-marigold
```

This installs the `marigold` command. It doesn't install the model
code itself -- that runs in containers, pulled automatically the first
time you start something.

## Get the examples

Application packages -- pre-written model lists and run configurations
-- live in a separate repository, so they can be updated and added to
independently of the library itself:

```bash
git clone https://github.com/bayinfosys/marigold-examples
```

Each directory under `marigold-examples` is a self-contained package:
a `models.yaml` declaring which models to load, a `marigold.toml`
declaring how to run it.

## Start one

```bash
marigold deployment start marigold-examples/chat
```

This brings up the full stack for that package: Postgres, a one-shot
`cache-init` service that downloads whatever `chat`'s `models.yaml`
declares, the worker, the API, and (since `chat` asks for it) Open
WebUI. `cache-init` completes before the worker and API start --
expected, they wait on it deliberately. The first run downloads the
model; this is the only point in the whole process requiring an
internet connection.

## Confirming it worked

Two checks, in order:

1. **The API.** Visit `http://localhost:8000/docs` and check
   `GET /v1/models` lists the model from `chat`'s `models.yaml`. If
   it's missing here, nothing past this point will work correctly --
   catch it here first.
2. **Open WebUI.** Visit `http://localhost:3000`. On a fresh cache,
   this should show an empty chat history. Send a message and confirm
   you get a response.

## The rest of the commands

```bash
marigold deployment stop marigold-examples/chat     # tear down
marigold deployment logs marigold-examples/chat     # tail logs
marigold deployment status marigold-examples/chat   # container state
marigold cache inspect                               # what's cached, where, disk usage
```

**Only one deployment runs at a time.** Starting a different package
reconfigures the same deployment in place, rather than running two
stacks side by side -- Postgres and the model cache persist across the
switch. This is deliberate: the model cache is shared across every
package on your machine, so if two packages both use the same model,
switching between them doesn't mean downloading it twice.

## Where things live

Two things Marigold cares about, in two different places, for two
different reasons:

- **The model cache** -- downloaded weights, offload storage, binary
  outputs. Host-level: one location, shared by every package you run,
  independent of which one is currently active. Defaults to
  `~/.marigold/cache`.
- **Which models a package wants** -- that package's own `models.yaml`,
  small and git-trackable, living in `marigold-examples` (or wherever
  else you keep your own packages).

Deleting the model cache resets it completely -- the next
`marigold deployment start` rebuilds it from whatever `models.yaml`
declares.

## Configuring it

An optional `config.toml` -- in your current directory,
`~/.marigold/config.toml`, or wherever `$MARIGOLD_CONFIG` points --
overrides the defaults. Nothing here is required to get started; a
bare `pip install` with no config file works out of the box.

```toml
[cache]
dir = "/data/marigold"

[database]
url = "postgresql://..."

[deployment]
tag = "v0.6.7"    # pin a specific released version
```

Cache location and database connection are host-level settings, not
something an individual package's `marigold.toml` should need to know
about.

## Running air-gapped

Once a model's been downloaded, it's sitting on local disk --
inference itself makes no external request. The compose files set the
environment variables needed to stop the worker, API, and Open WebUI
attempting any network call once models are cached, so after the first
successful run you can disconnect entirely and Marigold keeps working.

## What's next

This setup is the foundation the other tutorials build on: local
document search (RAG), and adding a new model to an existing package.
Each assumes a working deployment from this guide -- they won't repeat
this part.
