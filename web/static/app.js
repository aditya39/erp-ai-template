/* Panel Asisten + kerangka aplikasi. Tanpa framework, tanpa build step.
 *
 * Yang perlu diketahui saat menempelkan fitur AI ke halaman ERP (web/static/halaman.js):
 *   tanyaAsisten(teks)                          mengirim pertanyaan ke panel Asisten, seolah user mengetiknya
 *   <button class="btn-ai" data-tanya="...">    elemen apa pun dengan atribut data-tanya otomatis memanggil tanyaAsisten()
 * Panel ini hanya menampilkan event dari POST /api/chat (lihat kontrak event di asisten/agent.py).
 * Kelas CSS yang tersedia: btn, btn-utama, btn-ai (tombol), badge b-sukses/b-bahaya/b-peringatan (status),
 * panel, panel-kepala, panel-isi, tabel. Ikon: ikon("nama") dari ikon.js.
 */
const $ = (s, el = document) => el.querySelector(s);
const WARNA = ["#0e6b57", "#8a93a3", "#c08a2e", "#5679bf", "#ad5a6e", "#6c5fcf"];
const SARAN = [
  "Bagaimana tren penjualan Biskuit Kelapa 3 bulan terakhir?",
  "Lima customer dengan penjualan terbesar 3 bulan terakhir?",
  "Kenapa HPP Roti Cokelat naik bulan ini?",
  "Berapa lama batas retur untuk roti yang rusak?",
];
const MENU = [
  { halaman: "dashboard", label: "Dashboard", ikon: "dashboard" },
  { grup: "Modul" },
  { halaman: "penjualan", label: "Penjualan", ikon: "faktur" },
  { halaman: "persediaan", label: "Persediaan", ikon: "stok" },
  { halaman: "hpp", label: "Produksi & HPP", ikon: "hpp" },
  { halaman: "keuangan", label: "Keuangan", ikon: "piutang" },
  { halaman: "dokumen", label: "Dokumen", ikon: "dokumen" },
  { grup: "Pengaturan" },
  { halaman: "log", label: "Log aktivitas AI", ikon: "aktivitas" },
];

/* Pilihan user dan mode diingat di browser ini saja; aplikasi tetap jalan kalau penyimpanan tidak tersedia. */
function ingat(kunci, nilai) {
  try {
    if (nilai === undefined) return localStorage.getItem("erp-mini-" + kunci);
    localStorage.setItem("erp-mini-" + kunci, nilai);
  } catch (e) { /* mode privat: abaikan */ }
  return null;
}
const state = { info: null, pengguna: "budi", mode: "lokal", riwayat: [], sibuk: false, halaman: "dashboard" };

