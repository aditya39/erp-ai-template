# Template ERP mini + Asisten AI

Template untuk praktik Hari 2 workshop Agentic AI. Isinya aplikasi ERP kecil yang **belum punya AI**.
Kalian yang menambahkan AI-nya, tahap demi tahap, dengan bantuan Claude Code.

> Seluruh data adalah data dummy perusahaan fiktif PT Nusantara Rasa. Jangan memakai source code atau data kantor.

```
 Layar ERP mini (web/)  ──►  agent (asisten/agent.py)  ──►  model (server workshop atau cloud)
   halaman + panel Asisten        │   ▲
                                  ▼   │ hasil tool
                         tools (asisten/tools.py)  ──►  PostgreSQL: view schema "ai", role read-only
                         cari_dokumen              ──►  pgvector: potongan dokumen SOP (RAG)
```

## Yang sudah ada dan yang kalian bangun

| Sudah ada di template | Kalian bangun |
|---|---|
| Halaman ERP: dashboard, penjualan, persediaan, HPP, piutang, dokumen | Tool yang membaca data ERP |
| Panel Asisten di kanan layar (tampilannya saja) | Agent loop |
| Koneksi database read-only, klien model, format angka | Pengaman dan jejak audit |
| Satu tool contoh (`cari_produk`) | RAG dari dokumen SOP |
| Tes penerimaan dan kartu untuk tiap tahap | Satu fitur AI pilihan di layar ERP |

## Persiapan

```bash
python3 -m venv .venv                # Windows: py -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                 # Windows: copy .env.example .env
```

Isi `.env`:

1. Tempel blok dari mentor di bagian bawah file. Isinya alamat server workshop (database, embedding, ERP) dan, kalau workshop memakai API, model chat Claude Haiku dengan key kelompok (profil (b) + (c) di `.env.example`). Kalau blok itu sudah memuat `LOKAL_*` yang menunjuk ke Haiku, langkah 3 di bawah boleh dilewati.
2. Isi `RAG_KOLEKSI` dengan nama unik untuk pasangan kalian, huruf kecil tanpa spasi, misalnya `budi_sari`. Kalau blok dari mentor sudah berisi baris `RAG_KOLEKSI=`, isi di baris itu, karena baris paling bawah yang terbaca.
3. Isi `CLOUD_BASE_URL`, `CLOUD_MODEL`, dan `CLOUD_API_KEY` dengan key kelompok dari mentor, supaya tombol **Cloud** di panel Asisten aktif. Contohnya ada di `.env.example`.

Lalu:

```bash
python scripts/cek_setup.py          # semua baris ✓
python -m web                        # buka http://localhost:8000
```

Paketnya sama dengan kit `asisten-erp-ai` (di repo [sofco-agentic-ai-materials](https://github.com/aditya39/sofco-agentic-ai-materials), folder `kit/asisten-erp-ai`). Kalau venv kit sudah ada, boleh dipakai: aktifkan venv itu, lalu jalankan perintah dari folder template ini.

## Tahap

Buka Claude Code di folder ini (`claude`), lalu ikuti kartu secara berurutan. Setiap kartu berisi prompt yang bisa disalin, cara mengecek hasil, dan beberapa hal yang perlu kalian pahami dari kode yang ditulis Claude Code.

| Tahap | Kartu | Yang terlihat di layar setelah selesai |
|---|---|---|
| 0 | `kartu/0-kenali-template.md` | ERP berjalan. Asisten menjawab tanpa data |
| 1 | `kartu/1-tool-penjualan.md` | Model meminta tool yang benar, tetapi belum ada yang menjalankannya |
| 2 | `kartu/2-agent-loop.md` | Asisten menjawab dari data. Tombol **Kenapa?** di halaman HPP |
| 3 | `kartu/3-pengaman.md` | User tanpa izin ditolak. Setiap pertanyaan tercatat di Log aktivitas AI |
| 4 | `kartu/4-rag.md` | Asisten menjawab aturan dari dokumen SOP dan menyebut sumbernya |
| 5 | `kartu/5a-briefing-pagi.md`, `5b-surat-penagihan.md`, `5c-email-jadi-draft-so.md` | Satu fitur pilihan kelompok |

Papan status: `python scripts/cek_tahap.py`.

## Kalau macet

- Baca pesan tes yang gagal: `python scripts/cek_tahap.py 2`. Pesannya menjelaskan apa yang diharapkan.
- Tempel pesan error ke Claude Code dan minta ia memperbaikinya.
- Kalau waktu habis, pasang kunci tahap itu supaya bisa lanjut: `python scripts/pasang_kunci.py 2`. File kalian disalin dulu ke `cadangan/`.

## Catatan keamanan

- Asisten memakai role database `erp_ai_readonly`: hanya SELECT pada view schema `ai` dan koleksi dokumen.
- `.env` tidak ikut git. Jangan menempel isinya ke Slack atau ke prompt.
- `.claude/settings.json` melarang Claude Code membaca `.env` dan `kunci.zip`, serta mengubah `tests/`.
- Dalam mode cloud (profil c), pertanyaan dan hasil query dikirim ke penyedia model. Di sini semuanya data dummy.

Setelah workshop, template ini bisa dijalankan tanpa server workshop: database dan Ollama dijalankan sendiri dengan langkah di `README.md` kit `asisten-erp-ai` (di repo [sofco-agentic-ai-materials](https://github.com/aditya39/sofco-agentic-ai-materials), folder `kit/asisten-erp-ai`).

Tampilannya memakai design system yang sama dengan ERP Nusantara Rasa. Chart.js 4.5.1 (MIT) dan font Inter (SIL OFL) ada di `web/static/vendor/`, dan ikon Lucide (ISC) di `web/static/ikon.js`, supaya aplikasi berjalan tanpa internet.
