# Handoff Lengkap — Gapura IAP Tracker

Dokumen ini merangkum seluruh percakapan, keputusan, perubahan, konfigurasi, pengujian, kendala, dan status terakhir proyek agar pekerjaan dapat dilanjutkan di task/chat lain tanpa kehilangan konteks.

## 1. Identitas proyek

- Nama proyek/repository: `gapura-iap-tracker`
- GitHub: <https://github.com/ocscustomerservicegpkps/gapura-iap-tracker>
- Branch aktif: `main`
- Folder lokal: `G:\Gapura Angkasa\--- WEBSITE ONE CLICK\- IAP Monitoring`
- Commit awal yang diminta user: `35212b209a9c998da67510883eb832d809d0ba8a`
- Commit awal tersebut sudah diverifikasi sebagai ancestor dari versi proyek saat ini.
- Remote `origin` mengarah ke repository GitHub di atas.
- HEAD terakhir yang diketahui sudah di-push: `b88ff3ab009af7a0c18620a912f179d2da9e0102`.

## 2. Aturan wajib dari user

1. Jangan menghapus file/folder konfigurasi bernama `env.local`; dalam proyek aktual file yang digunakan adalah `.env.local`.
2. `.env.local` tidak boleh dimasukkan ke Git, commit, atau GitHub.
3. Jangan pernah menampilkan nilai rahasia dari `.env.local`, termasuk private key, OAuth client secret, dan refresh token.
4. Untuk perubahan berikutnya, **jangan langsung commit atau push**. Setelah perubahan dan review selesai, wajib bertanya dan menunggu izin eksplisit user sebelum commit/push.
5. Menjalankan aplikasi, menguji, dan melakukan review lokal boleh dilakukan tanpa push.
6. Jika tampilan browser terlihat lama, lakukan reload/`Ctrl+F5` dan pastikan tab yang dipakai adalah instance terbaru.

## 3. Riwayat permintaan user

Urutan kebutuhan yang disampaikan selama pengerjaan:

1. Menarik penuh repository GitHub dari commit yang diberikan dan menjalankannya di lokal tanpa error, dengan larangan menghapus `env.local`.
2. Mengubah label status yang masih berbahasa Indonesia ke bahasa Inggris:
   - `Selesai` menjadi `Completed`
   - `Sedang Berjalan` menjadi `Ongoing`
   - `Belum Dimulai` menjadi `Not Started`
   - `Terlambat (Overdue)` atau `Terlambat` menjadi `Overdue`
3. Perubahan status berlaku ke semua tampilan status case yang masih berbahasa Indonesia.
4. Melakukan code review, kemudian push setelah user memberi izin.
5. Mengembalikan logic menu **Konteks** agar data konteks case kembali tampil.
6. Menyimpan data konteks ke sheet `Tracker`, dengan kolom konteks ditambahkan setelah kolom Q.
7. Menghentikan server lokal ketika diminta.
8. Menambah kolom `Status` pada tabel `II. MATRIKS RENCANA PERBAIKAN (IMPROVEMENT ACTION PLAN MATRIX)` untuk hasil PDF dan DOCX, tepat setelah `Timeline` dan sebelum `PIC`.
9. Awalnya user meminta pilihan ekspor Bahasa Indonesia/English. Untuk versi English seluruh materi harus diterjemahkan secara natural dengan skill humanizer. Kemudian user meminta menu pilihan bahasa tersebut di-hide terlebih dahulu. Status terakhir: menu bahasa tetap disembunyikan.
10. Menambahkan tombol download PDF dan DOCX pada setiap baris item di tabel **Tracker — Seluruh Item Aksi**.
11. Ekspor per item harus hanya memuat materi/langkah milik item yang dipilih, bukan seluruh langkah case.
12. Evidence harus dapat diberikan melalui tiga pilihan:
    - link evidence;
    - foto;
    - dokumen PDF/Word (`.pdf`, `.doc`, `.docx`).