/* ---------- util ---------- */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
/* Markdown sederhana. Teks dari model selalu di-escape dulu (cegah XSS). */
function markdown(teks) {
  const inline = (s) => esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<i>$2</i>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
  let html = "", list = null, tabel = false;
  const tutup = () => { if (list) { html += `</${list}>`; list = null; } if (tabel) { html += "</table>"; tabel = false; } };
  for (const b of String(teks || "").split("\n")) {
    const ul = b.match(/^\s*[-*•]\s+(.*)/), ol = b.match(/^\s*\d+[.)]\s+(.*)/), h = b.match(/^(#{1,4})\s+(.*)/);
    const sel = b.trim().startsWith("|") ? b.trim().replace(/^\||\|$/g, "").split("|").map((x) => x.trim()) : null;
    if (sel) {   // tabel Markdown (mis. daftar faktur di draft surat)
      if (sel.every((x) => /^:?-+:?$/.test(x))) continue;
      if (!tabel) { tutup(); html += `<table class="tabel">`; tabel = true; html += `<tr>${sel.map((x) => `<th>${inline(x)}</th>`).join("")}</tr>`; }
      else html += `<tr>${sel.map((x) => `<td>${inline(x)}</td>`).join("")}</tr>`;
    } else if (/^\s*-{3,}\s*$/.test(b)) { tutup(); html += "<hr>"; }
    else if (ul || ol) {
      const jenis = ul ? "ul" : "ol";
      if (list !== jenis) { tutup(); html += `<${jenis}>`; list = jenis; }
      html += `<li>${inline((ul || ol)[1])}</li>`;
    } else if (h) { tutup(); html += `<p class="judul-${h[1].length === 1 ? 1 : 2}"><b>${inline(h[2])}</b></p>`; }
    else if (b.trim() === "") { tutup(); }
    else { tutup(); html += `<p>${inline(b)}</p>`; }
  }
  tutup();
  return html;
}
const detik = (ms) => (ms / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " dtk";
const angka = (n) => Number(n || 0).toLocaleString("id-ID");

async function ambil(url) {
  const resp = await fetch(url + (url.includes("?") ? "&" : "?") + "pengguna_kode=" + state.pengguna);
  if (!resp.ok) throw new Error((await resp.json().catch(() => ({}))).detail || `Server error ${resp.status}`);
  return resp.json();
}

function buatGrafik(canvas, g) {
  const horizontal = !!g.horizontal;
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.color = "#69707c";
  return new Chart(canvas, {
    type: g.tipe === "bar" ? "bar" : "line",
    data: {
      labels: g.label,
      datasets: g.seri.map((s, i) => ({
        label: s.nama, data: s.data, borderColor: WARNA[i % WARNA.length],
        backgroundColor: g.tipe === "bar" ? WARNA[i % WARNA.length] : WARNA[i % WARNA.length] + "1f",
        borderWidth: g.tipe === "bar" ? 0 : 2, tension: 0.3, fill: g.tipe !== "bar" && g.seri.length === 1, pointRadius: 2.5,
        borderRadius: 3, maxBarThickness: 34,
      })),
    },
    options: {
      indexAxis: horizontal ? "y" : "x", maintainAspectRatio: false, animation: false,
      plugins: {
        title: { display: !!g.judul, text: g.judul, align: "start", font: { size: 12, weight: "500" }, color: "#3b414c", padding: { bottom: 8 } },
        legend: { display: g.seri.length > 1, position: "bottom", labels: { boxWidth: 8, boxHeight: 8, font: { size: 11 } } },
      },
      scales: {
        x: { ticks: { font: { size: 11 } }, grid: { display: false }, border: { color: "#e3e5e8" } },
        y: { ticks: { font: { size: 11 }, callback: (v) => horizontal ? String(g.label[v] || "").slice(0, 22) : angka(v) },
             grid: { color: "#edeef1" }, border: { display: false } },
      },
    },
  });
}

/* SQL yang dijalankan tool (field "query" pada event tool; tidak dikirim ke model). */
function teksSQL(query) {
  return (query || []).map((q, i) => `-- query ${i + 1}${q.params ? " · params " + JSON.stringify(q.params) : ""}\n`
    + q.sql.replace(/\s+(FROM|WHERE|GROUP BY|ORDER BY|LIMIT|JOIN)\b/g, "\n  $1")).join("\n\n");
}

/* Kartu draft sales order: tampil sebagai dokumen ERP yang belum disimpan. Bagian .ds-erp diisi fitur C. */
function kartuDraft(d, peringatan) {
  const c = d.customer;
  const baris = d.item.map((x) => `<li><div><b>${esc(x.nama)}</b>
      <small>${esc(x.kode)} · ${esc(x.harga_daftar_fmt)} per ${esc(x.satuan)} · stok ${x.stok_gudang == null ? "tidak tercatat" : angka(x.stok_gudang)}</small></div>
    <span class="${x.stok_gudang != null && x.stok_gudang < x.qty ? "t-bahaya" : ""}">${angka(x.qty)} ${esc(x.satuan)}</span></li>`).join("");
  const info = [esc(d.gudang) + (d.gudang_otomatis ? " (otomatis dari kota customer)" : "")];
  if (d.diskon_tambahan) info.push(`diskon tambahan ${esc(String(d.diskon_tambahan).replace(".", ","))}%`);
  if (d.catatan) info.push(`catatan: ${esc(d.catatan)}`);
  return `<div class="ai-draft-kepala">${ikon("teks")}<b>Draft sales order</b><span class="badge b-peringatan ds-badge">Belum disimpan</span></div>
    <div class="ai-draft-bagian"><div class="ai-draft-customer"><b>${esc(c.nama)}</b>
      <small>${esc(c.kode)} · ${esc(c.segmen)} · ${esc(c.kota)} · termin ${angka(c.termin_hari)} hari</small><small>${info.join(" · ")}</small></div></div>
    <ul class="ai-draft-item">${baris}</ul>
    <div class="ai-draft-total"><span>Nilai bruto (harga daftar, sebelum diskon)</span><b>${esc(d.nilai_bruto_fmt)}</b></div>
    ${(peringatan || []).map((p) => `<div class="ai-draft-catatan">${ikon("awas")}<span>${esc(p)}</span></div>`).join("")}
    <div class="ds-erp"></div>`;
}

/* ---------- kartu jawaban AI ---------- */
function kartuAI(wadah) {
  const el = document.createElement("div");
  el.className = "ai-pesan";
  el.innerHTML = `<div class="ai-jejak tutup" hidden><button class="ai-jejak-head">${ikon("alur")}<span class="sh-l">Langkah agent</span><span class="panah">${ikon("kanan")}</span></button><div class="ai-jejak-list"></div></div>
    <div class="ai-fase"><span class="ai-loader"><i></i><i></i><i></i></span><span class="fase-teks">Menyiapkan…</span></div>
    <div class="charts"></div><div class="drafts"></div><div class="ai-jawaban"></div><div class="ai-meta"></div>`;
  wadah.appendChild(el);
  const jejak = $(".ai-jejak", el), list = $(".ai-jejak-list", el), fase = $(".ai-fase", el);
  let jumlahTool = 0, mode = "", model = "", jawaban = "", peringatan = [];
  $(".ai-jejak-head", el).onclick = () => jejak.classList.toggle("tutup");
  const gulir = () => { wadah.scrollTop = wadah.scrollHeight; };

  function event(ev) {
    if (ev.tipe === "mulai") { mode = ev.mode; model = ev.model; }
    else if (ev.tipe === "berpikir") {
      $(".fase-teks", fase).textContent = ev.langkah === 1 ? "Model sedang memilih langkah…" : `Model memproses hasil (langkah ${ev.langkah})…`;
      fase.hidden = false;
    } else if (ev.tipe === "tool") {
      jumlahTool++;
      jejak.hidden = false;
      jejak.classList.remove("tutup");
      const tanda = { ok: "ok", ditolak: "tolak", error: "galat", diminta: "pasir" }[ev.status] || "kosong";
      const sql = teksSQL(ev.query);
      peringatan = ev.hasil?.peringatan || [];
      const row = document.createElement("div");
      row.className = "langkah " + ev.status;
      row.innerHTML = `<button class="langkah-baris"><span class="langkah-ikon">${ikon(tanda)}</span>
        <span class="langkah-isi"><span class="langkah-nama">${esc(ev.nama)}</span><span class="langkah-arg">${esc(JSON.stringify(ev.argumen))}</span>
          <span class="langkah-hasil">${esc(ev.ringkas)}${sql ? ` · ${ev.query.length} query SQL` : ""}</span></span>
        <span class="langkah-ms">${angka(ev.durasi_ms)} ms</span></button>
        <div class="langkah-rinci">${sql ? `<div class="langkah-judul">${ikon("db")}Query yang dijalankan</div><pre>${esc(sql)}</pre>` : ""}
          <div class="langkah-judul">${ikon("teks")}Hasil tool (dikirim ke model)</div><pre>${esc(JSON.stringify(ev.hasil, null, 2))}</pre></div>`;
      $(".langkah-baris", row).onclick = () => row.classList.toggle("buka");
      list.appendChild(row);
      $(".sh-l", el).textContent = `Langkah agent · ${jumlahTool} tool`;
    } else if (ev.tipe === "draft_so") {
      const box = document.createElement("div");
      box.className = "ai-draft";
      box.innerHTML = kartuDraft(ev.draft, peringatan);
      $(".drafts", el).appendChild(box);
    } else if (ev.tipe === "grafik") {
      const box = document.createElement("div");
      box.className = "ai-grafik";
      box.innerHTML = "<canvas></canvas>";
      $(".charts", el).appendChild(box);
      buatGrafik($("canvas", box), ev.grafik);
    } else if (ev.tipe === "jawaban") {
      fase.hidden = true;
      jawaban = ev.teks;
      $(".ai-jawaban", el).innerHTML = markdown(ev.teks);
    } else if (ev.tipe === "error") {
      fase.hidden = true;
      $(".ai-jawaban", el).innerHTML = `<div class="ai-galat">${ikon("galat")}<span>${esc(ev.pesan)}</span></div>`;
    } else if (ev.tipe === "selesai") {
      fase.hidden = true;
      if (jumlahTool) jejak.classList.add("tutup");
      $(".ai-meta", el).innerHTML = `<span class="badge ${mode === "cloud" ? "b-info" : "b-sukses"}">${mode === "lokal" ? "Lokal" : "Cloud"}</span>
        <span>${esc(model)}</span><span>· ${detik(ev.durasi_ms)}</span>
        <span>· ${angka((ev.token_masuk || 0) + (ev.token_keluar || 0))} token</span>`;
    }
    gulir();
  }
  return { el, event, jawaban: () => jawaban };
}

/* ---------- streaming dari server (Server-Sent Events lewat fetch) ---------- */
async function alirkan(pesan, mode, riwayat, onEvent) {
  const resp = await fetch("/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pesan, pengguna: state.pengguna, mode, riwayat }),
  });
  if (!resp.ok) { onEvent({ tipe: "error", pesan: `Server error ${resp.status}` }); onEvent({ tipe: "selesai", durasi_ms: 0 }); return; }
  const reader = resp.body.getReader(), dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const blok = buf.slice(0, i); buf = buf.slice(i + 2);
      for (const line of blok.split("\n")) if (line.startsWith("data: ")) onEvent(JSON.parse(line.slice(6)));
    }
  }
}

