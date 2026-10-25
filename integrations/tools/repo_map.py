#!/usr/bin/env python3
"""Read-only inventory of a repository, for handing to an assistant.

Prints: identity, layout, Python API surface, CLI commands, HTTP routes,
dependencies, tests, workflows, docs, data files, and a domain keyword scan.
Standard library only. Never writes to the repository.
"""

from __future__ import annotations

import ast
import json
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

SKIP_DIRS = {
    ".git", ".hg", ".svn", "node_modules", "dist", "build", "__pycache__",
    ".venv", "venv", "env", ".mypy_cache", ".pytest_cache", ".ruff_cache",
    ".tox", ".git-crypt", ".idea", ".vscode", "htmlcov", ".eggs", "site-packages",
}
SKIP_SUFFIX = {
    ".pyc", ".pyo", ".so", ".dylib", ".dll", ".exe", ".bin", ".zip", ".gz",
    ".tar", ".whl", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico",
    ".mp4", ".mov", ".woff", ".woff2", ".ttf", ".otf", ".db", ".sqlite",
}
BIG_FILE_BYTES = 400_000
MAX_PER_DIR = 14
DOMAIN_TERMS = [
    "stitch", "round", "row", "increase", "decrease", "amigurumi", "gauge",
    "tension", "yarn", "hook", "chain", "chart", "photo", "vision", "pdf",
    "validate", "validation", "parse", "parser", "simulat", "render", "gauge",
    "parity", "provenance", "warning", "error", "report", "score",
]


def sh(*args: str, cwd: Path) -> str:
    try:
        out = subprocess.run(
            args, cwd=cwd, capture_output=True, text=True, timeout=20
        )
        return (out.stdout or "").strip()
    except Exception:
        return ""


def human(size: int) -> str:
    value = float(size)
    for unit in ("B", "K", "M", "G"):
        if value < 1024 or unit == "G":
            return f"{value:.0f}{unit}" if unit == "B" else f"{value:.1f}{unit}"
        value /= 1024
    return f"{size}B"


def walk(root: Path) -> list[Path]:
    found: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(
            d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".crochet_")
        )
        for name in sorted(filenames):
            path = Path(dirpath) / name
            if path.suffix.lower() in SKIP_SUFFIX:
                continue
            found.append(path)
    return found


def section(title: str) -> None:
    print()
    print("=" * 74)
    print(title)
    print("=" * 74)


def first_line(text: str | None, limit: int = 150) -> str:
    if not text:
        return ""
    line = " ".join(text.strip().split())
    return line[:limit] + ("..." if len(line) > limit else "")


# ---------------------------------------------------------------- python ast


def read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return ""


def decorator_names(node: ast.AST) -> list[str]:
    """Renders decorators as text, e.g. app.get("/x") or click.option."""
    names: list[str] = []
    for dec in getattr(node, "decorator_list", []):
        target = dec.func if isinstance(dec, ast.Call) else dec
        try:
            rendered = ast.unparse(target)
        except Exception:
            continue
        if isinstance(dec, ast.Call):
            try:
                args = ", ".join(ast.unparse(a) for a in dec.args[:2])
            except Exception:
                args = ""
            rendered = f"{rendered}({args})"
        names.append(rendered)
    return names


def describe_module(path: Path, root: Path) -> dict:
    text = read(path)
    info = {
        "path": str(path.relative_to(root)),
        "loc": len(text.splitlines()),
        "doc": "",
        "classes": [],
        "functions": [],
        "commands": [],
        "routes": [],
        "all": [],
        "error": "",
    }
    try:
        tree = ast.parse(text)
    except SyntaxError as exc:
        info["error"] = f"SyntaxError: {exc.msg} (line {exc.lineno})"
        return info

    info["doc"] = first_line(ast.get_docstring(tree) or "")

    for node in tree.body:
        if isinstance(node, ast.ClassDef):
            bases = [ast.unparse(b) for b in node.bases][:2]
            info["classes"].append(
                f"{node.name}({', '.join(bases)})" if bases else node.name
            )
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            args = [a.arg for a in node.args.args if a.arg not in ("self", "cls")]
            info["functions"].append(f"{node.name}({', '.join(args[:4])})")
            decs = decorator_names(node)
            for dec in decs:
                route = re.match(r'app\.(get|post|put|delete|patch)\((.+)\)', dec)
                if route:
                    info["routes"].append(f"{route.group(1).upper():6} {route.group(2)}")
                elif ".command" in dec or dec.startswith("command"):
                    info["commands"].append(dec)
        elif isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "__all__":
                    try:
                        info["all"] = [ast.literal_eval(node.value)]
                    except Exception:
                        pass
    if info["all"]:
        info["all"] = info["all"][0] if isinstance(info["all"][0], list) else []
    return info


