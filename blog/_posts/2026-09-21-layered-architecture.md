---
layout: post
title: "One GPU, Many Applications: Layering a Self-Hosted Inference Platform"
description: "Marigold 0.7 separates the platform, the package and the application. Two gateways, a catalogue of what the cache contains, and applications that hold no weights."
date: 2026-09-21
author: Marigold
category: Engineering
reading_time: 7
canonical: "https://marigold.run/blog/layering.html"
og_title: "One GPU, Many Applications: Layering a Self-Hosted Inference Platform"
og_description: "Marigold 0.7 separates the platform, the package and the application, so many applications share one GPU."
schema: |
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "One GPU, Many Applications: Layering a Self-Hosted Inference Platform",
    "description": "Marigold 0.7 separates the platform, the package and the application. Two gateways, a catalogue of what the cache contains, and applications that hold no weights.",
    "datePublished": "2026-09-21",
    "dateModified": "2026-09-21",
    "author": { "@type": "Organization", "name": "Marigold" },
    "publisher": { "@type": "Organization", "name": "Marigold", "url": "https://marigold.run" },
    "mainEntityOfPage": { "@type": "WebPage", "@id": "https://marigold.run/blog/layering.html" }
  }
  </script>
---

# One GPU, many applications: layering a self-hosted inference platform

Up to version 0.6, Marigold had one noun for a running system: the
deployment. `marigold deployment start chat` started Postgres,
downloaded the models `chat` declared, started the worker and the API,
and brought up Open WebUI, all as one Docker Compose project. A
deployment was the platform, the models and the application at once.

That coupling fixed three things together. One deployment ran per
host, so starting a second package reconfigured the first in place.
Downloading models was a side effect of starting an application. The
platform could not start, stop or report without a package to name it.
A host with one GPU served one application at a time, and no part of
the system scaled on its own terms.

Marigold 0.7 removes the deployment. The `marigold deployment` command
is gone, with no alias. In its place are three layers, each with its
own lifecycle and its own command.

## Three layers

**The platform** is Postgres, the API, the worker and the cache
container. There is one per host, running as compose project
`marigold`, configured entirely by the system config. It owns the
model cache, the catalogue, the queues and the results. It starts,
stops and reports with no package in hand:

```
marigold platform start
marigold platform status
marigold platform logs [service]
marigold platform stop [--applications]
```

**A package** is a directory or archive holding `marigold.toml`, one
or more `models.yaml` files, and application code. It is built into an
archive and installed into the cache under its name. A package owns a
declaration: which models must be present, and what its application
runs. It says nothing about where models execute, on what hardware, or
by which worker.

**An application** is a package's code running in its own container,
as compose project `marigold-<name>`. It owns its process and its
output directory. Starting, stopping or replacing one leaves the
platform and every other application running.

```
marigold application start <package>
marigold application status <package>
marigold application logs <package>
marigold application stop <package>
```

The platform is the fat layer. It holds the typed operations -- a
capability class, a model and an input set, producing an immutable
result -- and the weights behind them. Applications hold no weights.
An application is code and a list of required models; the weights
exist once, in the shared cache, and every application reaches them
through the same API.

## Two gateways

Two components face outward. Everything else is internal.

The cache container is the gateway for artefacts. It downloads
weights, reads installed packages, creates the platform's tables and
writes the catalogue. It is the only component that needs outbound
network access, and the only one that writes the model cache.

The API is the gateway for requests. Applications and external clients
submit work, poll results and read the catalogue through it. It is the
only component on both networks, and the place authentication will
live.

| Network | Members | Purpose |
|---|---|---|
| `marigold-core` | postgres, worker, cache container, api | platform internals |
| `marigold-applications` | api, every application | the only route from an application to the platform |

The worker talks to Postgres and reads the cache. It makes no outbound
calls: `HF_HUB_OFFLINE` is set, and the model cache is mounted
read-only. Postgres publishes no port on the host; containers on
`marigold-core` reach it as `postgres:5432`, and nothing else can. The
API publishes port 8000 for external clients.

The two networks are created by the platform's compose file under
fixed names and joined as external by each application's, which is how
separate compose projects share them.

## The catalogue records what the cache contains

A catalogue row means a model's weights are in the cache. The row is
written when the weights are confirmed present, and at no other time.