/* ---------- percakapan ---------- */
function kosongkan() {
  state.riwayat = [];
  const u = state.info.pengguna.find((p) => p.kode === state.pengguna);
  const akses = Object.entries(state.info.semua_izin).map(([kode, nama]) => {
    const boleh = u.kode_izin.includes(kode);
    return `<span class="${boleh ? "boleh" : ""}">${ikon(boleh ? "centang" : "kunci")}${esc(nama)}</span>`;
  }).join("");
  const tool = state.info.tools.map((t) => `<span class="tool">${esc(t.nama)}</span>`).join("") || `<span>belum ada</span>`;
  $("#messages").innerHTML = `<div class="ai-sambutan">
    <div><h3>Tanya data perusahaan</h3>
      <p>Asisten memanggil tool yang sesuai, lalu menjelaskan hasilnya. Angka berasal dari database, bukan dari model.</p></div>
    <div><div class="ai-blok-judul">Data yang bisa dibaca untuk ${esc(u.nama.split(" ")[0])}</div><div class="ai-akses-list">${akses}</div></div>
    <div><div class="ai-blok-judul">Tool yang dimiliki asisten saat ini (${state.info.tools.length})</div><div class="ai-akses-list">${tool}</div></div>
    <div><div class="ai-blok-judul">Contoh pertanyaan</div>
      <div class="ai-saran">${SARAN.map((s) => `<button>${ikon("panah")}<span>${esc(s)}</span></button>`).join("")}</div></div></div>`;
  $("#messages").querySelectorAll(".ai-saran button").forEach((c) => (c.onclick = () => kirim(c.textContent)));
}

