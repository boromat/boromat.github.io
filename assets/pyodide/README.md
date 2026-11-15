# Pliki demo PolAnon

Te pliki pozwalają uruchomić PolAnon w przeglądarce odwiedzającego, na stronach `demo/` i `en/demo/`.
Wszystko jest serwowane z tej strony; nic nie jest pobierane z innych serwerów.

| Plik | Skąd | Licencja |
|---|---|---|
| `pyodide.js`, `pyodide.asm.js`, `pyodide.asm.wasm`, `python_stdlib.zip`, `pyodide-lock.json` | pakiet npm `pyodide@0.27.7`, bez zmian (sprawdzony skrótem `dist.integrity` z rejestru npm). Kod źródłowy: https://github.com/pyodide/pyodide | MPL-2.0 (Pyodide), PSF (biblioteka standardowa Pythona 3.12) |
| `polanon-*.whl` | PyPI, https://pypi.org/project/polanon/ (sprawdzony skrótem SHA-256 z PyPI) | MIT |
| `polanon.json` | która wersja PolAnon jest w demo | – |

Nowe wersje PolAnon podmienia workflow `.github/workflows/update-polanon.yml`: raz dziennie pyta PyPI
o najnowszą wersję, sprawdza skrót, testuje ją kodem demo (`demo/glue.py --self-test`) na Pythonie 3.12,
takim jak w Pyodide, i dopiero wtedy zapisuje ją tutaj.

Pyodide aktualizuje się ręcznie: pobierz nowy pakiet npm, podmień pięć plików powyżej i przetestuj demo.
