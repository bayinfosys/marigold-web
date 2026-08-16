---
layout: tutorial
title: "Adding a new model to an example package"
description: "Swap the model in Marigold's chat example -- a newer open-weight model, a larger one, and a gated one requiring a HuggingFace token."
date: 2026-08-16
category: Engineering
reading_time: 5
canonical: "https://marigold.run/tutorials/adding-a-model.html"
og_title: "Adding a new model to Marigold"
og_description: "Edit a models.yaml, use a gated model, run entirely on your own hardware."
schema: |
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": "Adding a new model to an example package",
    "datePublished": "2026-08-16",
    "dateModified": "2026-08-16",
    "author": { "@type": "Organization", "name": "Marigold" },
    "publisher": { "@type": "Organization", "name": "Marigold", "url": "https://marigold.run" },
    "mainEntityOfPage": { "@type": "TechArticle", "@id": "https://marigold.run/tutorials/adding-a-model.html" }
  }
  </script>
---

This assumes the [setup guide](/tutorials/setup.html) is done. A
package's model list is one YAML file -- swapping the model `chat`
uses is an edit to that file, nothing else.

## Where it lives

```
marigold-examples/chat/models.yaml
```

Whatever's declared there is what `cache-init` downloads and the
worker serves, the next time you run:

```bash
marigold deployment start marigold-examples/chat
```

## Swap in a newer instruct model

`Qwen/Qwen3.5-9B` is ungated -- no token needed:

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

Check it loads cleanly before touching Docker at all:

```bash
marigold cache validate marigold-examples/chat/models.yaml
```

Then start (or restart) the deployment as usual.

## A larger, more capable model

`google/gemma-4-E4B-it` is also ungated -- Gemma 4 is licensed Apache
2.0, unlike earlier Gemma generations. Same file, same process:

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
      Larger multimodal instruct model.
```

## Using a gated model

Some models require accepting terms on HuggingFace before they're
downloadable at all -- `google/gemma-2-9b-it` is one. That needs a
HuggingFace access token.

1. Visit the model's page on HuggingFace and accept the license terms,
   if you haven't already.
2. Generate a token at
   [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
   -- a read-only token is enough.
3. Set it in your system `config.toml`:

   ```toml
   [environment]
   HF_TOKEN = "hf_..."
   ```

   Or, for a single run, in your shell before starting the deployment:

   ```bash
   export HF_TOKEN=hf_...
   marigold deployment start marigold-examples/chat
   ```

**This token is used entirely locally.** It's passed straight into the
`cache-init` container, which uses it to authenticate directly with
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

Validate, same as before, then start:

```bash
marigold cache validate marigold-examples/chat/models.yaml
marigold deployment start marigold-examples/chat
```

If the token's missing or the terms haven't been accepted, `cache-init`'s logs will show the download failing with an authentication error.
