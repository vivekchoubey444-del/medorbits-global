#!/usr/bin/env python3
"""MedOrbits safe, resumable repository task runner. Python 3.10+.

Run:
  python tools/continuous_runner.py
  python tools/continuous_runner.py --resume --retry-failed
  python tools/continuous_runner.py --list

Only known repository_manager.py tasks and local read-oriented checks are run.
This runner does not delete, reset, force-overwrite, commit, push, deploy, or install.
"""
from __future__ import annotations
import argparse
import datetime as dt
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

VERSION = "1.0.0"
RETRIES = 2
DELAY = 3
TIMEOUT = 900
EXCLUDED = {".git", "node_modules", ".venv", "venv", "__pycache__",
            ".pytest_cache", ".ruff_cache", "dist", "build", ".expo",
            ".medorbits-runner"}

def now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")

def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + f".tmp-{os.getpid()}")
    temp.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    os.replace(temp, path)

class Runner:
    def __init__(self, root, args):
        self.root = root.resolve()
        self.args = args
        self.manager = self.root / "tools" / "repository_manager.py"
        self.state_dir = self.root / ".medorbits-runner"
        self.state_file = self.state_dir / "state.json"
        self.log_file = self.state_dir / "runner.log"
        self.report_dir = self.root / "reports" / "continuous-runner"
        self.run_id = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
        self.state = {"schema_version": 1, "runner_version": VERSION, "jobs": {}}
        self.help_text = {}

    def log(self, message):
        line = f"[{now()}] {message}"
        print(line, flush=True)
        self.state_dir.mkdir(parents=True, exist_ok=True)
        with self.log_file.open("a", encoding="utf-8") as stream:
            stream.write(line + "\n")

    def save(self):
        self.state["updated_at"] = now()
        atomic_json(self.state_file, self.state)

    def load(self):
        if not self.args.resume or not self.state_file.exists():
            return
        try:
            old = json.loads(self.state_file.read_text(encoding="utf-8"))
            if old.get("schema_version") == 1 and isinstance(old.get("jobs"), dict):
                self.state = old
                self.log("Loaded previous checkpoint.")
        except (OSError, json.JSONDecodeError) as exc:
            self.log(f"Could not read checkpoint; starting fresh: {exc}")

    def command(self, label, cmd, timeout=TIMEOUT):
        self.log(f"START {label}: {cmd!r}")
        env = os.environ.copy()
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        try:
            result = subprocess.run(
                cmd, cwd=self.root, env=env, stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                errors="replace", timeout=timeout, check=False)
            output = result.stdout or ""
            if output:
                print(output, end="" if output.endswith("\n") else "\n")
            self.log(f"END {label}: exit={result.returncode}")
            return result.returncode, output
        except subprocess.TimeoutExpired as exc:
            output = exc.stdout or ""
            if isinstance(output, bytes):
                output = output.decode("utf-8", errors="replace")
            self.log(f"TIMEOUT {label} after {timeout}s")
            return 124, output
        except OSError as exc:
            self.log(f"ERROR {label}: {exc}")
            return 127, str(exc)

    def job(self, key, title, cmd, optional=True):
        old = self.state.setdefault("jobs", {}).get(key, {})
        if self.args.resume and old.get("status") == "success" and not self.args.retry_all:
            self.log(f"SKIP {title}: already successful in checkpoint.")
            return True
        if (self.args.resume and old.get("status") == "failed"
                and not (self.args.retry_failed or self.args.retry_all)):
            self.log(f"SKIP {title}: previously failed; use --retry-failed.")
            return False
        record = {"title": title, "command": cmd, "status": "running",
                  "started_at": now(), "attempts": 0}
        self.state["jobs"][key] = record
        self.save()
        for attempt in range(1, RETRIES + 2):
            record["attempts"] = attempt
            self.save()
            code, output = self.command(f"{title} ({attempt}/{RETRIES + 1})", cmd)
            record["exit_code"] = code
            record["output_tail"] = output[-4000:]
            if code == 0:
                record["status"] = "success"
                record["finished_at"] = now()
                self.save()
                return True
            if attempt <= RETRIES:
                self.log(f"Retrying {title} after {DELAY}s.")
                time.sleep(DELAY)
        record["status"] = "failed"
        record["finished_at"] = now()
        self.save()
        self.log(f"{'OPTIONAL ' if optional else ''}JOB FAILED: {title}; continuing.")
        return False

    def inspect_manager(self):
        if not self.manager.is_file():
            self.log(f"Repository manager not found: {self.manager}")
            return False
        code, output = self.command("repository-manager-help",
                                    [sys.executable, str(self.manager), "--help"], 60)
        if code:
            self.log("Could not inspect repository manager help; skipping manager tasks.")
            return False
        for sub in ("inspect", "validate", "pages", "audit-pages", "organize"):
            subcode, subhelp = self.command(
                f"repository-manager-{sub}-help",
                [sys.executable, str(self.manager), sub, "--help"], 60)
            if subcode == 0:
                self.help_text[sub] = subhelp
        return True

    def manager_job(self, sub, key, args, title):
        help_output = self.help_text.get(sub)
        if help_output is None:
            self.log(f"SKIP {title}: command help unavailable.")
            return True
        for option in args:
            if option.startswith("--") and option not in help_output:
                self.log(f"SKIP {title}: {option} not advertised by help.")
                return True
        return self.job(key, title,
                        [sys.executable, str(self.manager), sub, *args])

    def python_check(self):
        roots = [n for n in ("tools", "python", "scripts", "tests")
                 if (self.root / n).is_dir()]
        if not roots:
            self.log("SKIP Python syntax: no known Python directories.")
            return True
        checker = "\n".join([
            "import pathlib, sys",
            f"excluded = {sorted(EXCLUDED)!r}",
            "errors, count = [], 0",
            "for name in sys.argv[1:]:",
            "    for path in pathlib.Path(name).rglob('*.py'):",
            "        if any(part in excluded for part in path.parts): continue",
            "        try: compile(path.read_bytes(), str(path), 'exec'); count += 1",
            "        except Exception as exc: errors.append(f'{path}: {type(exc).__name__}: {exc}')",
            "print(f'Python files syntax-checked: {count}')",
            "if errors: print('\\n'.join(errors)); sys.exit(1)",
        ])
        return self.job("python-syntax", "Python syntax check (no bytecode writes)",
                         [sys.executable, "-c", checker, *roots])

    def json_check(self):
        checker = "\n".join([
            "import json, pathlib, sys",
            f"excluded = {sorted(EXCLUDED)!r}",
            "errors, count = [], 0",
            "for path in pathlib.Path('.').rglob('*.json'):",
            "    if any(part in excluded for part in path.parts): continue",
            "    try: json.loads(path.read_text(encoding='utf-8')); count += 1",
            "    except (OSError, UnicodeError, json.JSONDecodeError) as exc: errors.append(f'{path}: {exc}')",
            "print(f'JSON files checked: {count}')",
            "if errors: print('\\n'.join(errors)); sys.exit(1)",
        ])
        return self.job("json-validation", "Repository JSON validation",
                         [sys.executable, "-c", checker])

    def list_jobs(self):
        print(f"MedOrbits Continuous Runner {VERSION}")
        for item in (
            "repository_manager.py inspect",
            "repository_manager.py validate with unique report path, if supported",
            "repository_manager.py pages --discover, if supported",
            "repository_manager.py audit-pages, if supported",
            "repository_manager.py organize preview, if supported",
            "Python syntax check without bytecode writes",
            "JSON validation",
            "pytest if installed and tests/ exists",
            "Ruff if installed",
        ):
            print(f"- {item}")
        print("Page generation is excluded unless --apply-pages is explicitly passed.")
        return 0

    def run(self):
        if self.args.list:
            return self.list_jobs()
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.report_dir.mkdir(parents=True, exist_ok=True)
        self.load()
        self.log(f"MedOrbits runner {VERSION} starting in {self.root}")
        self.log("Safe mode: no deletion, reset, force-overwrite, commit, push, deployment, or installation.")
        results = []
        if self.inspect_manager():
            results.append(("inspect", self.manager_job(
                "inspect", "manager-inspect", [], "Repository inspection")))
            validate_args = []
            if "--json-report" in self.help_text.get("validate", ""):
                report = self.report_dir / f"repository-report-{self.run_id}.json"
                validate_args = ["--json-report", str(report.relative_to(self.root))]
            results.append(("validate", self.manager_job(
                "validate", "manager-validate", validate_args, "Repository validation")))
            results.append(("pages-discover", self.manager_job(
                "pages", "manager-pages-discover", ["--discover"], "Page discovery")))
            results.append(("audit-pages", self.manager_job(
                "audit-pages", "manager-audit-pages", [], "Page audit")))
            results.append(("organize-preview", self.manager_job(
                "organize", "manager-organize-preview", [], "Organization preview")))
        results.append(("python-syntax", self.python_check()))
        results.append(("json-validation", self.json_check()))
        if (self.root / "tests").is_dir() and shutil.which("pytest"):
            results.append(("pytest", self.job("pytest", "Pytest suite", ["pytest", "-q"])))
        else:
            self.log("SKIP pytest: pytest unavailable or tests/ missing; no installation attempted.")
        if shutil.which("ruff"):
            results.append(("ruff", self.job("ruff", "Ruff static analysis", ["ruff", "check"])))
        else:
            self.log("SKIP Ruff: not installed; no installation attempted.")
        if self.args.apply_pages:
            if "--apply" in self.help_text.get("pages", ""):
                results.append(("pages-apply", self.manager_job(
                    "pages", "manager-pages-apply", ["--apply"], "Explicit page generation")))
            else:
                self.log("SKIP page generation: manager help does not advertise --apply.")
        success = sum(1 for _, ok in results if ok)
        failed = len(results) - success
        summary = {
            "run_id": self.run_id, "finished_at": now(),
            "success_count": success, "failure_count": failed,
            "results": [{"job": name, "success": ok} for name, ok in results],
        }
        summary_path = self.report_dir / f"summary-{self.run_id}.json"
        atomic_json(summary_path, summary)
        self.state["last_summary"] = summary
        self.save()
        self.log(f"Finished: {success} successful; {failed} failed.")
        self.log(f"Summary: {summary_path.relative_to(self.root)}")
        return 1 if failed else 0

def main():
    parser = argparse.ArgumentParser(description="Safe, resumable MedOrbits task runner.")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--resume", action="store_true", help="Load saved checkpoints.")
    parser.add_argument("--retry-failed", action="store_true", help="Retry failed jobs when resuming.")
    parser.add_argument("--retry-all", action="store_true", help="Run every job again.")
    parser.add_argument("--list", action="store_true", help="List jobs without running them.")
    parser.add_argument("--apply-pages", action="store_true",
                        help="Explicitly request pages --apply if supported.")
    args = parser.parse_args()
    runner = Runner(args.root.resolve(), args)
    try:
        return runner.run()
    except KeyboardInterrupt:
        runner.log("Interrupted. Checkpoints are saved; resume with --resume --retry-failed.")
        return 130
    except Exception as exc:
        runner.log(f"Unexpected failure: {type(exc).__name__}: {exc}")
        runner.log("Resume with --resume --retry-failed after reviewing the log.")
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
