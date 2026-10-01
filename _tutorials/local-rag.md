---
title: "Local Document Search with Open WebUI"
description: "Ask questions of your own documents with every step on your own hardware: Marigold serves the chat and embedding models, Open WebUI handles retrieval."
date: 2026-10-01
last_modified_at: 2026-10-01
category: Engineering
reading_time: 5
related: [setup, simple-rag, adding-a-model]
---

Ask questions of your own documents with every step on your own
hardware. Marigold serves the chat and embedding models; Open WebUI
handles upload, chunking, storage and retrieval. This tutorial starts
the `simple-rag` package, checks that the embedding settings line up,
and shows where each piece of data lives.

This assumes the [setup guide](/tutorials/setup.html) is done and the
platform is running.

## Start it

The `simple-rag` package has this wired up: a chat model and an
embedding model in its `models.yaml`, `webui` in its `compose_files`,
and Open WebUI's `RAG_EMBEDDING_MODEL` pointed at the same embedding
model through its `[environment]` table:

```bash
marigold package create marigold-examples/simple-rag -o /tmp
marigold package install /tmp/simple-rag-<version>.tar.gz
marigold cache populate simple-rag
marigold application start simple-rag
```

`package create` prints the archive path. `cache populate` downloads
both models. `application start` adds Open WebUI to the platform, on
the applications network as a client of the API, then runs the
package's application, which checks that both models are in the
catalogue. `marigold application status simple-rag` shows exit code 0
when they are.

Open WebUI keeps its documents, vector store and chat history under the
cache directory, in `data/webui`. It runs with the platform:
`marigold application stop simple-rag` leaves it running, and
`marigold platform stop` stops it.

Once it's up, `http://localhost:3000`'s embedding settings
(Admin Panel -> Settings -> Documents) should already show the right
model -- worth a glance, since if this is wrong, uploads still appear
to succeed and chat still looks normal; the failure is silent rather
than an error you'd notice.

## The embedding setting

The package forwards one variable to Open WebUI:

```toml
[environment]
RAG_EMBEDDING_MODEL = "sentence-transformers/all-minilm-l6-v2"
```

Marigold's CLI passes `[environment]` values through to the other
services in the stack without interpreting them. To change the
embedding model, change it here and in the package's `models.yaml`
together, then rebuild, install and populate the package.

## Ask a question

Open `http://localhost:3000`, attach a document to a chat, and ask
about something only that document contains. A correct answer that
cites the file confirms the full path -- embedding, storage, retrieval,
generation -- ran locally.

A general question is weak evidence: the model may answer from its
training. The [simple-rag example](/examples/simple-rag.html) ships
three invented documents and a question set that separates retrieval
from recall, including one question whose correct answer is "I don't
know".

## Where each piece lives

| Piece | Served by | Stored in |
|---|---|---|
| Chat model | Marigold worker | `data/models` |
| Embedding model | Marigold worker | `data/models` |
| Uploaded documents and chunks | Open WebUI | `data/webui` |
| Vector store | Open WebUI's local ChromaDB | `data/webui` |
| Chat history | Open WebUI | `data/webui` |

Marigold hosts no vector database. It supplies embedding vectors on
request and generates the answer; everything else in the retrieval
path belongs to Open WebUI.

## Change the chat model

The chat model is an entry in the package's `models.yaml`.
[Adding a new model](/tutorials/adding-a-model.html) covers the edit,
rebuild and populate loop.

## Stop

```bash
marigold application stop simple-rag    # the application container
marigold platform stop --applications   # everything, Open WebUI included
```
