// Demo PolAnon: część na stronie. Maskowanie działa w demo/worker.js (w tle), ten plik rysuje wyniki.
// Wpisany tekst trafia tylko do workera w tej samej karcie, nigdzie dalej.
(function () {
  "use strict";

  var root = document.getElementById("try");
  if (!root) return;
  var me = document.currentScript;
  var EN = (document.documentElement.lang || "").toLowerCase().indexOf("en") === 0;

  var T = EN ? {
    loading: "Loading PolAnon into your browser…",
    starting: "Starting PolAnon…",
    ready: "PolAnon {v} is running in your browser",
    failed: "The demo could not start in this browser. Try a current Chrome, Edge, Firefox or Safari.",
    paused: "Data saver is on, so the demo waits for you.",
    waiting: "The result appears once PolAnon has loaded.",
    none: "No personal data found in this text.",
    count: "Masked: {n}",
    copied: "Copied",
    copiedAll: "Copied the text for the model.",
    copyFailed: "Couldn’t copy. The text is selected, press Ctrl+C.",
    rest: "Other data: {list}."
  } : {
    loading: "Ładowanie PolAnon w przeglądarce…",
    starting: "Uruchamianie PolAnon…",
    ready: "PolAnon {v} działa w Twojej przeglądarce",
    failed: "Demo nie uruchomiło się w tej przeglądarce. Spróbuj w aktualnym Chrome, Edge, Firefox albo Safari.",
    paused: "Masz włączone oszczędzanie danych, więc demo czeka na Ciebie.",
    waiting: "Wynik pojawi się, gdy PolAnon się załaduje.",
    none: "W tym tekście nie ma danych osobowych.",
    count: "Zamaskowano: {n}",
    copied: "Skopiowano",
    copiedAll: "Skopiowano tekst dla modelu.",
    copyFailed: "Nie udało się skopiować. Tekst jest zaznaczony, naciśnij Ctrl+C.",
    rest: "Pozostałe dane: {list}."
  };

  // Przykłady: dane są fikcyjne, a numery mają poprawne sumy kontrolne.
  var EXAMPLES = EN ? {
    invoice: "Please correct the invoice for Jan Kowalski, PESEL 50810112354, account PL61 1090 1014 0000 0712 1981 2874. Send the confirmation to jan.kowalski@example.com.",
    complaint: "Please draft a reply to this complaint. Customer: Jan Kowalski, PESEL 50810112354, phone 123 456 789, email jan.kowalski@example.com. Refund to account PL61 1090 1014 0000 0712 1981 2874. Seller: Przykład Handel Sp. z o.o.",
    recruitment: "Candidate Anna Nowak (anna.nowak@example.com, phone 600 700 800) lives at ul. Zwycięstwa 12, 44-100 Gliwice. Please review her CV and book an interview with Piotr Wiśniewski.",
    contract: "The contract is signed by Przykład Handel Sp. z o.o., NIP 526-000-12-46, REGON 123456785, KRS 0000123456, represented by its CEO Tomasz Zieliński, ID card ABA 300000."
  } : {
    faktura: "Proszę o korektę faktury dla Jana Kowalskiego, PESEL 50810112354, konto PL61 1090 1014 0000 0712 1981 2874. Potwierdzenie proszę wysłać na jan.kowalski@example.com.",
    reklamacja: "Proszę przygotować odpowiedź na reklamację. Klient: Jan Kowalski, PESEL 50810112354, tel. 123 456 789, e-mail jan.kowalski@example.com. Zwrot na konto PL61 1090 1014 0000 0712 1981 2874. Sprzedawca: Przykład Handel Sp. z o.o.",
    rekrutacja: "Kandydatka Anna Nowak (anna.nowak@example.com, tel. 600 700 800) mieszka przy ul. Zwycięstwa 12, 44-100 Gliwice. Proszę ocenić jej CV i umówić rozmowę z Piotrem Wiśniewskim.",
    umowa: "Umowę zawiera Przykład Handel Sp. z o.o., NIP 526-000-12-46, REGON 123456785, KRS 0000123456, reprezentowana przez prezesa Tomasza Zielińskiego, nr dowodu ABA 300000."
  };

  // Udawana odpowiedź modelu, złożona z tokenów, które naprawdę wyszły z maskowania.
  // {t:celownik} to token z przypadkiem: PolAnon odda imię i nazwisko odmienione.
  var ANSWER = EN ? [
    ["OSOBA", 1, "The reply to {t} is ready."],
    ["FIRMA", 1, "I will send the invoice for {t} today."],
    ["PESEL", 1, "PESEL {t} has a valid checksum."],
    ["NIP", 1, "Tax ID {t} is valid."],
    ["IBAN", 1, "The refund goes to account {t}."],
    ["EMAIL", 1, "I will send the confirmation to {t}."],
    ["TELEFON", 1, "If anything is unclear, I will call {t}."],
    ["ADRES", 1, "The parcel goes to {t}."],
    ["OSOBA", 2, "A copy goes to {t}."]
  ] : [
    ["OSOBA", 1, "Odpowiedź dla {t:dopełniacz} jest gotowa."],
    ["FIRMA", 1, "Fakturę dla {t} wyślę jeszcze dziś."],
    ["PESEL", 1, "PESEL {t} ma poprawną sumę kontrolną."],
    ["NIP", 1, "NIP {t} jest poprawny."],
    ["IBAN", 1, "Zwrot trafi na konto {t}."],
    ["EMAIL", 1, "Potwierdzenie wyślę na adres {t}."],
    ["TELEFON", 1, "W razie pytań zadzwonię pod numer {t}."],
    ["ADRES", 1, "Przesyłkę nadam na adres {t}."],
    ["OSOBA", 2, "Kopię przekażę {t:celownik}."]
  ];

  var $ = function (id) { return document.getElementById(id); };
  var state = $("try-state"), stateText = $("try-state-text"), startBtn = $("try-start");
  var input = $("try-input"), answer = $("try-answer");
  var maskedOut = $("try-masked"), restoredOut = $("try-restored");
  var table = $("try-table"), tbody = table.querySelector("tbody"), count = $("try-count");
  var copyBtn = $("try-copy"), live = $("try-live");
  var chips = Array.prototype.slice.call(root.querySelectorAll("[data-example]"));

  var worker = null, isReady = false, jobId = 0, lastMask = 0, lastRestore = 0;
  var mapping = {}, maskedText = "", answerTouched = false;
  var maskTimer = null, restoreTimer = null, announceTimer = null;

  function setState(name, text) {
    state.setAttribute("data-state", name);
    stateText.textContent = text;
  }

  function say(text) {
    clearTimeout(announceTimer);
    announceTimer = setTimeout(function () { live.textContent = text; }, 700);
  }

  // ---------- Rysowanie (zawsze przez textContent: wpisany tekst nigdy nie staje się HTML-em) ----------
  var TOKEN = /<[A-Z_]+_\d+>/g;

  function drawMasked() {
    maskedOut.textContent = "";
    var last = 0, m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(maskedText))) {
      if (!Object.prototype.hasOwnProperty.call(mapping, m[0])) continue;
      maskedOut.appendChild(document.createTextNode(maskedText.slice(last, m.index)));
      var code = document.createElement("code");
      code.className = "tok";
      code.textContent = m[0];
      maskedOut.appendChild(code);
      last = m.index + m[0].length;
    }
    maskedOut.appendChild(document.createTextNode(maskedText.slice(last)));

    var tokens = Object.keys(mapping);
    tbody.textContent = "";
    tokens.forEach(function (token) {
      var tr = document.createElement("tr");
      var th = document.createElement("td");
      var code = document.createElement("code");
      code.className = "tok";
      code.textContent = token;
      th.appendChild(code);
      var td = document.createElement("td");
      td.textContent = mapping[token];
      tr.appendChild(th);
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
    table.hidden = tokens.length === 0;
    $("try-table-title").hidden = tokens.length === 0;
    $("try-none").hidden = tokens.length > 0 || !input.value.trim();
    count.textContent = tokens.length ? T.count.replace("{n}", tokens.length) : "";
    copyBtn.disabled = !maskedText;
  }

  function drawRestored(segments) {
    restoredOut.textContent = "";
    segments.forEach(function (s) {
      if (s[1]) {
        var mark = document.createElement("mark");
        mark.textContent = s[0];
        mark.title = s[1];
        restoredOut.appendChild(mark);
      } else {
        restoredOut.appendChild(document.createTextNode(s[0]));
      }
    });
  }

  function buildAnswer() {
    var used = {}, parts = [];
    ANSWER.forEach(function (row) {
      var token = "<" + row[0] + "_" + row[1] + ">";
      if (!Object.prototype.hasOwnProperty.call(mapping, token)) return;
      used[token] = true;
      parts.push(row[2]
        .replace(/\{t:([^}]+)\}/, "<" + row[0] + "_" + row[1] + ":$1>")
        .replace("{t}", token));
    });
    var rest = Object.keys(mapping).filter(function (t) { return !used[t]; });
    if (rest.length) parts.push(T.rest.replace("{list}", rest.join(", ")));
    return parts.join(" ");
  }

  // ---------- Rozmowa z workerem ----------
  function send(type, text) {
    jobId += 1;
    worker.postMessage({ id: jobId, type: type, text: text });
    return jobId;
  }

  function requestMask() {
    if (!isReady) return;
    lastMask = send("mask", input.value);
  }

  function requestRestore() {
    if (!isReady) return;
    lastRestore = send("restore", answer.value);
  }

  function onMessage(event) {
    var msg = event.data || {};
    if (msg.type === "progress") { setState("loading", T.starting); return; }
    if (msg.type === "failed") { fail(); return; }
    if (msg.type === "ready") {
      isReady = true;
      setState("ready", T.ready.replace("{v}", msg.version));
      requestMask();
      return;
    }
    if (msg.type !== "result" || msg.error) return;
    if (msg.kind === "mask" && msg.id === lastMask) {
      maskedText = msg.data.masked;
      mapping = msg.data.mapping;
      drawMasked();
      say(T.count.replace("{n}", Object.keys(mapping).length));
      if (!answerTouched) answer.value = buildAnswer();
      requestRestore();
    } else if (msg.kind === "restore" && msg.id === lastRestore) {
      drawRestored(msg.data);
    }
  }

  function fail() {
    isReady = false;
    setState("failed", T.failed);
    if (worker) worker.terminate();
    worker = null;
  }

  function start() {
    startBtn.hidden = true;
    setState("loading", T.loading);
    try {
      worker = new Worker(new URL("worker.js", me.src));
    } catch (e) {
      fail();
      return;
    }
    worker.onmessage = onMessage;
    worker.onerror = function (e) { e.preventDefault(); fail(); };
  }

  // ---------- Zdarzenia ----------
  input.addEventListener("input", function () {
    chips.forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
    clearTimeout(maskTimer);
    maskTimer = setTimeout(requestMask, 120);
  });

  answer.addEventListener("input", function () {
    answerTouched = true;
    clearTimeout(restoreTimer);
    restoreTimer = setTimeout(requestRestore, 120);
  });

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      input.value = EXAMPLES[chip.getAttribute("data-example")] || "";
      chips.forEach(function (c) { c.setAttribute("aria-pressed", c === chip ? "true" : "false"); });
      answerTouched = false;
      requestMask();
    });
  });

  copyBtn.addEventListener("click", function () {
    var label = copyBtn.innerHTML;
    var fallback = function () {
      var range = document.createRange();
      range.selectNodeContents(maskedOut);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      say(T.copyFailed);
    };
    if (!navigator.clipboard || !navigator.clipboard.writeText) { fallback(); return; }
    navigator.clipboard.writeText(maskedText).then(function () {
      copyBtn.textContent = T.copied;
      say(T.copiedAll);
      setTimeout(function () { copyBtn.innerHTML = label; }, 1600);
    }, fallback);
  });

  startBtn.addEventListener("click", start);

  // ---------- Start ----------
  maskedOut.textContent = T.waiting;
  copyBtn.disabled = true;
  var saveData = navigator.connection && navigator.connection.saveData;
  if (!window.Worker || typeof WebAssembly !== "object") {
    fail();
  } else if (saveData) {
    setState("paused", T.paused);
    startBtn.hidden = false;
  } else {
    start();
  }
})();
