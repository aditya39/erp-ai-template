/* Halaman ERP mini. Setiap fungsi mengisi <div id="halaman"> dari satu endpoint /api/...
 *
 * Semua halaman di sini berjalan TANPA AI. Tempat fitur AI ditempelkan diberi tanda "TITIK AI".
 * Cara menempelkan: tambahkan tombol berkelas btn-ai dengan atribut data-tanya berisi pertanyaan untuk asisten, mis.
 *   <button class="btn-ai kecil" data-tanya="Kenapa HPP Roti Cokelat naik bulan ini?">Kenapa?</button>
 * Klik pada tombol seperti itu otomatis diteruskan ke panel Asisten (lihat tanyaAsisten di app.js).
 * Ikon Asisten ditambahkan otomatis oleh kelas btn-ai. Tambahkan kelas "kecil" untuk tombol di dalam baris tabel.
 * Nilai yang disisipkan ke HTML harus lewat esc().
 */
const panel = (judul, sub, isi) =>
  `<section class="panel"><div class="panel-kepala"><h3>${esc(judul)}${sub ? `<span class="panel-sub">${esc(sub)}</span>` : ""}</h3></div>${isi}</section>`;
const delta = (teks) => !teks || teks === "-" ? `<span class="delta">–</span>`
  : `<span class="delta ${teks.startsWith("+") ? "baik" : teks.startsWith("-") ? "buruk" : ""}">${ikon(teks.startsWith("-") ? "turun" : "naik")}${esc(teks)}</span>`;

let grafikOmzet;