13. File foto/dokumen harus masuk ke folder Google Drive Evidence IAP. Share link hasil upload harus ditulis ke sheet `Tracker` kolom Q (`Link Evidence`) dan tampil di UI tabel seluruh item aksi.
14. Menu **+ Kasus IAP Baru** juga harus menyediakan tiga metode evidence tersebut pada langkah terakhir.
15. Nama file yang masuk Drive harus memuat ID/flight number, tanggal, station, langkah, dan nama file asli.
16. Tombol **Ubah** pada **Ringkasan per Kasus IAP** harus menyediakan evidence dengan tiga metode yang sama.
17. Pada Ubah case, user bisa menerapkan evidence ke semua langkah perbaikan atau memilih langkah tertentu melalui checkbox berdasarkan langkah yang sudah ada.
18. Evidence baru tidak boleh menimpa evidence lama. Setiap URL harus ditambahkan pada baris baru di sel Q yang sama.
19. User melaporkan beberapa kali bahwa upload file dari UI tidak bekerja dan tidak ada file di Drive maupun URL di kolom Q. Alur OAuth dan implementasi upload kemudian diperbaiki serta diuji.
20. User menegaskan bahwa push tidak boleh dilakukan otomatis di masa mendatang.
21. User mempertanyakan tujuan dan waktu push. Remote telah diperiksa dan push ulang dilakukan ke repository/branch yang benar.

## 4. Commit yang relevan

Urutan commit terbaru yang diketahui:

- `b88ff3a` — `Trigger deployment for evidence upload fix` (empty commit untuk memicu deployment)
- `8c1dcb1` — `Fix evidence uploads with Drive OAuth`
- `8236818` — `Add targeted case evidence history`
- `956cd47` — `Add per-step exports and Drive evidence uploads`
- `762eeed` — `Add status to exports and item download actions`
- `a501dda` — `Store case context in Tracker columns`
- `cbe27d8` — `Untrack generated TypeScript files`
- `59880c1` — `Merge branch 'master'`

Catatan penting: setelah dokumen handoff ini dibuat, worktree akan memiliki file Markdown baru. Jangan commit/push file ini atau perubahan selanjutnya tanpa izin eksplisit user.

## 5. Google Sheets

- Spreadsheet ID: `1eY_kLvI9vOkGoMJ3g1ix41O0zlQQI0wqIOU2JMbkdmw`
- Nama spreadsheet: `IAP Monitor Tracker (4)`
- Tab yang diketahui:
  - `Dashboard`
  - `Tracker`
  - `Instruksi`
  - `Konteks`
- Locale spreadsheet: `en_US`
- Timezone spreadsheet: `America/Los_Angeles`

### Struktur kolom penting pada sheet Tracker

- Kolom P harus tetap terlindungi dari penulisan evidence.
- Kolom Q adalah `Link Evidence`.
- Data konteks case disimpan pada kolom R sampai W, sesudah kolom Q.
- URL evidence dalam Q disimpan satu URL per baris di dalam sel yang sama.
- Evidence baru harus di-append dengan newline, tidak menggantikan isi sebelumnya.
- Hanya URL valid berawalan `http://` atau `https://` yang boleh disimpan/ditampilkan sebagai tautan.
- UI harus menampilkan seluruh tautan evidence yang ada, bukan hanya tautan pertama.

## 6. Status UI dan kompatibilitas data

Label status yang terlihat oleh user sudah menggunakan bahasa Inggris:

| Nilai/label lama | Label UI |
|---|---|
| Selesai | Completed |
| Sedang Berjalan | Ongoing |
| Belum Dimulai | Not Started |
| Terlambat / Terlambat (Overdue) | Overdue |

Nilai internal dan nilai yang tersimpan di spreadsheet tetap dapat menggunakan Bahasa Indonesia agar kompatibel dengan data dan formula yang sudah ada. Status Overdue dihitung otomatis berdasarkan tanggal, dengan logika waktu aplikasi memakai zona `Asia/Jakarta`.

## 7. Fitur Konteks case

Logic konteks yang sebelumnya kosong sudah dikembalikan. Konteks case mencakup antara lain:

- insiden/latar kasus;
- pihak terkait;
- tujuan dokumen;
- tanggal efektif;
- latar belakang dan akar masalah;
- parameter keberhasilan/KPI.

Data konteks dibaca dan disimpan melalui sheet `Tracker`, kolom R–W. Menu Konteks pada ringkasan case harus menampilkan data yang telah tersimpan dan tetap menyediakan alur pengisian/edit.

## 8. PDF dan DOCX

Tabel `II. MATRIKS RENCANA PERBAIKAN` pada PDF dan DOCX telah dirancang memiliki urutan:

1. No
2. Langkah Perbaikan
3. Rincian Detail Tindakan Konkret per Kasus
4. Timeline
5. Status
6. PIC

Kolom `Status` berada setelah `Timeline` dan sebelum `PIC`.

### Endpoint ekspor

Ekspor seluruh case:

- PDF: `/api/export/{ID}`
- DOCX: `/api/export/{ID}?format=docx`

Ekspor satu langkah/item:

- PDF: `/api/export/{ID}?step=N`
- DOCX: `/api/export/{ID}?format=docx&step=N`

