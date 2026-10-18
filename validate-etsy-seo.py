#!/usr/bin/env python3
"""
Validate the Etsy SEO recommendations in the NovalityStore playbooks against
Etsy's hard listing limits:
  - Title:  max 140 characters
  - Tags:   exactly 13, each max 20 characters
  - Titles must not waste characters on "(PDF Download)" / "(Digital Download)"
    (Etsy badges digital items automatically)

Scans every etsy-q4-playbook*.md in this directory by default.

Usage: python3 validate-etsy-seo.py [file.md ...]
"""
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
TITLE_MAX = 140
TAG_MAX = 20
TAG_COUNT = 13
WASTED = ("(PDF Download)", "(Digital Download)", "(Instant Download)", "(Excel Download)")

docs = [Path(a) for a in sys.argv[1:]] or sorted(HERE.glob("etsy-q4-playbook*.md"))
if not docs:
    print("no playbook files found")
    sys.exit(1)

total_failures = 0
grand_titles = 0
grand_sets = 0

for doc in docs:
    text = doc.read_text(encoding="utf-8")

    titles = [t.strip() for t in re.findall(
        r"\*\*(?:New )?[Tt]itle:\*\*\s*```(.*?)```", text, re.S)]
    tag_sets = []
    for line in re.findall(r"\*\*Tags \(13\):\*\*\s*(.*)", text):
        tag_sets.append([t.strip().strip("`") for t in line.split("·") if t.strip()])

    failures = []
    print(f"\n{'='*74}\n{doc.name}\n{'='*74}")

    print(f"{'#':<4}{'TITLE':<52}{'LEN':>5}  STATUS")
    print("-" * 74)
    for i, t in enumerate(titles, 1):
        bad = [w for w in WASTED if w.lower() in t.lower()]
        ok = len(t) <= TITLE_MAX and not bad
        if len(t) > TITLE_MAX:
            failures.append(f"title #{i}: {len(t)} chars (max {TITLE_MAX})")
        if bad:
            failures.append(f"title #{i}: wasted chars {bad}")
        status = "OK" if ok else (f"TOO LONG" if len(t) > TITLE_MAX else f"WASTED {bad}")
        print(f"{i:<4}{t[:50]:<52}{len(t):>5}  {status}")

    print()
    print(f"{'#':<4}{'TAG SET':<52}{'N':>5}{'MAX':>5}  STATUS")
    print("-" * 74)
    for i, tags in enumerate(tag_sets, 1):
        over = [t for t in tags if len(t) > TAG_MAX]
        dupes = sorted({t for t in tags if tags.count(t) > 1})
        ok = len(tags) == TAG_COUNT and not over and not dupes
        if len(tags) != TAG_COUNT:
            failures.append(f"tag set #{i}: has {len(tags)} tags, expected {TAG_COUNT}")
        for t in over:
            failures.append(f"tag set #{i}: '{t}' is {len(t)} chars (max {TAG_MAX})")
        if dupes:
            failures.append(f"tag set #{i}: duplicate tags {dupes}")
        longest = max(len(t) for t in tags) if tags else 0
        status = "OK" if ok else (", ".join(over) if over else f"count={len(tags)}")
        print(f"{i:<4}{'':<52}{len(tags):>5}{longest:>5}  {status}")

    if len(titles) != len(tag_sets):
        failures.append(f"mismatch: {len(titles)} titles but {len(tag_sets)} tag sets")

    total_failures += len(failures)
    grand_titles += len(titles)
    grand_sets += len(tag_sets)

    print()
    if failures:
        print(f"FAIL — {len(failures)} problem(s):")
        for f in failures:
            print(f"  - {f}")
    else:
        print(f"OK — {len(titles)} titles <= {TITLE_MAX} chars, "
              f"{len(tag_sets)} tag sets x {TAG_COUNT} tags all <= {TAG_MAX} chars")

print(f"\n{'='*74}")
if total_failures:
    print(f"OVERALL FAIL — {total_failures} problem(s) across {len(docs)} file(s)")
    sys.exit(1)
print(f"OVERALL PASS — {grand_titles} titles, {grand_sets} tag sets, "
      f"{len(docs)} file(s), 0 problems")
