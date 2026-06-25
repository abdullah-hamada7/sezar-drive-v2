#!/usr/bin/env python3
"""Run XML user-journey specs on a connected Android device via ADB.

Follows the android-ui-journey-testing skill:
  - Sequential actions and assertions
  - Fail fast on first failure
  - JSON outcome report on stdout

Usage:
  python3 mobile/test/journeys/run_journey.py mobile/test/journeys/driver_login_smoke.xml
  adb devices   # ensure a device is connected first
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


ADB = ["adb"]
DUMP_PATH = "/sdcard/window_dump.xml"
ACTION_SLEEP_S = 1.5


@dataclass
class StepResult:
    action: str
    status: str
    commands: list[str] = field(default_factory=list)
    comment: str = ""


def adb(*args: str, check: bool = False) -> subprocess.CompletedProcess[str]:
    cmd = ADB + list(args)
    return subprocess.run(cmd, capture_output=True, text=True, check=check)


def ensure_device() -> None:
    result = adb("devices")
    lines = [line for line in result.stdout.splitlines()[1:] if line.strip()]
    ready = [line for line in lines if line.endswith("device")]
    if not ready:
        raise RuntimeError("No connected Android device/emulator found (adb devices).")


def dump_ui() -> str:
    adb("shell", "uiautomator", "dump", DUMP_PATH)
    with tempfile.NamedTemporaryFile(suffix=".xml", delete=False) as tmp:
        local_path = tmp.name
    adb("pull", DUMP_PATH, local_path)
    return Path(local_path).read_text(encoding="utf-8", errors="ignore")


def find_bounds_for_text(ui_xml: str, text: str) -> tuple[int, int] | None:
    pattern = re.compile(
        rf'text="{re.escape(text)}"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'
    )
    match = pattern.search(ui_xml)
    if not match:
        pattern2 = re.compile(
            rf'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*text="{re.escape(text)}"'
        )
        match = pattern2.search(ui_xml)
    if not match:
        return None
    x1, y1, x2, y2 = map(int, match.groups())
    return (x1 + x2) // 2, (y1 + y2) // 2


def text_visible(ui_xml: str, text: str) -> bool:
    return text in ui_xml or f'text="{text}"' in ui_xml


def extract_quoted(action: str) -> str | None:
    match = re.search(r'"([^"]+)"', action)
    return match.group(1) if match else None


def run_action(action: str) -> StepResult:
    lower = action.lower().strip()
    commands: list[str] = []

    if lower.startswith("wait"):
        seconds = float(re.findall(r"[\d.]+", action)[0]) if re.findall(r"[\d.]+", action) else 1
        time.sleep(seconds)
        return StepResult(action, "PASSED", [f"sleep {seconds}s"], f"Waited {seconds}s.")

    if lower.startswith("press back"):
        cmd = ADB + ["shell", "input", "keyevent", "4"]
        subprocess.run(cmd, check=False)
        commands.append(" ".join(cmd))
        time.sleep(ACTION_SLEEP_S)
        return StepResult(action, "PASSED", commands, "Back key sent.")

    if lower.startswith("press menu"):
        cmd = ADB + ["shell", "input", "keyevent", "82"]
        subprocess.run(cmd, check=False)
        commands.append(" ".join(cmd))
        time.sleep(ACTION_SLEEP_S)
        return StepResult(action, "PASSED", commands, "Menu key sent.")

    if lower.startswith("tap "):
        label = extract_quoted(action)
        if not label:
            return StepResult(action, "FAILED", commands, "Tap action missing quoted label.")
        ui = dump_ui()
        point = find_bounds_for_text(ui, label)
        if not point:
            return StepResult(action, "FAILED", commands, f'Could not find UI node with text "{label}".')
        x, y = point
        cmd = ADB + ["shell", "input", "tap", str(x), str(y)]
        subprocess.run(cmd, check=False)
        commands.append(" ".join(cmd))
        time.sleep(ACTION_SLEEP_S)
        return StepResult(action, "PASSED", commands, f'Tapped "{label}" at ({x}, {y}).')

    if lower.startswith("type "):
        value = extract_quoted(action)
        if not value:
            return StepResult(action, "FAILED", commands, "Type action missing quoted text.")
        escaped = value.replace(" ", "%s")
        cmd = ADB + ["shell", "input", "text", escaped]
        subprocess.run(cmd, check=False)
        commands.append('adb shell input text "[REDACTED]"')
        time.sleep(ACTION_SLEEP_S)
        return StepResult(action, "PASSED", commands, "Text entered.")

    if lower.startswith("verify ") or lower.startswith("check ") or lower.startswith("ensure "):
        ui = dump_ui()
        not_visible = re.search(r'not visible', lower)
        quoted = extract_quoted(action)
        if quoted:
            visible = text_visible(ui, quoted)
            if not_visible:
                ok = not visible
                msg = f'"{quoted}" is absent as expected.' if ok else f'"{quoted}" was still visible.'
            else:
                ok = visible
                msg = f'"{quoted}" detected in UI hierarchy.' if ok else f'"{quoted}" not found in UI hierarchy.'
            return StepResult(action, "PASSED" if ok else "FAILED", commands, msg)
        return StepResult(action, "FAILED", commands, "Assertion missing quoted text target.")

    return StepResult(action, "FAILED", commands, f"Unsupported action: {action}")


def run_journey(path: Path) -> dict[str, Any]:
    tree = ET.parse(path)
    root = tree.getroot()
    name = root.attrib.get("name", path.stem)
    results: list[StepResult] = []
    failed = False

    for action_el in root.findall(".//action"):
        action = (action_el.text or "").strip()
        if not action:
            continue
        if failed:
            results.append(StepResult(action, "SKIPPED", [], "Previous step failed."))
            continue
        step = run_action(action)
        results.append(step)
        if step.status == "FAILED":
            failed = True

    return {
        "journey": name,
        "file": str(path),
        "results": [step.__dict__ for step in results],
    }


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: run_journey.py <journey.xml>", file=sys.stderr)
        return 2

    path = Path(sys.argv[1])
    if not path.exists():
        print(f"Journey file not found: {path}", file=sys.stderr)
        return 2

    try:
        ensure_device()
        report = run_journey(path)
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"journey": path.stem, "error": str(exc), "results": []}, indent=2))
        return 1

    print(json.dumps(report, indent=2))
    failed = any(r["status"] == "FAILED" for r in report["results"])
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