`marigold cache populate <package>` runs the cache container against
an installed package. It reads the package's `models.yaml`, downloads
each model the cache lacks, and registers each one as its weights are
confirmed: queue first, then row. A model that fails to download is
reported and gets no row; every other model proceeds.

The catalogue is host-wide. Rows accumulate across packages, and
uninstalling a package removes none of them: a cached model stays
available to every application. Because a row has one meaning, the
API's errors do too:

| Response | Meaning |
|---|---|
| 400 unknown model | not in the catalogue: not cached, or never declared |
| 409 model load failed | cached, but the worker could not load it |
| 503 | platform tables not yet created |

## The execution container

Each application runs in an executor container with two mounts:

| Path | Contents | Mode |
|---|---|---|
| `/app` | the package root, and the working directory | read-only |
| `/outputs` | this application's own output directory | read-write |

The environment gives it `MARIGOLD_API_BASE` (`http://api:8000`), its
application name and instance identity, and anything the package
declares under `[environment]`. It joins `marigold-applications`, so
the API is reachable and Postgres, the worker and the cache container
are not. The container runs with `restart: "no"`: a script that exits
stays exited, with its exit code visible in `application status`, and
a long-running service or agent loop runs until stopped.

The host filesystem beyond those two mounts, the Docker socket and the
database are never available to it. An application therefore has the
same reach as any external client of the API. A failing application
exits in its own container; an application whose platform stops keeps
running and fails its API calls, visibly, in its own logs.

## What it enables

The worker serves one model at a time and, on each sweep, picks the
deepest queue. Several applications sharing one worker queue behind one
another. That is how a fleet of agents runs on a single local GPU: ten
agent containers, each its own application, each submitting to the
same API, with one copy of each model on disk and one model resident on
the GPU at a time.

Every request carries an `application_id`, set from
`MARIGOLD_APPLICATION_ID`. It is recorded against usage, and it forms
part of the request hash, so identical requests from two applications
are two jobs.

A package declares requirements and leaves execution to the platform,
so the same package runs unchanged on a host with many workers. Queue
claims use `SELECT ... FOR UPDATE SKIP LOCKED`, which makes additional
workers safe at the message level. Assigning models to specific workers
is future work.

## Limits

These are recorded in the architecture document as known gaps.

- Postgres roles per component are designed and not enforced. Every
  component connects as the same user today.
- The worker still creates its own tables at startup, the one
  remaining exception to table creation belonging to the cache
  container.
- `marigold-core` has a route out. The worker's offline behaviour rests
  on its configuration; making the network internal needs the cache
  container on a separate egress network.
- There is one worker. Worker selection by capability or allowlist is
  unbuilt.
- Package archives are extracted with `filter="data"` and no limit on
  uncompressed size or member count.
- The system config is found in the working directory before the home
  directory, so changing directory can change which cache and platform
  the CLI addresses. Scripts set `MARIGOLD_CONFIG`.

## The run

`platform-model-test` in marigold-examples lists the catalogue, submits
one request to every catalogued model, polls each to completion, and
exits 0 only if every model answered.

```
pip install bayis-marigold
git clone https://github.com/bayinfosys/marigold-examples

marigold cache init
marigold package create marigold-examples/platform-model-test -o /tmp
marigold package install /tmp/platform-model-test-0.2.0.tar.gz
marigold cache populate platform-model-test
marigold application start platform-model-test
marigold application logs platform-model-test
marigold application status platform-model-test
```

[CAPTURED OUTPUT: `cache populate`, showing each model downloaded and
registered]

[CAPTURED OUTPUT: `application logs`, one line per model]

[CAPTURED OUTPUT: `application status`, exit code 0]

The first requests are slow while each model loads. Once `cache
populate` has run, the host can be disconnected: every model the
package needs is on local disk.

The design is described in full in
[ARCHITECTURE.md](https://github.com/bayinfosys/marigold/blob/main/docs/ARCHITECTURE.md),
[PACKAGES.md](https://github.com/bayinfosys/marigold/blob/main/docs/PACKAGES.md)
and
[PRINCIPLES.md](https://github.com/bayinfosys/marigold/blob/main/docs/PRINCIPLES.md).
The argument for the fat layer is in
[Fat protocols for AI](https://www.bayis.co.uk/library/45-fat-protocols-for-ai.html).
