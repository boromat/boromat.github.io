// Demo PolAnon: ta część działa w tle (Web Worker), żeby strona nie zamarzała przy ładowaniu.
// Pyodide to Python skompilowany do WebAssembly; uruchamia w nim prawdziwy pakiet polanon.
// Wszystkie pliki pochodzą z tej strony, a wpisany tekst nie opuszcza przeglądarki.
"use strict";

var BASE = new URL("../assets/pyodide/", self.location.href).href;
importScripts(BASE + "pyodide.js");

var quiet = function () {};

var ready = (async function () {
  var info = await (await fetch(BASE + "polanon.json", { cache: "no-cache" })).json();
  var pyodide = await loadPyodide({ indexURL: BASE, stdout: quiet, stderr: quiet });
  self.postMessage({ type: "progress", stage: "package" });
  await pyodide.loadPackage(BASE + info.wheel, { messageCallback: quiet, errorCallback: quiet });
  var glue = await (await fetch(new URL("glue.py", self.location.href), { cache: "no-cache" })).text();
  pyodide.runPython(glue);
  return {
    mask: pyodide.globals.get("mask"),
    restore: pyodide.globals.get("restore"),
    version: pyodide.globals.get("version")()
  };
})();

ready.then(
  function (api) { self.postMessage({ type: "ready", version: api.version }); },
  function (error) { self.postMessage({ type: "failed", message: String((error && error.message) || error) }); }
);

self.onmessage = function (event) {
  var job = event.data || {};
  ready.then(function (api) {
    try {
      var fn = job.type === "restore" ? api.restore : api.mask;
      self.postMessage({ type: "result", id: job.id, kind: job.type, data: JSON.parse(fn(String(job.text || ""))) });
    } catch (error) {
      self.postMessage({ type: "result", id: job.id, kind: job.type, error: String((error && error.message) || error) });
    }
  }, function () { /* „failed” zostało już wysłane */ });
};
