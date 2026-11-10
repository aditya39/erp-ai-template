"""
ERP mini PT Nusantara Rasa (data dummy) + panel Asisten AI.

  python -m web                 # buka http://localhost:8000
  python -m web --port 8001     # kalau port 8000 sudah dipakai

Halaman ERP (dashboard, penjualan, persediaan, HPP, piutang, dokumen) sudah jadi dan TIDAK memakai AI.
Fitur AI ditambahkan lewat /api/chat, yang meneruskan pertanyaan ke asisten.agent.jalankan().
"""
from __future__ import annotations

import ipaddress
import json
import re
import time
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from asisten import agent, config, db, pengguna, tools
from asisten import format as fmt

STATIC = config.ROOT / "web" / "static"
app = FastAPI(title="ERP mini Nusantara Rasa — template workshop")
app.mount("/static", StaticFiles(directory=STATIC), name="static")


def _butuh_izin(kode: str, izin: str) -> None:
    """Halaman ERP memakai daftar izin yang sama dengan tool AI (asisten/pengguna.py)."""
    if kode not in pengguna.PENGGUNA:
        raise HTTPException(400, "pengguna tidak dikenal")
    if not pengguna.punya_izin(kode, izin):
        raise HTTPException(403, f"Tidak ada akses ke {pengguna.NAMA_IZIN.get(izin, izin)}.")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC / "index.html")


@app.get("/favicon.ico", include_in_schema=False)
def favicon() -> Response:
    return Response(status_code=204)


def _keluar_jaringan(url: str) -> bool:
    """True bila endpoint model ada di internet (bukan laptop ini atau jaringan lokal). Dipakai untuk keterangan di panel."""
    host = (urlparse(url).hostname or "").lower()
    if not host or host == "localhost":
        return False
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return "." in host   # nama domain publik, mis. api.anthropic.com
    return not (ip.is_private or ip.is_loopback or ip.is_link_local)


@app.get("/api/info")
def info() -> dict:
    i = db.info()
    return {
        "perusahaan": i["nama_perusahaan"],
        "tanggal_posisi": i["tanggal_posisi"].isoformat(),
        "bulan_terakhir": fmt.bulan(i["bulan_terakhir"]),
        "lokal": {"model": config.LOKAL.label, "aktif": config.LOKAL.aktif, "keluar": _keluar_jaringan(config.LOKAL.base_url)},
        "cloud": {"model": config.CLOUD.label, "aktif": config.CLOUD.aktif, "keluar": _keluar_jaringan(config.CLOUD.base_url)},
        "semua_izin": pengguna.NAMA_IZIN,
        "pengguna": [{"kode": k, "nama": v["nama"], "jabatan": v["jabatan"], "kode_izin": v["izin"],
                      "izin": [pengguna.NAMA_IZIN[x] for x in v["izin"]]} for k, v in pengguna.PENGGUNA.items()],
        "tools": [{"nama": t.nama, "izin": t.izin} for t in tools.REGISTRY.values()],
    }