# -------------------------------------------------------------------- report


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    brief = "--brief" in sys.argv
    start = Path(args[0] if args else ".").resolve()
    root_text = sh("git", "rev-parse", "--show-toplevel", cwd=start)
    root = Path(root_text) if root_text else start

    files = walk(root)
    total_bytes = sum(f.stat().st_size for f in files if f.exists())
    by_suffix: Counter[str] = Counter()
    for f in files:
        by_suffix[f.suffix.lower() or "(none)"] += 1

    section("1. IDENTITY")
    print(f"root        : {root}")
    print(f"remote      : {sh('git', 'config', '--get', 'remote.origin.url', cwd=root)}")
    print(f"branch      : {sh('git', 'rev-parse', '--abbrev-ref', 'HEAD', cwd=root)}")
    print(f"commit      : {sh('git', 'log', '-1', '--format=%h %ad %s', '--date=short', cwd=root)}")
    print(f"tags        : {len(sh('git', 'tag', cwd=root).splitlines())} (latest: {(sh('git','tag','--sort=-creatordate',cwd=root).splitlines() or ['none'])[0]})")
    print(f"tracked size: {human(total_bytes)} across {len(files)} files")
    print("file types  : " + ", ".join(f"{s}×{n}" for s, n in by_suffix.most_common(12)))

    section("2. LAYOUT")
    print("root files:")
    root_files = sorted(
        f for f in root.iterdir()
        if f.is_file() and f.suffix.lower() not in SKIP_SUFFIX and not f.name.startswith(".")
    )
    for f in root_files[:MAX_PER_DIR]:
        print(f"  {f.name} ({human(f.stat().st_size)})")
    if len(root_files) > MAX_PER_DIR:
        print(f"  ... {len(root_files) - MAX_PER_DIR} more")

    print("\ntop-level directories:")
    for d in sorted(p for p in root.iterdir() if p.is_dir() and p.name not in SKIP_DIRS and not p.name.startswith(".")):
        inner = [f for f in walk(d)]
        subdirs = [p for p in d.iterdir() if p.is_dir() and p.name not in SKIP_DIRS]
        size = sum(f.stat().st_size for f in inner if f.exists())
        note = f", {len(subdirs)} subdirs" if subdirs else ""
        print(f"  {d.name}/  [{len(inner)} files, {human(size)}{note}]")
        if 0 < len(subdirs) <= 8:
            print(f"      subdirs: {', '.join(sorted(p.name for p in subdirs))}")
        elif len(subdirs) > 8:
            names = sorted(p.name for p in subdirs)
            print(f"      subdirs: {', '.join(names[:4])}, ... {len(names) - 4} more")

    section("3. PYTHON MODULES")
    py_files = [f for f in files if f.suffix == ".py"]
    modules = [describe_module(f, root) for f in py_files]
    by_dir: dict[str, list[dict]] = defaultdict(list)
    for m in modules:
        parent = str(Path(m["path"]).parent)
        by_dir[parent].append(m)

    for parent in sorted(by_dir):
        group = by_dir[parent]
        total = sum(g["loc"] for g in group)
        print(f"\n{parent}/  ({len(group)} modules, {total} lines)")
        line = "  "
        for g in sorted(group, key=lambda x: x["path"]):
            name = Path(g["path"]).stem
            entry = f"{name}({g['loc']})"
            if len(line) + len(entry) > 72:
                print(line)
                line = "  "
            line += entry + "  "
        if line.strip():
            print(line)

    print("\n-- notable modules (docstring) --")
    notable = [m for m in modules if m["doc"] and not m["path"].startswith("tests/")]
    for m in sorted(notable, key=lambda x: -x["loc"])[: (8 if brief else 22)]:
        print(f"\n{m['path']}  [{m['loc']}]")
        print(f"  {m['doc']}")
        if m["classes"]:
            print(f"  classes: {', '.join(m['classes'][:8])}")
        if m["error"]:
            print(f"  !! {m['error']}")

    section("4. CLI COMMANDS AND HTTP ROUTES")
    commands = sorted({c for m in modules for c in m["commands"]})
    routes = sorted({r for m in modules for r in m["routes"]})
    print(f"cli commands ({len(commands)}):")
    for c in commands:
        print(f"  {c}")
    if not commands:
        print("  (none found)")
    print(f"\nhttp routes ({len(routes)}):")
    for r in routes:
        print(f"  {r}")
    if not routes:
        print("  (none found)")

    section("5. DEPENDENCIES AND ENTRY POINTS")
    pyproject = root / "pyproject.toml"
    if pyproject.exists():
        text = read(pyproject)
        for key in ("[project.scripts]", "[project.optional-dependencies]", "dependencies"):
            if key.startswith("dependencies"):
                match = re.search(r"^dependencies\s*=\s*\[(.*?)\]", text, re.S | re.M)
                if match:
                    deps = re.findall(r'"([^"]+)"', match.group(1))
                    print(f"dependencies ({len(deps)}): {', '.join(deps)}")
                continue
            if key in text:
                start_idx = text.index(key)
                block = text[start_idx:].split("\n[", 1)[0]
                print(block.strip())
    for req in ("requirements.txt", "requirements-dev.txt"):
        path = root / req
        if path.exists():
            lines = [l.strip() for l in read(path).splitlines() if l.strip() and not l.startswith("#")]
            print(f"{req} ({len(lines)}): {', '.join(lines)}")

    section("6. TESTS")
    test_files = [f for f in py_files if f.name.startswith("test_") or f.parent.name == "tests"]
    test_funcs = sum(len(re.findall(r"^\s*def test_", read(f), re.M)) for f in test_files)
    print(f"test files: {len(test_files)} | test functions: {test_funcs}")
    grouped: dict[str, int] = Counter()
    for f in test_files:
        grouped[str(Path(f.relative_to(root)).parent)] += len(
            re.findall(r"^\s*def test_", read(f), re.M)
        )
    for where, count in sorted(grouped.items()):
        print(f"  {where}/  {count} tests")
    js_tests = [f for f in files if re.search(r"\.(test|spec)\.(ts|tsx|js)$", f.name)]
    if js_tests:
        print(f"js/ts test files: {len(js_tests)}")

    section("7. CI WORKFLOWS")
    for wf in sorted((root / ".github" / "workflows").glob("*.yml")) + sorted((root / ".github" / "workflows").glob("*.yaml")):
        text = read(wf)
        name = re.search(r"^name:\s*(.+)$", text, re.M)
        runs = re.findall(r"run:\s*(.+)", text)[:6]
        print(f"\n{wf.name}  {('- ' + name.group(1).strip()) if name else ''}")
        for cmd in runs:
            print(f"    $ {cmd.strip()[:110]}")

    section("8. DOCS AND DATA FILES")
    docs = sorted((root / "docs").rglob("*")) if (root / "docs").exists() else []
    doc_files = [d for d in docs if d.is_file() and d.suffix in {".md", ".rst", ".txt"}]
    print(f"documents: {len(doc_files)}")
    for d in doc_files[:10]:
        head = next((l for l in read(d).splitlines() if l.strip().startswith("#")), "")
        print(f"  {d.relative_to(root)}  {head[:80]}")
    readme = root / "README.md"
    if readme.exists():
        heads = re.findall(r"^#{2,3}\s+(.+)$", read(readme), re.M)
        print(f"\nREADME sections ({len(heads)}): {', '.join(h.strip()[:40] for h in heads[:18])}")

    data_files = [f for f in files if f.suffix in {".json", ".yaml", ".yml", ".toml", ".csv"} and ".github" not in str(f)]
    print(f"\ndata/config files: {len(data_files)}")
    for f in sorted(data_files, key=lambda p: p.stat().st_size if p.exists() else 0, reverse=True)[:8]:
        size = f.stat().st_size if f.exists() else 0
        keys = ""
        if f.suffix == ".json" and 0 < size < 200_000:
            try:
                payload = json.loads(read(f))
                if isinstance(payload, dict):
                    keys = " keys=" + ", ".join(list(payload)[:6])
                elif isinstance(payload, list):
                    keys = f" list[{len(payload)}]"
            except Exception:
                keys = " (unparseable json)"
        print(f"  {f.relative_to(root)} ({human(size)}){keys}")

    if brief:
        print()
        print("=" * 74)
        print("END OF REPORT")
        return 0

    section("9. DOMAIN TERM FREQUENCY (source only)")
    source_text = "\n".join(read(f) for f in py_files if "tests/" not in str(f)).lower()
    counts = Counter({t: len(re.findall(t, source_text)) for t in set(DOMAIN_TERMS)})
    print("  " + ", ".join(f"{t}×{n}" for t, n in counts.most_common(18) if n))

    section("10. LARGEST SOURCE FILES")
    for f in sorted(py_files, key=lambda p: p.stat().st_size if p.exists() else 0, reverse=True)[:8]:
        print(f"  {human(f.stat().st_size)}  {f.relative_to(root)}  ({len(read(f).splitlines())} lines)")

    stray = [m["path"] for m in modules if m["error"]]
    if stray:
        print("\nfiles that do not parse:")
        for path in stray:
            print(f"  {path}")

    print()
    print("=" * 74)
    print("END OF REPORT")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
