const $ = (id) => document.getElementById(id);
const views = ["formView", "loadingView", "resultView", "historyView"];
function show(view) {
  views.forEach((v) => $(v).classList.toggle("hidden", v !== view));
}

let current = null; // het actieve historie-item

// ---- Column aanvragen ----
$("columnForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    onderwerp: $("onderwerp").value,
    gedachten: $("gedachten").value,
    aandachtspunten: $("aandachtspunten").value,
  };
  show("loadingView");
  try {
    const res = await fetch("/api/columns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error((await res.json()).error || "Er ging iets mis.");
    current = await res.json();
    renderResult(current);
  } catch (err) {
    alert(err.message);
    show("formView");
  }
});

// ---- Resultaat tonen ----
function renderResult(item) {
  const c = item.definitief || item.concept;
  $("metaMetafoor").textContent = "🪄 " + (item.concept?.metafoor || "—");
  const woorden = c.woorden || (c.column || "").split(/\s+/).filter(Boolean).length;
  $("metaWoorden").textContent = woorden + " woorden";
  $("resultTitel").value = c.titel || "";
  $("resultColumn").value = c.column || "";
  $("resultToelichting").textContent = item.concept?.toelichting || "";
  $("publishStatus").textContent = item.definitief
    ? "✅ Vastgelegd als " + item.definitief.bestand
    : "";
  $("publishStatus").className = "status " + (item.definitief ? "ok" : "");
  show("resultView");
}

// ---- LinkedIn-post kopiëren ----
$("copyLinkedin").addEventListener("click", async () => {
  const linkedin = current?.concept?.linkedin || $("resultColumn").value;
  try {
    await navigator.clipboard.writeText(linkedin);
    flash("📋 LinkedIn-post gekopieerd!", "ok");
  } catch {
    flash("Kopiëren lukte niet — selecteer de tekst handmatig.", "err");
  }
});

// ---- Definitief vastleggen ----
$("publishBtn").addEventListener("click", async () => {
  if (!current) return;
  try {
    const res = await fetch(`/api/history/${current.id}/publiceer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titel: $("resultTitel").value, column: $("resultColumn").value }),
    });
    if (!res.ok) throw new Error((await res.json()).error || "Vastleggen mislukt.");
    const data = await res.json();
    current = data.item;
    flash("✅ Vastgelegd in de columnmap: " + data.bestand, "ok");
  } catch (err) {
    flash(err.message, "err");
  }
});

function flash(msg, kind) {
  const el = $("publishStatus");
  el.textContent = msg;
  el.className = "status " + (kind || "");
}

// ---- Nieuwe column ----
$("newBtn").addEventListener("click", () => {
  $("columnForm").reset();
  current = null;
  show("formView");
});

// ---- Historie ----
$("historyBtn").addEventListener("click", openHistory);
$("closeHistory").addEventListener("click", () => show("formView"));

async function openHistory() {
  show("historyView");
  const list = $("historyList");
  list.innerHTML = "<li>Laden…</li>";
  try {
    const items = await (await fetch("/api/history")).json();
    if (!items.length) {
      list.innerHTML = "<li>Nog geen verzoeken. Schrijf je eerste column! ✍️</li>";
      return;
    }
    list.innerHTML = "";
    for (const item of items) {
      const li = document.createElement("li");
      li.className = "history-item";
      const datum = new Date(item.aangemaakt).toLocaleDateString("nl-NL", {
        day: "numeric", month: "long", year: "numeric",
      });
      const status = item.definitief
        ? '<span class="badge">✅ definitief</span>'
        : "📝 concept";
      li.innerHTML = `<h3>${escapeHtml(item.concept?.titel || item.onderwerp)}</h3>
        <div class="h-meta">${escapeHtml(item.onderwerp)} · ${datum} · ${status}</div>`;
      li.addEventListener("click", () => {
        current = item;
        renderResult(item);
      });
      list.appendChild(li);
    }
  } catch {
    list.innerHTML = "<li>Historie laden mislukte.</li>";
  }
}

function escapeHtml(s) {
  return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// ---- Service worker (PWA) ----
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/service-worker.js").catch(() => {}));
}