Tombol PDF dan DOCX tersedia pada ringkasan case dan pada setiap item di **Tracker — Seluruh Item Aksi**. Khusus ekspor dari baris item, isi matriks harus difilter agar hanya memuat langkah/item yang dipilih.

Pilihan Bahasa Indonesia/English pernah dibuat/direncanakan, termasuk penggunaan humanizer untuk materi English, tetapi atas permintaan user menu pilihan bahasa tersebut saat ini harus tetap **disembunyikan** sampai ada instruksi baru.

## 9. Google Drive Evidence

- Folder ID: `1uOd0jovHI70Ff5vQ-cjTu0QXLB4yZsV6`
- Folder: <https://drive.google.com/drive/folders/1uOd0jovHI70Ff5vQ-cjTu0QXLB4yZsV6>
- Nama folder: `Evidence IAP`
- Akun pemilik folder yang digunakan saat otorisasi: `ocs.customer.service.gpkps@gmail.com`
- Service account: `ocs-sheets@iap-gapura.iam.gserviceaccount.com`

### Temuan penting tentang autentikasi Drive

Service account dapat dipakai untuk Google Sheets, tetapi tidak memiliki storage quota untuk upload ke folder **My Drive**. Upload evidence memakai OAuth akun pemilik folder. Agar refresh token tidak mengikuti batas tujuh hari mode Testing, OAuth app harus berstatus **In production** sebelum token baru dibuat.

Konfigurasi environment yang dibutuhkan secara konsep:

```dotenv
SHEETS_TRANSPORT=google
GOOGLE_SHEETS_SPREADSHEET_ID=1eY_kLvI9vOkGoMJ3g1ix41O0zlQQI0wqIOU2JMbkdmw
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY=...
GOOGLE_DRIVE_EVIDENCE_FOLDER_ID=1uOd0jovHI70Ff5vQ-cjTu0QXLB4yZsV6
GOOGLE_DRIVE_OAUTH_CLIENT_ID=...
GOOGLE_DRIVE_OAUTH_CLIENT_SECRET=...
GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN=...
```

Nilai aktual tersimpan di `.env.local` dan tidak boleh disalin ke dokumen, chat, commit, atau GitHub.

## 10. Otorisasi OAuth Drive

Jalankan `npm run authorize-drive`, buka URL terbaru yang dicetak di terminal, lalu login sebagai pemilik folder Evidence IAP. Script meminta offline access dan menyimpan refresh token baru langsung ke `.env.local`. Pastikan OAuth app sudah **In production** sebelum menjalankannya.

## 11. Endpoint upload evidence

Endpoint utama:

```text
POST /api/evidence/[iapId]/[stepNo]
```

Validasi dan alur yang diharapkan:

1. Request harus berasal dari same origin.
2. Item IAP dan nomor langkah harus valid/ada.
3. File tidak boleh melebihi 4 MB agar request multipart tetap di bawah batas payload Vercel 4,5 MB.
4. Tipe file harus termasuk tipe yang diizinkan.
5. File di-upload ke folder Drive Evidence IAP.
6. File dibuat dapat diakses melalui link sesuai implementasi permission.
7. `webViewLink` dari Drive diambil.
8. URL tersebut di-append ke kolom Q baris Tracker terkait.
9. Jika penulisan sheet gagal setelah upload Drive berhasil, file Drive yang baru di-upload harus dihapus kembali sebagai rollback.

Tipe foto yang diterima:

- JPEG/JPG
- PNG
- WEBP
- HEIC/HEIF

Tipe dokumen yang diterima:

- PDF
- DOC
- DOCX

Format nama file Drive:

```text
ID_Tanggal_Station_Langkah-N_Nama-Asli
```

Nama disanitasi agar aman, namun tetap mengenali ID/flight number, tanggal, station, langkah, dan nama file asli.

## 12. UI evidence

### A. Ubah item pada Tracker — Seluruh Item Aksi

- User dapat memilih link, foto, atau dokumen.
- Foto/dokumen di-upload ke endpoint item terkait.
- Link hasil Drive ditambahkan ke kolom Q dan tampil kembali di UI.
- File diproses ketika dipilih/dikirim sesuai alur modal yang tersedia.

### B. Ubah case pada Ringkasan per Kasus IAP

- Tersedia pilihan link, foto, atau dokumen.
- User dapat memilih:
  - terapkan ke semua langkah perbaikan; atau
  - pilih langkah tertentu melalui checkbox.
- Daftar checkbox mengikuti langkah yang sudah existing dalam case tersebut.
- Pada alur case, user harus menekan tombol **Tambahkan Evidence** agar evidence benar-benar dikirim.
- Multi-target upload menyimpan target yang sudah berhasil sehingga retry tidak menduplikasi target yang sebelumnya sukses.

