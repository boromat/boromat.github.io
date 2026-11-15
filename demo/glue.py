"""Glue between the PolAnon demo page and the polanon package.

demo/worker.js runs this file in Pyodide, inside the visitor's browser. The update workflow runs the
same file with CPython before it accepts a new polanon release:

    python demo/glue.py --self-test

so a release that changes what the demo relies on fails there instead of breaking the published page.
"""

import json
import re
import sys

import polanon
from polanon import Anonymizer, default_guards

# A token as a model writes it back: <OSOBA_1>, or <OSOBA_1:celownik> for a name in another case.
_TOKEN = re.compile(r"<[A-Z_]+_\d+(?::[a-ząćęłńóśźż]+)?>")

# Rules only: spaCy and its language model are too large to load in a browser.
_anonymizer = Anonymizer(default_guards(with_ner=False))
_mapping: dict[str, str] = {}


def version() -> str:
    return str(getattr(polanon, "__version__", ""))


def mask(text: str) -> str:
    """Mask `text` and keep its mapping for restore(). JSON: the masked text and the mapping."""
    global _mapping
    result = _anonymizer.anonymize_sync(text)
    _mapping = dict(result.mapping)
    return json.dumps({"masked": result.anonymized, "mapping": _mapping}, ensure_ascii=False)


def restore(text: str) -> str:
    """Put the real values back into an answer. JSON: [text, token or null] segments.

    Each token is restored by polanon itself, so the page can highlight what came back. If the
    pieces ever disagree with restoring the whole text, the whole text wins, without highlights.
    """
    whole = Anonymizer.restore(text, _mapping)
    segments: list[list[str | None]] = []
    last = 0
    for match in _TOKEN.finditer(text):
        value = Anonymizer.restore(match.group(), _mapping)
        if value == match.group():
            continue
        segments.append([text[last : match.start()], None])
        segments.append([value, match.group()])
        last = match.end()
    segments.append([text[last:], None])
    if "".join(piece for piece, _ in segments) != whole:
        segments = [[whole, None]]
    return json.dumps(segments, ensure_ascii=False)


def _self_test() -> None:
    sample = (
        "Proszę o korektę faktury dla Jana Kowalskiego, PESEL 50810112354, "
        "konto PL61 1090 1014 0000 0712 1981 2874."
    )
    out = json.loads(mask(sample))
    expected = "Proszę o korektę faktury dla <OSOBA_1>, PESEL <PESEL_1>, konto <IBAN_1>."
    assert out["masked"] == expected, out["masked"]
    assert out["mapping"]["<IBAN_1>"] == "PL61 1090 1014 0000 0712 1981 2874", out["mapping"]

    answer = json.loads(restore("Przekażę to <OSOBA_1:celownik>. Zwrot na konto <IBAN_1>."))
    text = "".join(piece for piece, _ in answer)
    assert text == "Przekażę to Janowi Kowalskiemu. Zwrot na konto PL61 1090 1014 0000 0712 1981 2874.", text
    assert [token for _, token in answer if token] == ["<OSOBA_1:celownik>", "<IBAN_1>"], answer
    print("demo glue ok with polanon", version())


if __name__ == "__main__" and "--self-test" in sys.argv:
    _self_test()
