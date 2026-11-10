# Tahap 5A — Briefing pagi

**Waktu:** 22 menit. **Hasil:** tombol **Briefing pagi** di Dashboard. Sekali klik, asisten merangkum hal yang perlu ditindak hari ini.

**Untuk siapa di klien:** direktur operasional atau manajer yang setiap pagi membuka tiga laporan berbeda.
**Pola:** agent dengan beberapa tool baca. Risikonya rendah karena tidak ada yang ditulis.

## Prompt untuk Claude Code

```
Kerjakan Tahap 5A (kartu/5a-briefing-pagi.md). Ikuti AGENTS.md.

1. Tambahkan tiga tool di asisten/tools_tambahan.py:
   - stok_di_bawah_minimum(jumlah: int = 5), izin "stok":
     produk yang stoknya di bawah stok minimum per gudang, dari kekurangan terbesar.
   - piutang_terbesar(jumlah: int = 5, min_hari_lewat_jatuh_tempo: int = 0), izin "piutang":
     customer dengan sisa piutang terbesar, jumlah faktur, dan hari terlama lewat jatuh tempo.
   - margin_produk(jumlah: int = 5), izin "hpp":
     margin kotor per produk bulan terakhir (harga jual dibanding HPP per unit), dari yang paling tipis.
2. Di web/static/halaman.js, halaman Dashboard (TITIK AI): tombol "Briefing pagi" yang mengirim
   pertanyaan: "Buat ringkasan pagi untuk saya: stok yang di bawah minimum, piutang yang paling
   perlu ditagih, dan produk dengan margin paling tipis. Urutkan dari yang paling mendesak,
   maksimal 6 poin, sertakan angkanya."

Selesai kalau `python -m pytest tests/test_tahap5a.py -q` lulus dan tahap sebelumnya tetap lulus.
```

## Cek hasil

Jalankan ulang `python -m web`. Klik **Briefing pagi** sebagai Budi, lalu sebagai Andi. Bandingkan: tool mana yang ditolak untuk Andi, dan bagaimana asisten menjelaskannya?

## Siapkan untuk ditunjukkan (2 menit)

1. Klik tombolnya di depan kelas, buka langkah agent.
2. Satu kalimat: fitur ini menggantikan pekerjaan apa di klien kalian?
3. Satu hal yang masih kurang sebelum fitur ini layak dirilis.
