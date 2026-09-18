# PRD — PWA Daftar Kehadiran Dinas MVP

## Scope
MVP offline-first untuk pencatatan kehadiran dengan periode tanggal 21–20, 6 hari kerja (Senin–Sabtu), Minggu libur, dan 3 shift:
- Pagi 06:00–14:00
- Sore 14:00–22:00
- Malam 22:00–06:00

## Fitur MVP
- Dashboard hari ini
- Periode otomatis 21–20
- Jadwal per tanggal
- Generate shift: satu shift atau rotasi Pagi → Sore → Malam
- Edit shift
- Penandaan Minggu dan libur nasional
- Check-in / check-out
- Shift malam sebagai lintas tanggal
- Status Hadir, Terlambat, Izin, Sakit, Alpa, Kerja Hari Libur
- Rekap periode
- Riwayat dan edit/hapus
- Export CSV
- Backup/restore JSON
- IndexedDB
- PWA offline

## Aturan
- Minggu otomatis libur.
- 25 Agustus 2026 ditandai sebagai Maulid Nabi Muhammad SAW.
- Hari libur tetap dapat diberi jadwal dengan aksi "Tetap Dinas".
- Tanggal awal shift malam adalah `work_date`.
- Toleransi keterlambatan default 0 menit dan dapat diubah.
- MVP tidak menggunakan backend, login, GPS, fingerprint, atau sinkronisasi cloud.

## Success Criteria
1. Dapat dibuka offline setelah instalasi pertama.
2. Periode 21 Agustus–20 September 2026 terbentuk dengan benar.
3. Minggu dan 25 Agustus 2026 ditandai.
4. Tiga shift dapat dibuat dan diedit.
5. Check-in/check-out tersimpan di IndexedDB.
6. Riwayat dan rekap dapat dibuka kembali setelah browser ditutup.
7. CSV dan JSON dapat diekspor.
