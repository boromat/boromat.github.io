"""Download the newest polanon wheel from PyPI if it is newer than the one in the browser demo.

Run by .github/workflows/update-polanon.yml. Standard library only. Writes to $GITHUB_OUTPUT:
changed (true/false), version and wheel (file name). The wheel is checked against the SHA-256 that
PyPI publishes before it is written; tests and the commit happen in later workflow steps.
"""

import hashlib
import json
import os
import pathlib
import urllib.request

DEMO = pathlib.Path("assets/pyodide")
INFO = DEMO / "polanon.json"


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "boromat.github.io demo updater"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def main() -> None:
    current = json.loads(INFO.read_text(encoding="utf-8"))
    release = json.loads(fetch("https://pypi.org/pypi/polanon/json"))
    version = release["info"]["version"]
    wheel = next(
        f for f in release["urls"]
        if f["packagetype"] == "bdist_wheel" and f["filename"].endswith("-py3-none-any.whl")
    )
    changed = version != current["version"]
    if changed:
        data = fetch(wheel["url"])
        digest = hashlib.sha256(data).hexdigest()
        if digest != wheel["digests"]["sha256"]:
            raise SystemExit(f"SHA-256 of {wheel['filename']} does not match PyPI: {digest}")
        (DEMO / wheel["filename"]).write_bytes(data)
        old = DEMO / current["wheel"]
        if old.name != wheel["filename"] and old.exists():
            old.unlink()
        INFO.write_text(
            json.dumps({"version": version, "wheel": wheel["filename"], "sha256": digest}, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"polanon {current['version']} -> {version}")
    else:
        print(f"polanon {version} is already in the demo")

    with open(os.environ.get("GITHUB_OUTPUT", os.devnull), "a", encoding="utf-8") as out:
        out.write(f"changed={'true' if changed else 'false'}\nversion={version}\nwheel={wheel['filename']}\n")


if __name__ == "__main__":
    main()