# ---------------------------------------------------------------------------
# Halaman ERP (tanpa AI)
# ---------------------------------------------------------------------------
@app.get("/api/dashboard")
def dashboard(pengguna_kode: str = "budi") -> dict:
    _butuh_izin(pengguna_kode, "penjualan")
    i = db.info()
    akhir = i["bulan_terakhir"]
    lalu = fmt.tambah_bulan(akhir, -1)
    awal12 = fmt.tambah_bulan(akhir, -11)
    bulanan = db.query(
        """SELECT bulan, sum(nilai) AS nilai, count(DISTINCT nomor_faktur) AS faktur
           FROM ai.v_penjualan WHERE bulan BETWEEN %(a)s AND %(b)s GROUP BY bulan ORDER BY bulan""",
        {"a": awal12, "b": akhir})
    per_bln = {b["bulan"]: b for b in bulanan}
    kini, sebelum = per_bln.get(akhir.isoformat(), {}), per_bln.get(lalu.isoformat(), {})
    produk = db.query(
        """SELECT produk, kategori,
                  sum(qty) FILTER (WHERE bulan = %(b)s) AS qty,
                  sum(nilai) FILTER (WHERE bulan = %(b)s) AS nilai,
                  sum(qty) FILTER (WHERE bulan = %(l)s) AS qty_lalu
           FROM ai.v_penjualan WHERE bulan IN (%(b)s, %(l)s)
           GROUP BY produk, kategori ORDER BY nilai DESC NULLS LAST""",
        {"b": akhir, "l": lalu})
    for p in produk:
        p["nilai_fmt"] = fmt.rupiah(p["nilai"] or 0)
        p["perubahan"] = fmt.persen(fmt.ubah_persen(p["qty_lalu"] or 0, p["qty"] or 0))
    kartu = [
        {"label": f"Omzet {fmt.bulan(akhir)}", "nilai": fmt.rupiah(kini.get("nilai", 0)),
         "catatan": f"{fmt.persen(fmt.ubah_persen(sebelum.get('nilai', 0), kini.get('nilai', 0)))} dari bulan lalu"},
        {"label": "Jumlah faktur", "nilai": fmt.angka(kini.get("faktur", 0)), "catatan": fmt.bulan(akhir)},
        {"label": "Produk terlaris (nilai)", "nilai": produk[0]["produk"] if produk else "-",
         "catatan": produk[0]["nilai_fmt"] if produk else ""},
    ]
    if pengguna.punya_izin(pengguna_kode, "piutang"):
        piutang = db.query("""SELECT coalesce(sum(sisa), 0) AS sisa, count(*) AS faktur
                              FROM ai.v_piutang WHERE hari_lewat_jatuh_tempo > 0""")[0]
        kartu.append({"label": "Piutang lewat jatuh tempo", "nilai": fmt.rupiah(piutang["sisa"]),
                      "catatan": f"{piutang['faktur']} faktur"})
    else:
        kartu.append({"label": "Piutang lewat jatuh tempo", "nilai": "—", "catatan": "tidak ada akses", "terkunci": True})
    return {
        "judul_bulan": fmt.bulan(akhir),
        "kartu": kartu,
        "grafik": {"label": [fmt.bulan_pendek(b["bulan"]) for b in bulanan],
                   "data": [round(b["nilai"] / 1e6) for b in bulanan]},
        "produk": produk,
    }


@app.get("/api/faktur")
def faktur(pengguna_kode: str = "budi") -> dict:
    _butuh_izin(pengguna_kode, "penjualan")
    baris = db.query(
        """SELECT nomor_faktur, tanggal, customer, kota, count(*) AS jumlah_item, sum(nilai) AS nilai
           FROM ai.v_penjualan GROUP BY nomor_faktur, tanggal, customer, kota
           ORDER BY tanggal DESC, nomor_faktur DESC LIMIT 25""")
    for b in baris:
        b["nilai_fmt"] = "Rp " + fmt.angka(b["nilai"])
    return {"data": baris}


@app.get("/api/stok")
def stok(pengguna_kode: str = "budi") -> dict:
    _butuh_izin(pengguna_kode, "stok")
    baris = db.query(
        """SELECT produk, kode_produk, gudang, qty, stok_minimum, di_bawah_minimum
           FROM ai.v_stok ORDER BY di_bawah_minimum DESC, (qty - stok_minimum), produk""")
    return {"data": baris, "di_bawah_minimum": sum(1 for b in baris if b["di_bawah_minimum"])}


@app.get("/api/hpp")
def hpp(pengguna_kode: str = "budi") -> dict:
    _butuh_izin(pengguna_kode, "hpp")
    akhir = db.info()["bulan_terakhir"]
    lalu = fmt.tambah_bulan(akhir, -1)
    baris = db.query(
        """SELECT h.produk, h.kode_produk, p.harga_jual,
                  max(h.hpp_per_unit) FILTER (WHERE h.bulan = %(b)s) AS hpp_kini,
                  max(h.hpp_per_unit) FILTER (WHERE h.bulan = %(l)s) AS hpp_lalu
           FROM ai.v_hpp_bulanan h JOIN ai.v_produk p ON p.id = h.produk_id
           WHERE h.bulan IN (%(b)s, %(l)s)
           GROUP BY h.produk, h.kode_produk, p.harga_jual ORDER BY h.produk""",
        {"b": akhir, "l": lalu})
    for b in baris:
        ubah = fmt.ubah_persen(b["hpp_lalu"] or 0, b["hpp_kini"] or 0)
        b["perubahan_persen"] = ubah
        b["perubahan_fmt"] = fmt.persen(ubah)
        b["hpp_kini_fmt"], b["hpp_lalu_fmt"] = fmt.rupiah(b["hpp_kini"] or 0), fmt.rupiah(b["hpp_lalu"] or 0)
        b["margin_fmt"] = fmt.persen((b["harga_jual"] - (b["hpp_kini"] or 0)) / b["harga_jual"] * 100, tanda=False)
        b["wajib_kajian"] = ubah is not None and ubah > 8   # aturan di Panduan Perhitungan HPP
    baris.sort(key=lambda b: -(b["perubahan_persen"] or 0))
    return {"bulan": fmt.bulan(akhir), "bulan_lalu": fmt.bulan(lalu), "data": baris}