const HALAMAN = {
  async dashboard(el) {
    const d = await ambil("/api/dashboard");
    // TITIK AI (fitur A, briefing pagi): tombol di kanan judul halaman.
    let aksi = "";
    el.innerHTML = kepalaHalaman("Ringkasan", "Dashboard", aksi) + `
      <section class="statistik">${d.kartu.map((k) => `<div class="stat ${k.terkunci ? "terkunci" : ""}"><span class="stat-label">${esc(k.label)}</span>
        <span class="stat-nilai ${String(k.nilai).length > 16 ? "stat-teks" : ""}" title="${esc(k.nilai)}">${esc(k.nilai)}</span><span class="stat-ket">${esc(k.catatan)}</span></div>`).join("")}</section>
      ${panel("Omzet", "12 bulan terakhir, Rp juta", `<div class="panel-isi"><div class="kotak-grafik"><canvas id="grafik-omzet"></canvas></div></div>`)}
      ${panel("Penjualan per produk", d.judul_bulan, `<table class="tabel"><thead><tr><th>Produk</th><th>Kategori</th><th class="r">Qty</th><th class="r">Nilai</th><th class="r">vs bulan lalu</th></tr></thead>
        <tbody>${d.produk.map((p) => `<tr><td><b>${esc(p.produk)}</b></td><td class="redup">${esc(p.kategori)}</td>
          <td class="r">${angka(p.qty)}</td><td class="r">${esc(p.nilai_fmt)}</td><td class="r">${delta(p.perubahan)}</td></tr>`).join("")}</tbody></table>`)}`;
    grafikOmzet?.destroy();
    grafikOmzet = buatGrafik($("#grafik-omzet"), { tipe: "bar", label: d.grafik.label, seri: [{ nama: "Omzet (Rp juta)", data: d.grafik.data }] });
  },

  async penjualan(el) {
    const d = await ambil("/api/faktur");
    // TITIK AI (fitur C, pesanan dari email): panel di atas tabel faktur.
    let panelEmail = "";
    el.innerHTML = kepalaHalaman("Penjualan", "Faktur penjualan") + panelEmail + panel("Faktur terakhir", "25 faktur", `
      <table class="tabel"><thead><tr><th>Nomor</th><th>Tanggal</th><th>Customer</th><th>Kota</th><th class="r">Item</th><th class="r">Nilai</th></tr></thead>
        <tbody>${d.data.map((f) => `<tr><td><span class="kode">${esc(f.nomor_faktur)}</span></td><td class="redup">${esc(f.tanggal)}</td><td><b>${esc(f.customer)}</b></td>
          <td class="redup">${esc(f.kota)}</td><td class="r">${angka(f.jumlah_item)}</td><td class="r">${esc(f.nilai_fmt)}</td></tr>`).join("")}</tbody></table>`);
  },

  async persediaan(el) {
    const d = await ambil("/api/stok");
    el.innerHTML = kepalaHalaman("Persediaan", "Stok gudang") + panel("Stok per gudang", `${angka(d.di_bawah_minimum)} baris di bawah minimum`, `
      <table class="tabel"><thead><tr><th>Produk</th><th>Gudang</th><th class="r">Stok</th><th class="r">Minimum</th><th>Status</th></tr></thead>
        <tbody>${d.data.map((s) => `<tr><td><b>${esc(s.produk)}</b></td><td class="redup">${esc(s.gudang)}</td><td class="r">${angka(s.qty)}</td>
          <td class="r redup">${angka(s.stok_minimum)}</td><td>${s.di_bawah_minimum ? `<span class="badge b-bahaya"><i></i>Di bawah minimum</span>` : `<span class="badge b-sukses"><i></i>Aman</span>`}</td></tr>`).join("")}</tbody></table>`);
  },

  async hpp(el) {
    const d = await ambil("/api/hpp");
    // TITIK AI (Tahap 2, tombol "Kenapa?"): kolom terakhir tabel, untuk produk yang HPP-nya naik.
    const tombol = (p) => {
      return "";
    };
    el.innerHTML = kepalaHalaman("Produksi & HPP", "HPP per unit") + panel("HPP per unit", `${d.bulan} dibanding ${d.bulan_lalu}`, `
      <table class="tabel"><thead><tr><th>Produk</th><th class="r">HPP bulan lalu</th><th class="r">HPP bulan ini</th><th class="r">Perubahan</th><th class="r">Margin kotor</th><th></th><th></th></tr></thead>
        <tbody>${d.data.map((p) => `<tr><td><b>${esc(p.produk)}</b></td><td class="r redup">${esc(p.hpp_lalu_fmt)}</td><td class="r">${esc(p.hpp_kini_fmt)}</td>
          <td class="r ${p.perubahan_persen > 0 ? "t-bahaya" : p.perubahan_persen < 0 ? "t-sukses" : ""}">${esc(p.perubahan_fmt)}</td><td class="r">${esc(p.margin_fmt)}</td>
          <td>${p.wajib_kajian ? `<span class="badge b-peringatan"><i></i>Wajib kajian</span>` : ""}</td><td class="r">${tombol(p)}</td></tr>`).join("")}</tbody></table>`);
  },

  async keuangan(el) {
    const d = await ambil("/api/piutang");
    // TITIK AI (fitur B, surat penagihan): kolom terakhir tabel, untuk customer yang lewat jatuh tempo.
    const tombol = (c) => {
      return "";
    };
    el.innerHTML = kepalaHalaman("Keuangan", "Umur piutang") + panel("Piutang per customer", `posisi ${d.posisi}, total ${d.total_fmt}`, `
      <table class="tabel"><thead><tr><th>Customer</th><th>Kota</th><th>Segmen</th><th class="r">Faktur</th><th class="r">Sisa piutang</th><th>Lewat jatuh tempo</th><th></th></tr></thead>
        <tbody>${d.data.map((c) => `<tr><td><b>${esc(c.customer)}</b></td><td class="redup">${esc(c.kota)}</td><td class="redup">${esc(c.segmen)}</td><td class="r">${angka(c.jumlah_faktur)}</td>
          <td class="r">${esc(c.sisa_fmt)}</td><td>${c.hari_terlama > 60 ? `<span class="badge b-bahaya"><i></i>${angka(c.hari_terlama)} hari</span>`
            : c.hari_terlama > 0 ? `<span class="badge b-peringatan"><i></i>${angka(c.hari_terlama)} hari</span>` : `<span class="badge b-sukses"><i></i>Lancar</span>`}</td>
          <td class="r">${tombol(c)}</td></tr>`).join("")}</tbody></table>`);
  },

  async dokumen(el) {
    const d = await ambil("/api/dokumen");
    el.innerHTML = kepalaHalaman("Dokumen", "SOP & kebijakan") + `<div class="dok">
      <section class="panel">${d.data.map((x) => `<button class="dok-item" data-file="${esc(x.file)}">${ikon("teks")}<span><b>${esc(x.judul)}</b><small>${esc(x.nomor)}</small></span></button>`).join("")}</section>
      <section class="panel" id="dok-isi"><div class="kosong">${ikon("dokumen")}<b>Pilih dokumen di kiri</b><span>Dokumen ini juga menjadi sumber RAG di Tahap 4.</span></div></section></div>`;
    el.querySelectorAll(".dok-item").forEach((b) => (b.onclick = async () => {
      el.querySelectorAll(".dok-item").forEach((x) => x.classList.toggle("aktif", x === b));
      const dok = await ambil("/api/dokumen/" + encodeURIComponent(b.dataset.file));
      $("#dok-isi").innerHTML = `<div class="dok-markdown">${markdown(dok.isi)}</div>`;
    }));
  },

  async log(el) {
    const d = await (await fetch("/api/log")).json();
    const isi = !d.siap
      ? `<div class="kosong">${ikon("aktivitas")}<b>Jejak audit belum dibuat</b><span>Modul <code>asisten/audit.py</code> dibangun di Tahap 3.</span></div>`
      : !d.data.length ? `<div class="kosong">${ikon("aktivitas")}<b>Belum ada pertanyaan yang tercatat</b></div>`
      : `<table class="tabel"><thead><tr><th>Waktu</th><th>User</th><th>Pertanyaan</th><th>Tool (status)</th><th class="r">Durasi</th></tr></thead>
        <tbody>${d.data.map((x) => `<tr><td class="redup">${esc(String(x.waktu).replace("T", " "))}</td><td><b>${esc(x.pengguna)}</b></td><td>${esc(String(x.pertanyaan).slice(0, 140))}</td>
          <td>${(x.tools || []).map((t) => `<span class="badge ${t.status === "ok" ? "" : "b-bahaya"}">${esc(t.nama)} · ${esc(t.status)}</span>`).join(" ") || `<span class="redup">–</span>`}</td>
          <td class="r">${detik(x.durasi_ms || 0)}</td></tr>`).join("")}</tbody></table>`;
    el.innerHTML = kepalaHalaman("Pengaturan", "Log aktivitas AI") + panel("Setiap pertanyaan ke Asisten", "siapa bertanya apa, tool mana yang dipakai atau ditolak", isi);
  },
};
