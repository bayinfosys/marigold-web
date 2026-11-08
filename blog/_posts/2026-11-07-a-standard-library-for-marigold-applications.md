---
layout: post
title: "A standard library for Marigold applications"
description: "Reusable applications and patterns that other applications build on, and the rules that would decide what belongs."
date: 2026-11-07
author: Marigold
category: Engineering
reading_time: 4
related: [applications, showcase, examples]
---

# A standard library for Marigold applications

Marigold applications can now be built, published to a registry and
installed by name. With distribution in place, a pattern becomes
visible across the examples: each application repeats the same work.
`simple-rag` splits documents, embeds them and retrieves passages.
`chat` does the same behind its interface. `benchmark-llm` and
`benchmark-image-gen` share a submit, poll and record loop. Every
application that judges its own output writes its own evaluator.

Python's standard library is what lets a script start at the problem.
Marigold applications would benefit from the same: a small set of
dependable building blocks, published in one registry, that other
applications use instead of rewriting.

## Two kinds of building block

**Services** are applications that run and answer requests. Another
application declares them in `requires`, and calls them through the
platform API at `/apps/<name>/api`. A service owns its data in its own
application database.

**Patterns** are applications made of prompts and a loop, run by the
platform's runtime. They are used by copying and changing the prompts,
or by calling them as a run with an input.

Both are ordinary applications: published, versioned and installed
like any other.

## Candidate services

| Service | Does | Models |
|---|---|---|
| `ingest` | files in, clean text and chunks out: PDF, Word, HTML, images through captioning | img2txt |
| `index` | stores embeddings and answers similarity queries | text-embedding, image-embedding |
| `transcribe` | audio in, text out, with timings | asr |
| `speak` | text in, audio out, queued | tts |
| `judge` | scores an output against criteria, with reasons | instruct |

## Candidate patterns

| Pattern | Does |
|---|---|
| `extract` | text in, a structured record out, validated against a schema |
| `classify` | rows labelled in batches; low-confidence rows sent to an instruct model with an explanation |
| `loop-until` | generate, evaluate, regenerate until criteria are met or attempts run out |
| `brief` | documents in, a summary and an audio briefing out |
| `watch` | a set of pages captured on a schedule, with changes described |

Several already exist in part. `loop-until` is the quality-gated image
generation on the Marigold home page. `judge` follows the approach in
our article on LLM-as-judge. `classify` is the batch tabular
classification use case.

## Why composition is cheap here

In most stacks, composing services multiplies the cost: each brings
its own model server and its own copy of the weights. On Marigold the
models belong to the platform. `index` and an application that uses it
share one embedding model in one cache and one worker. A standard
library service adds code and a small database, and no extra weights.

## What would belong

A rule for inclusion keeps the library small:

1. **Used twice.** A block enters once two separate applications use
   it, typically from the showcase.
2. **Stable interface.** Its inputs and outputs are documented
   schemas, and they change only with a major version.
3. **Common models.** It runs on model types every host can serve,
   with small defaults and larger models as options.
4. **No hidden state.** Its data lives in its own application
   database, visible and removable.

Blocks start in the showcase, prove themselves in two applications,
and graduate.

## Where it would live

One registry, maintained by the project, holding only the standard
library. It is also the case for Marigold shipping with one registry
already configured: a fresh install could resolve `requires =
["index>=1"]` with no setup. That registry's address would be the
most permanent URL the project publishes, and it should be chosen with
that in mind.

## Open questions

- **Names.** A prefix (`std-index`) or a registry that is itself the
  namespace? `requires` can already name a registry, which suggests
  the second.
- **Interfaces.** Where do service schemas live: in each service's
  README, or in a machine-readable file the catalogue renders?
- **Versions.** How far apart can a service and its callers drift?
  Semantic versioning on interfaces, with `requires` ranges, is the
  starting assumption.
- **Patterns as code or as runs.** Copying a pattern gives control.
  Calling it gives updates. Both may be needed.
- **Testing.** A standard library needs conformance tests, in the way
  `platform-model-test` tests the platform.

## First steps

`ingest`, `index` and `judge` appear in most of the showcase plans:
photo search, document questions, quality gates. Building those three
as services, then rebuilding `simple-rag` on top of them, would test
the idea on an application that already exists. That rebuild is a
measure in its own right: `simple-rag` should shrink to its prompts.
