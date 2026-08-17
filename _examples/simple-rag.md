---
layout: example
title: "simple-rag -- retrieval-augmented chat, verified"
description: "A worked Marigold example: chat and embedding models serving open-webui's retrieval pipeline, with a built-in test to prove retrieval is actually happening."
canonical: "https://marigold.run/examples/simple-rag.html"
og_title: "simple-rag -- Marigold example"
og_description: "Upload documents, ask questions only answerable from them, confirm retrieval is real -- not the model answering from its own training."
category: Examples
---

Marigold serves the chat and embedding models. Open WebUI handles
everything else -- chunking, storage, retrieval. This example wires the
two together and, more usefully, proves the wiring is actually correct:
three invented documents, each with facts that exist nowhere else, and
a set of questions only answerable if retrieval genuinely happened.

## Run it

```bash
pip install bayis-marigold
git clone https://github.com/bayinfosys/marigold-examples
marigold deployment start marigold-examples/simple-rag
```

Open `http://localhost:3000`.

## What's in it

`models.yaml` declares two models:

- `sentence-transformers/all-minilm-l6-v2` -- text embedding, matches
  Open WebUI's `RAG_EMBEDDING_MODEL` automatically, no extra
  configuration needed.
- `qwen/qwen3-8b` -- the chat model.

## The test

Three short documents, each describing an invented entity with details
that exist nowhere else -- deliberately. A real dataset risks the model
having seen the source material during training, which makes a correct
answer ambiguous evidence: it wouldn't prove retrieval happened, only
that the model already knew it.

`doc1-bramblecroft.txt`:
```
Bramblecroft Systems was founded in 2019 by Elena Wraxford.
The company's internal support ticket system is called Nettleburn.
As of the last audit, Bramblecroft Systems had 342 employees
across offices in Hull and Ljubljana.
```

`doc2-corvidwatch.txt`:
```
Corvidwatch Ltd is a wildlife monitoring cooperative established in 2016.
Its founder, Tomasz Ferrenbeck, previously worked as a hydrologist.
Corvidwatch's flagship sensor platform is named Rookwire, and the
organisation currently operates 58 monitoring stations, concentrated
along the Danube tributary network.
```

`doc3-quillmere.txt`:
```
Quillmere Analytics is a data consultancy founded in 2021 by
Adaeze Obiako. The firm's proprietary forecasting model is called
Driftlantern. Quillmere reported revenue of 2.7 million euros in
its most recent financial year, with clients concentrated in the
insurance sector.
```

Upload all three together -- each question also tests discrimination
between candidates, not just retrieval from a single file.

| Question | Correct answer |
|---|---|
| What is Bramblecroft Systems' ticket system called, and how many employees does it have? | Nettleburn, 342 |
| Who founded Corvidwatch, and what's their sensor platform called? | Tomasz Ferrenbeck, Rookwire |
| What was Quillmere Analytics' revenue, and what's their forecasting model called? | 2.7 million euros, Driftlantern |
| What is Bramblecroft Systems' primary competitor? | Not stated anywhere -- the correct answer is "I don't know." This is the important one: it checks whether the model fabricates an answer when nothing retrieved supports one. |

A correct answer, sourced back to the file you uploaded, confirms the
whole path -- embedding, storage, retrieval, generation -- running
entirely on your own hardware.

## What this confirms, and what it doesn't

Confirms: Marigold's embedding endpoint and Open WebUI's retrieval
pipeline are wired correctly, and retrieval discriminates between
documents rather than defaulting to whichever was uploaded most
recently.

Doesn't confirm: chunking quality or retrieval behaviour at realistic
document counts. Treat this as a plumbing check, not a quality
benchmark.

## No vector store of its own

Marigold hosts no vector database. Retrieval, chunking, and storage
here are all Open WebUI's own local ChromaDB instance. Marigold
supplies embedding vectors on request and nothing else in this path.