### C. + Kasus IAP Baru

- Pada langkah terakhir tersedia link, foto, atau dokumen.
- Karena case/item belum memiliki baris sheet sebelum disimpan, evidence ditahan sementara dan dikirim setelah pembuatan case berhasil.
- Evidence kemudian diarahkan ke langkah yang sesuai dan URL disimpan ke kolom Q.

### D. Penyimpanan riwayat evidence

Semua fitur evidence memakai prinsip append. Contoh isi satu sel Q:

```text
https://drive.google.com/evidence-pertama
https://drive.google.com/evidence-kedua
https://drive.google.com/evidence-ketiga
```

Evidence baru tidak boleh menimpa atau menghapus evidence lama.

## 13. File kode utama yang terkait

Lokasi berikut perlu menjadi titik awal saat debugging lanjutan:

- `app/api/evidence/[iapId]/[stepNo]/route.ts` — endpoint upload evidence.
- `src/drive/evidence.ts` — konfigurasi OAuth Drive, upload, permission, dan link.
- `scripts/authorize-drive.ts` — mendapatkan OAuth refresh token pemilik folder.
- `lib/tracker-repository.ts` — baca/tulis spreadsheet, termasuk append evidence dan konteks.
- `lib/rows.ts` — pemetaan row/kolom Tracker.
- `lib/validate.ts` — validasi payload.
- Komponen `StepFields` — field evidence pada langkah.
- Komponen `ItemModal` — tambah/ubah item dan evidence.
- Komponen `CaseEvidencePanel` — pemilihan metode dan target langkah pada level case.
- Komponen `CaseModal` — tambah/ubah case.
- Komponen `Dashboard` — ringkasan case dan tindakan.
- Komponen `ActionTable` — tabel seluruh item aksi dan tautan evidence.
- Server actions terkait create/update case dan item.
- Test Playwright evidence.
- `.env.example`, `README.md`, dan `package.json`.

Nama folder komponen dapat ditelusuri dengan `rg --files` karena struktur persis harus diverifikasi terhadap HEAD saat melanjutkan.

## 14. Pengujian yang sudah dilakukan

Hasil terakhir yang diketahui:

- TypeScript typecheck berhasil.
- Build production Next.js berhasil.
- Versi Next.js yang teramati: `15.5.23`.
- Build bisa memakan waktu sekitar 3–4 menit.
- Delapan pengujian Playwright evidence berstatus `ok`.
- Satu proses command pernah mencapai timeout saat teardown, tetapi hasil delapan test sudah sukses.

### Pengujian upload nyata

Upload pernah diuji langsung dan melalui UI dengan hasil file benar-benar masuk ke Drive serta URL masuk ke Q. File test kemudian dibersihkan:

- Direct endpoint test, file ID `12XIWqW4H7rRPyZaWbvNb3nSPV6AYfh9k` — dihapus, Q2 dipulihkan.
- Item UI test, file ID `1MBG7w4J9zNnaATgb_EXMP-wvPeHcUs-4` — dihapus, Q2 dipulihkan.
- Case UI test, file ID `10meG4bgLV0pGXdDq0DQD5YO6RLEP8AWy` — dihapus, Q2 dipulihkan.

Setelah cleanup:

- folder Drive Evidence IAP kosong dari fixture test;
- Q2 kembali kosong;
- fixture lokal dihapus.

## 15. Server lokal dan tab browser

Pernah ada dua tampilan localhost yang berbeda:

- instance terbaru menampilkan tanggal 14 Agustus 2026 dan sekitar 113 item;
- tab/instance lama menampilkan tanggal 13 Agustus 2026 dan sekitar 66 item.

Tab lama kemudian di-reload ke versi terbaru. Jika UI tampak tidak berubah:

1. pastikan URL benar-benar `http://localhost:3000/`;
2. lakukan `Ctrl+F5`;
3. cek tanggal dan jumlah item sebagai indikator instance/data terbaru;
4. hindari menilai hasil dari tab lama yang masih menyimpan bundle/cache sebelumnya.

### Kesalahan diagnosis port yang pernah terjadi

`Get-NetTCPConnection` pernah menghasilkan access denied sehingga server sempat dianggap mati. Namun:

- `/api/health` memberi HTTP 200;
- upaya menjalankan server kedua memberi `EADDRINUSE`.

Artinya server pertama sebenarnya aktif. Untuk pemeriksaan berikutnya, utamakan request HTTP ke `/api/health`, bukan hanya `Get-NetTCPConnection`.

