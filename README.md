# TokTickIT

CPE334 Lab 1 project.

## Branch model

```
main               <- stable release (protected)
 lab1-staging      <- integration branch
   feature/1-project-foundation
   feature/2-health-check
   feature/3-category-seed
   feature/4-category-list
```

Never commit directly to `main` or `lab1-staging`. Each Issue is built on its own
`feature/*` branch, opened as a Pull Request into `lab1-staging`. After all four
features are merged, one release PR is opened from `lab1-staging` into `main`.

## Getting started

```
git clone https://github.com/Sxr1n/toktickit.git
cd toktickit
cp .env.example .env
```

## Docs

- [docs/lab-01/reviewer.md](docs/lab-01/reviewer.md) - peer review log for Lab 1
