#!/usr/bin/env python3
"""Convert a Devpost project export into a HackJudge team-import CSV.

    python3 scripts/devpost_to_hackjudge.py ~/Downloads/projects-....csv
    python3 scripts/devpost_to_hackjudge.py export.csv --include-drafts

Writes <export>-hackjudge.csv next to the export and prints a report. The
report never prints names or emails; it lists track and prize answers that
did not map so the tables below can be adjusted before importing.

Only submitted projects are converted unless --include-drafts is given.
Every listed teammate email becomes an entrant email, so HackJudge keeps
entrants from judging their own project.
"""

import argparse
import csv
import re
import sys
from collections import Counter
from pathlib import Path

# Devpost track answer (lowercased, any substring) -> HackJudge track name.
TRACKS = [
    ("art", "Art & Design"),
    ("design", "Art & Design"),
    ("health", "Health & BioTech"),
    ("bio", "Health & BioTech"),
    ("college", "College Hack"),
]

# Devpost yes/no question column -> HackJudge prize name.
PRIZE_QUESTIONS = {
    "Lovable Opt In": "Best Use of Lovable",
    "Bu Libraries": "Best Use of BU Libraries Resources",
}

# Devpost "Opt-In Prize" values (lowercased, any substring) -> HackJudge prize.
OPT_IN_PRIZES = [
    ("lovable", "Best Use of Lovable"),
    ("librar", "Best Use of BU Libraries Resources"),
    ("first-time", "Best First-Time Hacker"),
    ("first time", "Best First-Time Hacker"),
    ("first-year", "Best First-Year Hacker"),
    ("first year", "Best First-Year Hacker"),
]

TRACK_COLUMN = "What Is Your Teams Track?"
MEMBER_START_COLUMN = "Team Member 1 First Name"
NO_ANSWERS = {"", "no", "n", "false", "none", "n/a", "na", "0", "-"}


def map_track(answer):
    lowered = answer.strip().lower()
    for needle, track in TRACKS:
        if needle in lowered:
            return track
    return None


def map_opt_in_prizes(answer):
    found, unmapped = [], []
    for part in re.split(r"[,;\n]", answer):
        part = part.strip()
        if not part:
            continue
        match = next((prize for needle, prize in OPT_IN_PRIZES if needle in part.lower()), None)
        (found if match else unmapped).append(match or part)
    return found, unmapped


def members_of(row, header):
    """Submitter plus teammates. Devpost labels only the first teammate's
    columns; later teammates follow as unlabeled first/last/email triples."""
    people = []
    get = lambda col: row[header.index(col)].strip() if header.index(col) < len(row) else ""
    people.append((get("Submitter First Name"), get("Submitter Last Name"), get("Submitter Email")))
    start = header.index(MEMBER_START_COLUMN)
    for i in range(start, len(row), 3):
        first, last, email = (row[i:i + 3] + ["", "", ""])[:3]
        if first.strip() or last.strip() or email.strip():
            people.append((first.strip(), last.strip(), email.strip()))
    return people


def github_link(links):
    for link in re.split(r"[\s,]+", links):
        if "github.com" in link.lower():
            return link.strip()
    return ""


def convert(path, include_drafts):
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    header, data = rows[0], rows[1:]
    col = {name: i for i, name in enumerate(header)}

    def cell(row, name):
        i = col.get(name)
        return row[i].strip() if i is not None and i < len(row) else ""

    out, report = [], Counter()
    unmapped_tracks, unmapped_prizes, other_questions = Counter(), Counter(), Counter()
    missing_track = 0
    for row in data:
        status = cell(row, "Project Status")
        report[f"status: {status or '(blank)'}"] += 1
        if status.lower() != "submitted" and not include_drafts:
            continue

        track_answer = cell(row, TRACK_COLUMN)
        track = map_track(track_answer)
        if track_answer and not track:
            unmapped_tracks[track_answer] += 1
        if not track:
            missing_track += 1

        prizes = []
        for question, prize in PRIZE_QUESTIONS.items():
            if cell(row, question).lower() not in NO_ANSWERS:
                prizes.append(prize)
        found, unmapped = map_opt_in_prizes(cell(row, "Opt-In Prize"))
        prizes += found
        for value in unmapped:
            unmapped_prizes[value] += 1
        if cell(row, "Figma").lower() not in NO_ANSWERS:
            other_questions["Figma (no HackJudge prize)"] += 1

        people = members_of(row, header)
        out.append({
            "name": cell(row, "Project Title"),
            "track": track or "",
            "description": cell(row, "About The Project"),
            "members": "; ".join(" ".join(p for p in (first, last) if p) for first, last, _ in people if first or last),
            "entrantEmails": "; ".join(email for *_, email in people if email),
            "projectUrl": cell(row, "Submission Url"),
            "githubUrl": github_link(cell(row, '"Try it out" Links')),
            "prizes": "; ".join(dict.fromkeys(prizes)),
        })

    target = path.with_name(path.stem + "-hackjudge.csv")
    with open(target, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(out[0].keys()) if out else ["name", "track"])
        writer.writeheader()
        writer.writerows(out)

    print(f"Read {len(data)} Devpost projects: " + ", ".join(f"{k} ({v})" for k, v in sorted(report.items())))
    print(f"Wrote {len(out)} teams to {target}")
    print("Tracks: " + ", ".join(f"{t} ({n})" for t, n in Counter(r["track"] or "(none)" for r in out).items()))
    print("Prize entries: " + (", ".join(f"{p} ({n})" for p, n in Counter(p for r in out for p in r["prizes"].split("; ") if p).items()) or "none"))
    if missing_track:
        print(f"! {missing_track} team(s) have no mappable track; HackJudge requires one. Fix them in the CSV or extend TRACKS.")
    for answer, n in unmapped_tracks.items():
        print(f"! Unmapped track answer: {answer!r} ({n})")
    for answer, n in unmapped_prizes.items():
        print(f"! Unmapped Opt-In Prize value: {answer!r} ({n})")
    for note, n in other_questions.items():
        print(f"! {note}: {n} team(s) answered yes")
    return target


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("export", type=Path)
    parser.add_argument("--include-drafts", action="store_true")
    args = parser.parse_args()
    if not args.export.is_file():
        sys.exit(f"No such file: {args.export}")
    convert(args.export, args.include_drafts)


if __name__ == "__main__":
    main()