@app.get("/api/piutang")
def piutang(pengguna_kode: str = "budi") -> dict:
    _butuh_izin(pengguna_kode, "piutang")
    baris = db.query(
        """SELECT customer, kota, segmen, count(*) AS jumlah_faktur, sum(sisa) AS sisa,
                  max(hari_lewat_jatuh_tempo) AS hari_terlama
           FROM ai.v_piutang GROUP BY customer, kota, segmen ORDER BY sisa DESC LIMIT 40""")
    for b in baris:
        b["sisa_fmt"] = fmt.rupiah(b["sisa"])
    total = db.query("SELECT coalesce(sum(sisa), 0) AS sisa FROM ai.v_piutang")[0]["sisa"]
    return {"posisi": f"{db.info()['tanggal_posisi']:%d-%m-%Y}", "total_fmt": fmt.rupiah(total), "data": baris}


def _judul_dokumen(path) -> dict:
    teks = path.read_text(encoding="utf-8")
    judul = next((b[2:].strip() for b in teks.splitlines() if b.startswith("# ")), path.stem)
    nomor = re.search(r"Nomor dokumen:\s*([A-Z0-9-]+)", teks)
    return {"file": path.name, "judul": judul, "nomor": nomor.group(1) if nomor else ""}


@app.get("/api/dokumen")
def dokumen(pengguna_kode: str = "budi") -> dict:
    _butuh_izin(pengguna_kode, "dokumen")
    return {"data": [_judul_dokumen(p) for p in sorted(config.FOLDER_DOKUMEN.glob("*.md"))]}


@app.get("/api/dokumen/{nama}")
def isi_dokumen(nama: str, pengguna_kode: str = "budi") -> dict:
    _butuh_izin(pengguna_kode, "dokumen")
    path = (config.FOLDER_DOKUMEN / nama).resolve()
    if path.parent != config.FOLDER_DOKUMEN.resolve() or path.suffix != ".md" or not path.exists():
        raise HTTPException(404, "dokumen tidak ditemukan")
    return {**_judul_dokumen(path), "isi": path.read_text(encoding="utf-8")}


@app.get("/api/log")
def log_aktivitas() -> dict:
    """Jejak audit asisten. Modul asisten/audit.py dibangun di Tahap 3; sebelum itu daftarnya kosong."""
    try:
        from asisten import audit
    except ImportError:
        return {"siap": False, "data": []}
    return {"siap": True, "data": audit.baca(100)}


# ---------------------------------------------------------------------------
# Asisten AI
# ---------------------------------------------------------------------------
class Permintaan(BaseModel):
    pesan: str
    pengguna: str = "budi"
    mode: str = "lokal"
    riwayat: list[dict] = []


@app.post("/api/chat")
def chat(p: Permintaan) -> StreamingResponse:
    """Meneruskan pertanyaan ke agent dan mengalirkan event-nya ke layar (Server-Sent Events)."""
    if p.pengguna not in pengguna.PENGGUNA:
        raise HTTPException(400, "pengguna tidak dikenal")
    if p.mode not in ("lokal", "cloud"):
        raise HTTPException(400, "mode harus lokal atau cloud")

    def alir():
        t0 = time.perf_counter()
        for ev in agent.jalankan(p.pesan, p.pengguna, p.mode, p.riwayat):
            ev = {**ev, "t": int((time.perf_counter() - t0) * 1000)}
            yield f"data: {json.dumps(ev, ensure_ascii=False, default=str)}\n\n"

    return StreamingResponse(alir(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
