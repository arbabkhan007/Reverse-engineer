# Repo inventory tool

`repo_map.py` prints a read-only inventory of a repository so an assistant can understand its
structure without reading every file.

It reports: identity (remote, branch, size, file types), layout, Python modules grouped by package
with docstrings, CLI commands and HTTP routes found via AST, dependencies and entry points, tests
grouped by directory, CI workflows and what they run, docs and data files with their top-level keys,
domain term frequency, and the largest source files.

Standard library only. It never writes to the repository.

## Use

```bash
curl -fsSL -o /tmp/repo_map.py \
  https://raw.githubusercontent.com/arbabkhan007/Reverse-engineer/arena/d54a79c0-reverse-engineer/integrations/tools/repo_map.py

python3 /tmp/repo_map.py .            # full report (about 375 lines)
python3 /tmp/repo_map.py . --brief    # about 300 lines, drops the tail sections
```

Run it from inside the repository you want mapped, or pass a path:

```bash
python3 /tmp/repo_map.py /workspaces/Crochet-Pattern-Checker
```

Output to a file when you want to keep it:

```bash
python3 /tmp/repo_map.py . > /tmp/repo-map.txt
```
