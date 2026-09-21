---
layout: tutorial
title: "Adding a new model to an example package"
description: "Change the model in Marigold's chat example -- a newer open-weight model, a multimodal one, and a gated one requiring a HuggingFace token."
date: 2026-08-16
category: Engineering
reading_time: 6
canonical: "https://marigold.run/tutorials/adding-a-model.html"
og_title: "Adding a new model to Marigold"
og_description: "Edit a models.yaml, rebuild the package, populate the cache, and use a gated model, on your own hardware."
schema: |
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": "Adding a new model to an example package",
    "datePublished": "2026-08-16",
    "dateModified": "2026-09-21",
    "author": { "@type": "Organization", "name": "Marigold" },
    "publisher": { "@type": "Organization", "name": "Marigold", "url": "https://marigold.run" },
    "mainEntityOfPage": { "@type": "TechArticle", "@id": "https://marigold.run/tutorials/adding-a-model.html" }
  }
  </script>
---

This assumes the [setup guide](/tutorials/setup.html) is done. A
package's model list is its `models.yaml`. Changing the model `chat`
uses is an edit to that file, then building the package again and
populating the cache from it.

## Where it lives

```
marigold-examples/chat/models.yaml
```

The cache container reads this file from the installed package, so an
edit takes effect once the package is built and installed again. The
full loop:

```bash
marigold cache validate marigold-examples/chat
marigold package create marigold-examples/chat -o /tmp
marigold package install /tmp/chat-<version>.tar.gz
marigold cache populate chat
marigold application start chat
```

`cache validate` parses the package's `models.yaml` files on the host,
with no download and no containers. `package create` prints the path of
the archive it builds; the version in the name comes from
`[package].version` in `marigold.toml`. Installing under an existing
name replaces the index entry, so `chat` resolves to the new build.
`cache populate` downloads the new model and registers it in the
catalogue. Starting the application again replaces the running one.

## Change to a newer instruct model

`Qwen/Qwen3.5-9B` is ungated -- no token needed. Replace the entry in
`models.yaml`:

```yaml
models:
  - name: Qwen/Qwen3.5-9B
    provider: huggingface
    type: instruct
    input: chat
    output: chat
    extra_env:
      LOAD_IN_4BIT: "1"
    description: >
      9B parameter instruct model.
```

Then run the loop above.

## A multimodal model

`google/gemma-4-E4B-it` is also ungated -- Gemma 4 is licensed Apache
2.0. Same file, same loop:

```yaml
models:
  - name: google/gemma-4-E4B-it
    provider: huggingface
    type: instruct
    input: chat
    output: chat
    extra_env:
      LOAD_IN_4BIT: "1"
    description: >
      Multimodal instruct model.
```

## Previous models stay cached

The catalogue is host-wide. The model `chat` used before stays in the
cache and the catalogue, available to every application, and Open
WebUI lists it beside the new one. `marigold cache inspect` shows what
is on disk and its size.

## Using a gated model

Some models require accepting terms on HuggingFace before they can be
downloaded -- `google/gemma-2-9b-it` is one. That needs a HuggingFace
access token.

1. Visit the model's page on HuggingFace and accept the licence terms.
2. Generate a token at
   [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
   -- a read-only token is enough.
3. Set it in your system `config.toml`:

```toml
   [environment]
   HF_TOKEN = "hf_..."
```

   Or, for a single run, in your shell before populating the cache:

```bash
   export HF_TOKEN=hf_...
   marigold cache populate chat
```

The token is read when the cache downloads, at `cache populate`.
Starting the application needs none.

**This token is used entirely locally.** It is passed straight into the
cache container, which uses it to authenticate directly with
HuggingFace's own servers to download the model files -- the same
thing you'd do running `huggingface-cli login` yourself. Marigold has
no server of its own in this path, sees nothing you send, and stores
nothing beyond your own machine. The token never leaves the request
your own container makes to huggingface.co.

```yaml
models:
  - name: google/gemma-2-9b-it
    provider: huggingface
    type: instruct
    input: chat
    output: chat
    extra_env:
      LOAD_IN_4BIT: "1"
    description: >
      Gated model -- requires HF_TOKEN and accepting the model's terms
      on HuggingFace first.
```

Validate, rebuild and populate as before:

```bash
marigold cache validate marigold-examples/chat
marigold package create marigold-examples/chat -o /tmp
marigold package install /tmp/chat-<version>.tar.gz
marigold cache populate chat
marigold application start chat
```

If the token is missing or the terms have not been accepted, `cache
populate` reports the download failing with an authentication error.
That model gets no catalogue row; the other models in the file proceed.
