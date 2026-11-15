// Mateusz Borowy · Projekty / Projects – drobne interakcje dla obu wersji językowych.
// Bez bibliotek, bez analityki i bez wysyłania czegokolwiek na zewnątrz.
// Bez tego pliku strona też działa: przykład pokazuje wtedy wszystkie trzy kroki naraz.
// Klasę "js" na <html> dodaje jedna linijka w <head>, żeby układ nie skakał przy ładowaniu.
(function () {
  "use strict";

  var isEnglish = (document.documentElement.lang || "").toLowerCase().indexOf("en") === 0;

  // Komunikaty skryptu w obu językach.
  var T = isEnglish ? {
    copied: "Copied",
    copiedTo: "Copied to clipboard: ",
    copyFailed: "Couldn’t copy. The text is selected, press Ctrl+C.",
    newTab: " (opens in a new tab)"
  } : {
    copied: "Skopiowano",
    copiedTo: "Skopiowano do schowka: ",
    copyFailed: "Nie udało się skopiować. Tekst jest zaznaczony, naciśnij Ctrl+C.",
    newTab: " (otwiera się w nowej karcie)"
  };

  // Te same sekcje mają w obu wersjach inne kotwice (polskie i angielskie).
  var PL_TO_EN = {
    "tresc": "content",
    "jak-to-dziala": "how-it-works",
    "projekty": "projects",
    "rekruter": "recruiters",
    "kontakt": "contact"
  };

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var statusEl = document.getElementById("status");

  function announce(message) {
    if (!statusEl) return;
    statusEl.textContent = "";
    setTimeout(function () { statusEl.textContent = message; }, 50);
  }

  // ---------- Płynne przewijanie tylko po kliknięciu linku do sekcji ----------
  // Klasa „smooth” włącza płynność na czas jednego przewinięcia. Dzięki temu wejście z linku
  // (np. z CV do #rekruter) od razu pokazuje sekcję, a domyślne zachowanie linków zostaje
  // (zmiana adresu, fokus po „Przejdź do treści”).
  var smoothTimer = null;
  document.addEventListener("click", function (e) {
    var link = e.target.closest && e.target.closest("a[href^='#']");
    if (!link || reduceMotion) return;
    var html = document.documentElement;
    html.classList.add("smooth");
    var done = function () { html.classList.remove("smooth"); window.removeEventListener("scrollend", done); };
    window.addEventListener("scrollend", done);
    clearTimeout(smoothTimer);
    smoothTimer = setTimeout(done, 3000);
  }, true);

  // ---------- Przełącznik języka: ta sama sekcja w drugiej wersji ----------
  document.querySelectorAll("a[data-lang-switch]").forEach(function (link) {
    // Przy otwarciu pliku z dysku (file://) folder nie otwiera się sam, więc dopisujemy index.html.
    if (window.location.protocol === "file:" && /\/$/.test(link.getAttribute("href"))) {
      link.setAttribute("href", link.getAttribute("href") + "index.html");
    }
    link.addEventListener("click", function () {
      var hash = window.location.hash.slice(1);
      if (!hash) return;
      var target = hash;
      if (isEnglish) {
        Object.keys(PL_TO_EN).forEach(function (pl) { if (PL_TO_EN[pl] === hash) target = pl; });
      } else if (PL_TO_EN[hash]) {
        target = PL_TO_EN[hash];
      }
      link.setAttribute("href", link.getAttribute("href").split("#")[0] + "#" + target);
    });
  });

  // ---------- „Jak to działa”: trzy kroki jednego przykładu ----------
  var demo = document.getElementById("demo");
  if (demo) {
    var buttons = demo.querySelectorAll("[data-step]");
    var panels = demo.querySelectorAll("[data-step-panel]");
    var stage = demo.querySelector(".demo-stage");
    var touched = false;
    var timers = [];

    var show = function (step) {
      buttons.forEach(function (b) {
        b.setAttribute("aria-pressed", b.getAttribute("data-step") === step ? "true" : "false");
      });
      panels.forEach(function (p) {
        p.hidden = p.getAttribute("data-step-panel") !== step;
      });
    };

    // W HTML wszystkie kroki są widoczne (na wypadek braku JS); tu zostaje tylko pierwszy.
    show("1");

    buttons.forEach(function (b) {
      b.addEventListener("click", function () {
        touched = true;
        timers.forEach(clearTimeout);
        // Czytnik ekranu ogłasza nowy krok tylko po kliknięciu, nie przy automatycznym pokazie.
        if (stage) stage.setAttribute("aria-live", "polite");
        show(b.getAttribute("data-step"));
      });
    });

    // Gdy przykład pojawi się na ekranie, sam przechodzi raz przez kroki 2 i 3
    // (całość trwa krócej niż 5 sekund) i zatrzymuje się na ostatnim.
    if (!reduceMotion && "IntersectionObserver" in window) {
      var seen = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        seen.disconnect();
        timers.push(setTimeout(function () { if (!touched) show("2"); }, 1300));
        timers.push(setTimeout(function () { if (!touched) show("3"); }, 4300));
      }, { threshold: 0.6 });
      seen.observe(demo);
    }
  }

  // ---------- Menu na telefonie ----------
  var toggle = document.querySelector(".nav-toggle");
  var menu = document.getElementById("nav-links");
  if (toggle && menu) {
    var setOpen = function (open, returnFocus) {
      menu.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (!open && returnFocus) toggle.focus();
    };
    toggle.addEventListener("click", function () { setOpen(!menu.classList.contains("open"), false); });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false, false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu.classList.contains("open")) setOpen(false, true);
    });
    document.addEventListener("click", function (e) {
      if (menu.classList.contains("open") && !e.target.closest(".nav")) setOpen(false, false);
    });
  }

  // ---------- Podświetlenie bieżącej sekcji w menu ----------
  // Bieżąca jest ostatnia sekcja, której początek minął linię na 40% wysokości ekranu.
  // Na samym dole strony zawsze ostatnia: krótki „Kontakt” na wysokim ekranie nigdy nie dojedzie do tej linii.
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav-links a[href^='#']"));
  var sections = navLinks.map(function (a) { return document.querySelector(a.getAttribute("href")); }).filter(Boolean);
  if (sections.length) {
    var lastCurrent;
    var updateSpy = function () {
      var line = window.innerHeight * 0.4;
      var current = null;
      sections.forEach(function (s) { if (s.getBoundingClientRect().top <= line) current = s.id; });
      // 48 px zapasu: touchpad często zatrzymuje się kilka pikseli przed samym dołem.
      var atBottom = window.innerHeight + window.pageYOffset >= document.documentElement.scrollHeight - 48;
      if (atBottom) current = sections[sections.length - 1].id;
      if (current === lastCurrent) return;
      lastCurrent = current;
      navLinks.forEach(function (a) {
        if (current && a.getAttribute("href") === "#" + current) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    };
    // Liczone wprost przy każdym przewinięciu: to tylko kilka odczytów pozycji,
    // a działa też tam, gdzie przeglądarka wstrzymuje rysowanie klatek.
    window.addEventListener("scroll", updateSpy, { passive: true });
    window.addEventListener("resize", updateSpy);
    window.addEventListener("hashchange", updateSpy);
    window.addEventListener("pageshow", updateSpy);
    // Wejście z linku do sekcji (#kontakt) albo odświeżenie w połowie strony: przeglądarka przewija
    // sama, czasem bez zdarzenia „scroll”, więc sprawdzamy jeszcze chwilę po załadowaniu.
    window.addEventListener("load", function () {
      updateSpy();
      setTimeout(updateSpy, 150);
      setTimeout(updateSpy, 600);
    });
    updateSpy();
  }

  // ---------- Kopiowanie adresu e-mail ----------
  document.querySelectorAll(".copy").forEach(function (btn) {
    var label = btn.innerHTML;
    var timer = null;
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-copy") || "";
      var source = btn.parentElement.querySelector("a, code");
      var fallback = function () {
        if (source) {
          var range = document.createRange();
          range.selectNodeContents(source);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
        announce(T.copyFailed);
      };
      if (!navigator.clipboard || !navigator.clipboard.writeText) { fallback(); return; }
      navigator.clipboard.writeText(text).then(function () {
        btn.textContent = T.copied;
        announce(T.copiedTo + text);
        clearTimeout(timer);
        timer = setTimeout(function () { btn.innerHTML = label; }, 1600);
      }, fallback);
    });
  });

  // ---------- Informacja o nowej karcie dla czytników ekranu ----------
  document.querySelectorAll("a[target='_blank']").forEach(function (a) {
    var hint = document.createElement("span");
    hint.className = "sr-only";
    hint.textContent = T.newTab;
    a.appendChild(hint);
  });
})();
