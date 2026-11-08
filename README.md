# marigold-web

The source of [marigold.run](https://marigold.run), a Jekyll site.

The documentation under `/docs/` is not kept here. It lives in
[bayinfosys/marigold](https://github.com/bayinfosys/marigold) under
`docs/`, and the build checks it out, together with the marigold README,
whose Quickstart section the home page shows. Change the documentation
there, not here; the checked-out copies are ignored by git.

## Building

GitHub Actions builds and deploys the site (`.github/workflows/site.yml`)
on a push to master, when marigold's docs change, daily, and by hand.

Locally, with a marigold checkout beside this one:

```sh
cp -r ../marigold/docs docs
cp ../marigold/README.md _includes/marigold-readme.md
mkdir -p _site
docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$PWD":/site ghcr.io/bayinfosys/jekyll-site-builder:v0.0.2
python3 -m http.server 8080 -d _site
```

The deployed site builds with GitHub Pages' default plugins, which
render `README.md` as `/docs/` and rewrite links to `.md` files. A local
image without `jekyll-readme-index` and `jekyll-relative-links` shows
those links unrewritten.

## Layout

| Path | Holds |
|---|---|
| `_layouts/doc.html` | documentation pages, with the sidebar |
| `_tutorials/` | worked tutorials |
| `blog/_posts/` | the Build Log; dated, and not edited after publishing |
| `redirects/` | stubs for retired URLs |
| `seo/keyword-map.yml` | target terms per page; not built |
