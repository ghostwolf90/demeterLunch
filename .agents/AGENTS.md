# 好好吃飯 — Agent Instructions

Before starting any task, read the following files when present:

1. **`PROJECT_OVERVIEW.md`** — Product vision, architecture decisions, and constraints.
2. **`PHASES.md`** — Build phases, acceptance criteria, and current progress.
3. **`AGENTS.md`** at the project root — authoritative project constraints.

## World map

```text
.agents/skills/       Project skills
AGENTS.md            Project rules
README.md            Operations and publishing guide
web/                 Editable public website
app/                 Web routes and account APIs
lib/                 Authentication, profiles, school and service integrations
db/                  D1 schema
drizzle/             Generated database migrations
src/                 Python collection, parsing, analysis and local server
scripts/             Data, static site and release builds
data/                Raw sources, reviewed JSON and SQLite
tests/               Python tests
tests-worker/        Worker tests
dist/                Generated deployment output
.openai/             Release metadata and Site configuration
```

### Architecture diagram

```text
[School feeds / official records]
              | src/: collect and parse
              v
[data/: reviewed JSON] -> [scripts/: SQLite and static builds]
                                       |
                                       v
[web/: lunch, dinner, passport UI] <-> [app/ + lib/: account and school APIs]
                                       |
                                       v
                          [D1: profiles and food encounters]
                          [R2: private avatar files]

[scripts/: release build] -> [dist/: deployment snapshot]
```

## Planned structure (not yet built)

TODO: Record future structure only after its scope is established.

## Key decisions to respect

- Brand: 好好吃飯｜孩子午餐，晚餐靈感.
- Follow root `AGENTS.md`; preserve existing work.
- Reviewed JSON is the source of truth; rebuild SQLite after data changes.
- Public frontend source lives in `web/`; browser code has zero dependencies.
- Store account and child information in D1 and avatar files in R2.
- Browser automation is prohibited; use HTTP, source inspection and tests.
- Publish only to the existing Site, preserving remote data and release rules.
