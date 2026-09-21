---
layout: tutorial
title: "Setting up Marigold: platform, package and application"
description: "Install Marigold, start the shared platform, install a package, cache its models and run its application, on your own hardware."
date: 2026-08-16
category: Engineering
reading_time: 7
canonical: "https://marigold.run/tutorials/setup.html"
og_title: "Setting up Marigold: platform, package and application"
og_description: "Install Marigold and run a first application against a shared, self-hosted platform. Runs air-gapped once models are cached."
schema: |
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": "Setting up Marigold: platform, package and application",
    "datePublished": "2026-08-16",
    "dateModified": "2026-09-21",
    "author": { "@type": "Organization", "name": "Marigold" },
    "publisher": { "@type": "Organization", "name": "Marigold", "url": "https://marigold.run" },
    "mainEntityOfPage": { "@type": "TechArticle", "@id": "https://marigold.run/tutorials/setup.html" }
  }
  </script>
---

Marigold is a self-hosted inference platform: a shared model cache, an
API, a worker, and applications that run against them, all on your own
hardware. This tutorial goes from nothing installed to a running
application, and covers the conventions to understand before writing
your own.

A running system has three layers. The platform is shared by
everything on the host. A package is a list of required models plus
application code. An application is a package's code running in its
own container, reaching the platform through the API.

## Prerequisites

- Docker and Docker Compose
- NVIDIA Container Toolkit, for a GPU worker
- Python 3.12
- A HuggingFace token, for gated models such as anything under
  `meta-llama`. This walkthrough needs none.

## Install the CLI

```bash
pip install bayis-marigold
marigold --version
```

This installs the `marigold` command. Model code runs in containers,
pulled the first time they start.

## One directory holds everything

Every piece of state Marigold keeps -- model weights, the database,
installed packages, application outputs -- lives under one cache
directory: no named volumes, no external database, no state held only
inside a container.

Set its location in a system config:

```toml
# ~/.marigold/config.toml
[platform]
compose_files = ["core", "cpu"]     # add "gpu" for an NVIDIA worker

[cache]
dir = "/data/marigold"              # default: ~/.marigold/cache
```

The CLI reads `$MARIGOLD_CONFIG` if set, then `config.toml` in the
current directory, then `~/.marigold/config.toml`. Keep one config in
your home directory. A `config.toml` in a working directory takes
precedence whenever you are in it, which changes the cache and platform
the CLI addresses; scripts set `MARIGOLD_CONFIG`.

`marigold config path` prints the config in use, and `marigold config
show` prints every resolved value with the layer it came from.

Create the layout:

```bash
marigold cache init
```

For a cache directory under a system path such as `/data`, `cache
init` prints the two commands to create it with your ownership. The CLI
writes installed packages there as you; containers write model weights
and database files as root.

```
/data/marigold/data/
  models/          downloaded weights, shared by every package
  postgres/        the platform database
  packages/        package archives and the installed index
  applications/    extracted packages, and each application's outputs
  outputs/         binary inference outputs
  tmp/             worker offload space
```

## Start the platform

```bash
marigold platform start
marigold platform status
```

This starts Postgres, the API, the worker and the cache container, as
compose project `marigold`. The API answers at
`http://localhost:8000/docs`. The catalogue is empty: nothing has been
downloaded yet.

## Install a package

```bash
git clone https://github.com/bayinfosys/marigold-examples
marigold package create marigold-examples/platform-model-test -o /tmp
marigold package install /tmp/platform-model-test-0.2.0.tar.gz
marigold package list
```

`package create` builds an archive from a package directory and prints
its path. `package install` copies it into the cache, extracts it, and
records it under its name, `platform-model-test`.

## Download its models

```bash
marigold cache populate platform-model-test
```

The cache container reads the package's `models.yaml`, downloads each
model the cache lacks, and registers each one in the catalogue as soon
as its weights are present. This is the only step that needs an
internet connection. A model that fails to download is reported and
skipped; the others proceed.

`curl http://localhost:8000/models` now lists the cached models.

## Run its application

```bash
marigold application start platform-model-test
marigold application logs platform-model-test
```

The application runs in its own container, compose project
`marigold-platform-model-test`, with the package mounted read-only at
`/app`. It reaches the platform through the API and nothing else.
`platform-model-test` submits one request to every catalogued model and
prints a line per model. The first requests are slow while each model
loads.

When it has finished:

```bash
marigold application status platform-model-test
```

shows its exit code: 0 if every model answered.

## Stopping

```bash
marigold application stop platform-model-test   # the application only
marigold platform stop --applications           # everything
```

Several applications share one platform. Stopping one leaves the
platform and the others running.

## Starting over

The model cache is expensive to rebuild and safe to keep. To reset
everything else:

```bash
marigold platform stop --applications
sudo rm -rf /data/marigold/data/postgres
```

The next `platform start` creates a fresh database, and `cache
populate` re-registers cached models without downloading them again.
Deleting `data/models` as well removes every downloaded weight.

## Running air-gapped

Once `cache populate` has run, every model a package needs is on local
disk. The worker is configured to make no network calls and loads only
from the cache. After the first population, the host can be
disconnected entirely.

## What next

The other tutorials build on this setup:
[local document search with Open WebUI](/tutorials/local-rag.html), and
[adding a new model to an example package](/tutorials/adding-a-model.html).
Each assumes a running platform from this guide.
