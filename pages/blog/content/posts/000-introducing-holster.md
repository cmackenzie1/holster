---
title: 'Holster: A Cloudflare Workers Monorepo'
date: 2022-09-12T21:46:24-07:00
slug: 'introducing-holster'
draft: false
---

## Introduction

[Holster](https://github.com/cmackenzie1/holster) is a monorepo containing a collection
of [Cloudflare Workers](https://workers.dev) written in [TypeScript](https://www.typescriptlang.org/) and managed
using [Lerna](https://lerna.js.org/). In this post I'll go through the structure of the repo and why I decided to go
with a monorepo. In future posts I hope to write about the all the individual Workers I maintain in the repo.

## Project Layout

The layout of the project consists of the common set of files to configure TypeScript and Prettier. The `workers/`
directory contains the code and wrangler configuration for each of the workers.
Every new worker is templated using a Go program that is derived from the initial project template provided
by `wrangler init`.

```bash
.
|-- .gitattributes # excludes package-lock.json from `git diff`
|-- .gitignore
|-- .prettierignore
|-- .prettierrc
|-- .templates
|   `-- {{ .WorkerName }} # Worker template using Go's template language
|       |-- __tests__
|       |   `-- hello.test.ts
|       |-- build.mjs
|       |-- jest.config.js
|       |-- package.json
|       |-- src
|       |   `-- index.ts
|       |-- tsconfig.json
|       `-- wrangler.toml
|-- README.md
|-- cmd
|   `-- template
|       `-- main.go # App to generate a new worker.
|-- lerna.json
|-- package-lock.json
|-- package.json
|-- pages
|   `-- blog # you are reading it!
|-- tsconfig.json
`-- workers
    `-- hello-world
       |-- __tests__
       |   `-- hello.test.ts
       |-- build.mjs
       |-- dist # bundled js output from `esbuild`
       |   |-- index.mjs
       |   `-- index.mjs.map
       |-- jest.config.js
       |-- package.json
       |-- src
       |   `-- index.ts # the main entrypoint for the worker
       |-- tsconfig.json
       `-- wrangler.toml
```

## Why I built this?

Since joining Cloudflare in Spring 2021 I have had the opportunity to develop new applications built using Workers. One
of
which is [Instant Logs](https://blog.cloudflare.com/how-we-built-instant-logs/), a Worker that streams HTTP request logs
directly to your browser from Cloudflare's Edge in real-time! At first though, I will admit, I was originally sceptical
of
what one could create with just a small amount of CPU and memory. I had the assumption that Workers was only great for
modifying requests on the fly but oh my was I wrong.

However, throughout my hobby projects and professional work I began getting annoyed with the effort it required to get a
new Worker project setup that was configured with the same project structure and settings as the rest of the projects.

Additionally, as the projects have grown and matured they have also required the need to use new bundlers. Keeping these
changes in sync across multiple repos became a hassle and the slight inconsistencies between the projects made it harder
for other developers on the team to jump in and add some features or fix a bug. The JavaScript ecosystem is already
known for its inconsistent tooling and these differences were just adding to the cost of maintenance.

## Bonus: Cloudflare Pages

The project is not only limited to managing Workers either. The `pages/` directory contains the source code for projects
deployed using [Cloudflare Pages](https://pages.dev). While these follow a less strict template, it is still nice to
have all my projects in one location :)

For the latest code, visit [`cmackenzie1/holster`](https://github.com/cmackenzie1/holster) on GitHub.

Happy Hacking.