async function kirim(teks) {
  teks = (teks || "").trim();
  if (!teks || state.sibuk) return;
  state.sibuk = true;
  $("#kirim").disabled = true;
  $("#input").value = "";
  const msgs = $("#messages");
  $(".ai-sambutan", msgs)?.remove();
  const u = document.createElement("div");
  u.className = "ai-user";
  u.innerHTML = `<div>${esc(teks.length > 600 ? teks.slice(0, 600) + " …" : teks)}</div>`;
  msgs.appendChild(u);
  const kartu = kartuAI(msgs);
  try {
    await alirkan(teks, state.mode, state.riwayat.slice(-6), kartu.event);
    if (kartu.jawaban()) state.riwayat.push({ role: "user", content: teks }, { role: "assistant", content: kartu.jawaban() });
  } catch (e) {
    kartu.event({ tipe: "error", pesan: "Tidak dapat terhubung ke server aplikasi: " + e.message });
    kartu.event({ tipe: "selesai", durasi_ms: 0 });
  }
  state.sibuk = false;
  $("#kirim").disabled = false;
  if (state.halaman === "log") bukaHalaman("log");
}

/* Pintu masuk fitur AI dari halaman ERP: buka panel Asisten, lalu kirim pertanyaan. */
function tanyaAsisten(teks) {
  if (state.sibuk) return;
  bukaAsisten(true);
  kirim(teks);
}

function bukaAsisten(buka) {
  $("#ai-panel").classList.toggle("terbuka", buka);
  $("#app").classList.toggle("ai-buka", buka);
  $("#tombol-asisten").classList.toggle("aktif", buka);
}

