# Tahap 0 — Kenali template

**Waktu:** 10 menit. **Belum ada yang dibangun di tahap ini.**

## Jalankan

```bash
python scripts/cek_setup.py      # semua baris ✓
python -m web                    # buka http://localhost:8000
```

Lihat-lihat dulu halamannya: Dashboard, Penjualan, Persediaan, Produksi & HPP, Keuangan, Dokumen. Ganti user di kanan atas ("Masuk sebagai") dan perhatikan halaman mana yang tertutup untuk Andi.

## Coba tanya asisten

Di panel Asisten, coba dua pertanyaan ini:

1. `Berapa penjualan Biskuit Kelapa bulan lalu?`
2. `Cari produk roti`

Catat apa yang terjadi:

- Di pertanyaan 1, model kadang mengarang angka dan kadang mengaku tidak punya akses. Artinya sama: model tidak tahu data perusahaan. Kalau ada angka, bandingkan dengan tabel di Dashboard.
- Di pertanyaan 2, model **meminta** tool `cari_produk`, tetapi tidak ada yang menjalankannya. Model hanya bisa meminta. Yang menjalankan query nanti adalah kode kalian.

## Lihat kodenya (5 menit, bagi dua)

| Buka | Cari |
|---|---|
| `asisten/agent.py` | fungsi `jalankan()`: berapa kali model ditanya? |
| `asisten/tools.py` | tool `cari_produk`: deskripsi, parameter, izin, query |
| `AGENTS.md` | aturan yang akan diikuti Claude Code di proyek ini |

Setelah itu buka Claude Code di folder ini (`claude`) dan lanjut ke Tahap 1.
