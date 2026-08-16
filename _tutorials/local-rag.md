---
layout: example
title: "Local document search with Marigold and Open WebUI"
description: "Ask questions of your own documents entirely on your own hardware -- Marigold serves the models, Open WebUI handles retrieval."
canonical: "https://marigold.run/tutorials/local-rag.html"
og_title: "Local RAG with Marigold and Open WebUI"
og_description: "Upload documents, ask questions, get answers grounded in your own files -- no cloud dependency."
category: Engineering
nav_links:
  - text: Tutorials
    href: /tutorials.html
  - text: Build Log
    href: /blog.html
  - text: GitHub
    href: "https://github.com/bayinfosys/marigold"
---

This assumes the [setup guide](/tutorials/setup.html) is done. Nothing
here repeats that part.

## What's actually happening

Marigold's job in this setup is small and specific: it serves an
embedding model and a chat model over its OpenAI-compatible endpoint.
Everything else -- splitting your documents into chunks, storing them,
deciding which chunks are relevant to a question, and injecting them
into the model's context -- is Open WebUI's own retrieval pipeline,
running its own local vector store underneath it. Marigold hosts no
vector database of its own.

This tutorial is a configuration exercise, not a demonstration of
anything Marigold-specific to RAG. The interesting work is performed
by Open WebUI.

## Start it

The `simple-rag` package already has this wired up -- a chat model and
an embedding model in its `models.yaml`, Open WebUI's
`RAG_EMBEDDING_MODEL` pointed at the same embedding model via its
`marigold.toml`:

```bash
marigold deployment start marigold-examples/simple-rag
```

Once it's up, `http://localhost:3000`'s embedding settings
(Admin Panel -> Settings -> Documents) should already show the right
model -- worth a glance, since if this is wrong, uploads still appear
to succeed and chat still looks normal; the failure is silent rather
than an error you'd notice.

## Try it

`simple-rag` ships three short documents, each describing an invented
entity with details that don't exist anywhere else -- deliberately, so
a correct answer proves retrieval happened rather than the model
already knowing the answer. They're in `marigold-examples/simple-rag/documents/`.

Upload all three at once, then ask, for example: *"What is
Bramblecroft Systems' ticket system called, and how many employees
does it have?"* A correct answer -- sourced back to the document you
uploaded -- confirms the whole path: embedding, storage, retrieval, and
generation, all running locally, nothing sent anywhere else.

The package's own README has the full set of questions and expected
answers, including a negative-control question (asking something none
of the documents actually say) worth running before treating retrieval
as fully verified.

## On model size

A very small instruct model can produce a correct retrieved answer and
still visibly struggle at the surrounding task -- generating a confused
follow-up search query, or pulling phrasing from a previous unrelated
answer into a new one. That's a property of the model, not of whether
retrieval worked. Open WebUI's own FAQ covers why this happens: by
default, the same model handling your chat also handles background
tasks like query generation, and a smaller model can be a worse fit for
those than for the conversation itself. If you see this, it's worth
trying a larger instruct model before assuming anything's broken --
see [adding a new model](/tutorials/adding-a-model.html).

## Further reading

This tutorial only covers wiring Marigold in as the model backend.
Open WebUI's own documentation covers the retrieval feature in far more
depth than is worth repeating here:

- [RAG overview](https://docs.openwebui.com/features/chat-conversations/rag/)
- [Knowledge bases](https://docs.openwebui.com/features/workspace/knowledge/)
- [RAG troubleshooting](https://docs.openwebui.com/troubleshooting/rag/)