## 16. Masalah yang masih perlu dipastikan

Walaupun upload backend, upload langsung, dan upload melalui UI pernah berhasil secara objektif, user kemudian tetap melaporkan bahwa upload foto/dokumen tidak bekerja pada semua tombol dan tidak ada file yang masuk.

Saat melanjutkan, jangan langsung berasumsi masalah sudah selesai. Reproduksi dari tab dan alur yang sama persis dengan user:

1. Pastikan user berada pada instance terbaru (tanggal/jumlah item terbaru).
2. Catat tombol yang dipakai: Ubah item, Ubah case, atau Kasus IAP Baru.
3. Catat ID case dan nomor langkah.
4. Catat tipe, ekstensi, dan ukuran file.
5. Pada Ubah case, pastikan target langkah dipilih dan tombol **Tambahkan Evidence** ditekan.
6. Periksa pesan error/toast pada UI dan response endpoint upload di browser/network atau log server.
7. Pastikan file muncul di folder Drive yang benar dan URL masuk ke row Tracker yang benar.
8. Pastikan bukan tab/browser cache lama.
9. Jika yang diuji adalah deployment publik, periksa environment deployment. `.env.local` hanya berlaku lokal dan memang tidak pernah di-push. Hosting harus memiliki folder ID dan tiga variabel OAuth yang sama secara terpisah.

Kemungkinan besar perbedaan hasil user dengan pengujian lokal berasal dari salah satu dari: tab lama, tombol submit evidence level case belum ditekan, deployment belum memakai commit/env terbaru, OAuth env hanya tersedia lokal, atau request UI tertentu gagal dan perlu dilihat respons aktualnya.

## 17. Dependencies dan script penting

Dependency utama yang diketahui meliputi:

- Next.js `15.5.23`
- `googleapis` `174.0.1`
- `docx`
- `pdf-lib`
- React dan TypeScript
- Playwright untuk end-to-end test
- `tsx` untuk menjalankan script otorisasi

Script penting:

```powershell
npm run dev
npm run build
```

Nama script typecheck/test harus dibaca dari `package.json` saat melanjutkan agar memakai command aktual repository.

## 18. Git dan push terakhir

- Repository tujuan push adalah `ocscustomerservicegpkps/gapura-iap-tracker`.
- Branch tujuan adalah `main`.
- Push terakhir yang diketahui mencapai commit `b88ff3a`.
- User sempat mempertanyakan timestamp GitHub karena perubahan terlihat 25 menit lama. Push kemudian dilakukan ulang/remote diverifikasi.
- Jangan membuat empty commit atau push ulang lagi kecuali user secara eksplisit mengizinkannya.
- Sebelum push berikutnya, lakukan review, typecheck/build/test yang proporsional, jelaskan hasilnya, lalu minta izin user.

## 19. Checklist kelanjutan

Gunakan urutan ini pada task/chat berikutnya:

1. Baca dokumen ini.
2. Jalankan `git status --short`, `git branch --show-current`, `git rev-parse HEAD`, dan `git remote -v`.
3. Jangan menyentuh atau menampilkan isi `.env.local` kecuali pemeriksaan nama variable secara aman benar-benar diperlukan.
4. Jalankan health check lokal dan pastikan browser memakai instance terbaru.
5. Reproduksi upload dari ketiga alur UI menggunakan file kecil yang valid.
6. Verifikasi tiga lapisan untuk setiap percobaan: response API, objek Drive, dan URL di kolom Q.
7. Bersihkan hanya fixture test yang dibuat sendiri dan pulihkan sel test tanpa menghapus data user.
8. Perbaiki jika masih gagal, lalu jalankan code review, typecheck, build, dan Playwright terkait evidence.
9. Laporkan hasil kepada user.
10. **Tanya izin sebelum commit/push.**

## 20. Status saat dokumen ini dibuat

- Kode aplikasi terakhir diketahui berada di branch `main` dan sinkron dengan remote pada commit `b88ff3a`.
- Folder evidence tetap berada di My Drive dan upload memakai OAuth akun pemiliknya.
- Data/file fixture test sudah dibersihkan.
- `.env.local` tetap lokal dan harus tetap diabaikan Git.
- Laporan terakhir user sebelum permintaan summary adalah bahwa upload masih tidak bekerja dari sisi mereka, sehingga validasi ulang pada environment/tab/alur user tetap menjadi prioritas pertama.
- Dokumen Markdown ini dibuat hanya sebagai handoff; tidak ada kode aplikasi yang sengaja diubah dan tidak ada push GitHub yang dilakukan untuk dokumen ini.