function setMode(mode) {
  state.mode = mode;
  ingat("mode", mode);
  document.querySelectorAll("#mode button").forEach((b) => b.classList.toggle("aktif", b.dataset.mode === mode));
  const i = state.info[mode];
  $("#model-aktif").textContent = i.model;
  const pita = $("#ai-pita");
  pita.classList.toggle("cloud", !!i.keluar);
  pita.innerHTML = i.keluar
    ? `${ikon("awan")}<span>Model lewat internet · data dikirim ke penyedia model</span>`
    : `${ikon("akses")}<span>Model di server sendiri · data tidak keluar dari jaringan</span>`;
}

/* ---------- navigasi halaman ERP ---------- */
function kepalaHalaman(jalur, judul, aksi = "") {
  $("#remah").innerHTML = `<span>${esc(jalur)}</span>${ikon("kanan")}<span>${esc(judul)}</span>`;
  const posisi = new Date(state.info.tanggal_posisi).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  return `<div class="hal-kepala"><div><h1>${esc(judul)}</h1>
    <div class="hal-meta"><span>${esc(state.info.bulan_terakhir)}</span><span>${ikon("jam")}Data per ${esc(posisi)}</span></div></div>
    <div class="hal-aksi">${aksi}</div></div>`;
}

async function bukaHalaman(nama) {
  state.halaman = nama;
  document.querySelectorAll("#nav .nav-item").forEach((a) => a.classList.toggle("aktif", a.dataset.halaman === nama));
  const el = $("#halaman");
  try {
    await HALAMAN[nama](el);
  } catch (e) {
    const label = MENU.find((m) => m.halaman === nama)?.label || nama;
    el.innerHTML = kepalaHalaman("ERP", label) + `<section class="panel"><div class="kosong">${ikon("kunci")}<b>${esc(e.message)}</b>
      <span>Halaman ini mengikuti hak akses user yang dipilih di kanan atas.</span></div></section>`;
  }
}

async function mulai() {
  state.info = await (await fetch("/api/info")).json();
  $("#perusahaan").textContent = "ERP mini · " + state.info.bulan_terakhir;
  $("#nav").innerHTML = MENU.map((m) => m.grup ? `<div class="nav-grup">${esc(m.grup)}</div>`
    : `<a class="nav-item" data-halaman="${m.halaman}" title="${esc(m.label)}">${ikon(m.ikon)}<span class="label">${esc(m.label)}</span></a>`).join("");
  $("#ai-logo").innerHTML = ikon("asisten");
  $("#bersihkan").innerHTML = ikon("ulang", 16);
  $("#tutup-asisten").innerHTML = ikon("x", 16);
  $("#kirim").innerHTML = ikon("kirim");
  $("#tombol-asisten").innerHTML = `${ikon("asisten")}<span>Asisten</span>`;

  const tersimpan = ingat("pengguna");
  if (state.info.pengguna.some((p) => p.kode === tersimpan)) state.pengguna = tersimpan;
  $("#pengguna").innerHTML = state.info.pengguna.map((p) => `<option value="${p.kode}">${esc(p.nama)} · ${esc(p.jabatan)}</option>`).join("");
  $("#pengguna").value = state.pengguna;
  $("#pengguna").onchange = (e) => { state.pengguna = e.target.value; ingat("pengguna", state.pengguna); kosongkan(); bukaHalaman(state.halaman); };

  const cloudBtn = $('#mode button[data-mode="cloud"]');
  cloudBtn.disabled = !state.info.cloud.aktif;
  if (!state.info.cloud.aktif) cloudBtn.title = "Isi CLOUD_BASE_URL, CLOUD_MODEL, CLOUD_API_KEY di .env";
  document.querySelectorAll("#mode button").forEach((b) => (b.onclick = () => !b.disabled && setMode(b.dataset.mode)));
  setMode(ingat("mode") === "cloud" && state.info.cloud.aktif ? "cloud" : "lokal");

  $("#bersihkan").onclick = kosongkan;
  $("#tutup-asisten").onclick = () => bukaAsisten(false);
  $("#tombol-asisten").onclick = () => bukaAsisten(!$("#ai-panel").classList.contains("terbuka"));
  $("#composer").onsubmit = (e) => { e.preventDefault(); kirim($("#input").value); };
  $("#input").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); kirim($("#input").value); } };
  document.querySelectorAll("#nav .nav-item").forEach((a) => (a.onclick = () => bukaHalaman(a.dataset.halaman)));
  // Tombol AI di halaman ERP: elemen apa pun dengan atribut data-tanya.
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-tanya]");
    if (t) tanyaAsisten(t.dataset.tanya);
  });
  kosongkan();
  await bukaHalaman("dashboard");
}
