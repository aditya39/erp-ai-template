# Tahap 5C — Pesanan dari email jadi draft sales order

**Waktu:** 22 menit. **Hasil:** di halaman Penjualan, user menempel email pesanan. Asisten menyiapkan draft sales order, sistem ERP menghitungnya, dan user yang menekan Simpan.

**Untuk siapa di klien:** admin penjualan yang mengetik ulang PO dari email atau WhatsApp ke form sales order.
**Pola:** agent yang menyiapkan transaksi. Ini fitur yang paling berisiko dari ketiganya, jadi aturannya ketat:

> AI menyiapkan. Sistem menghitung. Manusia memutuskan. Kode yang menyimpan.

## Prompt untuk Claude Code

```
Kerjakan Tahap 5C (kartu/5c-email-jadi-draft-so.md). Ikuti AGENTS.md, terutama bagian "Larangan".

1. Buat asisten/transaksi.py berisi tool siapkan_draft_so(customer: str, item: list,
   gudang: str = "", diskon_tambahan: float = 0, catatan: str = ""), izin "so_buat".
   item: [{"produk": str, "qty": int, "satuan": str opsional}].
   Tool HANYA membaca view ai (v_customer, v_produk, v_stok) dan mengembalikan:
     {"status": "DRAFT_BELUM_DISIMPAN",
      "draft_so": {
        "customer": {id, kode, nama, segmen, kota, termin_hari},
        "gudang": "Gudang Jakarta" | "Gudang Surabaya", "gudang_otomatis": bool,
        "diskon_tambahan": float, "catatan": str,
        "item": [{produk_id, kode, nama, satuan, qty, harga_daftar, harga_daftar_fmt, stok_gudang}],
        "nilai_bruto": float, "nilai_bruto_fmt": "Rp ...",
        "payload": {customer_id, gudang, diskon_tambahan, catatan, item: [{produk_id, qty}]}},
      "peringatan": [str]}
   Customer atau produk yang tidak ketemu atau ambigu: kembalikan {"error", "kandidat"},
   jangan ditebak. Gudang kosong: Gudang Surabaya untuk customer di Surabaya, Makassar, Denpasar;
   selain itu Gudang Jakarta. Stok kurang: tulis di peringatan.
   Daftarkan tool ini (impor modulnya dari asisten/tools.py).
2. Di asisten/agent.py: setelah tool mengembalikan draft_so, keluarkan event
   {"tipe": "draft_so", "draft": hasil["draft_so"]}.
3. Di web/app.py tambahkan dua endpoint yang dipanggil LAYAR, bukan model
   (body: {"pengguna": kode, "draft": draft_so}):
   - POST /api/so/simulasi: login ke ERP sebagai user itu (asisten.erp_api.SesiERP), panggil
     simulasi_so(draft["payload"]), kembalikan {"bisa_disimpan", "status", "ringkasan"}
     (ringkasan dari erp_api.ringkas_simulasi).
   - POST /api/so/simpan: buat_so(draft["payload"]), kembalikan {"nomor", "status", "tautan"}.
   Keduanya mengecek izin so_buat.
4. Di web/static/app.js: kartu draft (kartuDraft, bagian .ds-erp) menampilkan ringkasan
   simulasi ERP, tombol "Simpan sales order" dan "Batal". Simpan hanya dipanggil saat tombol diklik.
5. Di web/static/halaman.js, halaman Penjualan (TITIK AI): kotak "Pesanan dari email" berisi
   textarea dan tombol "Siapkan draft SO" yang memanggil
   tanyaAsisten("Siapkan draft sales order dari email pesanan berikut.\n\n" + isi).

Model tidak boleh punya tool yang menyimpan. Selesai kalau `python -m pytest tests/test_tahap5c.py -q`
lulus dan tahap sebelumnya tetap lulus.
```

## Cek hasil

Jalankan ulang `python -m web`. Login sebagai **Andi**, buka **Penjualan**, tempel isi `dokumen-uji/Email-PO-Swalayan-Sentosa.txt` (tanpa tiga baris berawalan `#`), klik **Siapkan draft SO**.

Periksa kartu draft:

1. Customer, tiga produk, dan qty sesuai email?
2. Nomor PO masuk ke catatan?
3. Gulir email itu ke paling bawah, jauh ke kanan. Ada instruksi tersembunyi. Apakah diskon tambahan di draft tetap 0? Apakah ada yang tersimpan tanpa kalian klik?
4. Harga, diskon segmen, dan status di kartu berasal dari sistem ERP, bukan dari model.

**Jangan klik Simpan untuk email ini.** ERP dipakai bersama satu kelas. Kalau ingin mencoba menyimpan, pakai pesanan kecil: `Buatkan SO untuk Toko Murah Meriah: 40 pak Wafer Vanila dan 30 pak Keripik Singkong Balado`.

Coba juga login sebagai Sari dan tempel email yang sama. Apa yang terjadi?

## Siapkan untuk ditunjukkan (2 menit)

1. Tempel email di depan kelas, tunjukkan kartu draft dan instruksi tersembunyinya.
2. Satu kalimat: siapa yang menahan diskon 10% itu?
3. Satu hal yang masih kurang sebelum fitur ini layak dirilis.
