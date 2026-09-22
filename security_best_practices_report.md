# Audit keamanan aplikasi IAP Tracker

Tanggal: 13 September 2026. Lingkup akhir mengikuti instruksi pengguna: kode dan
perilaku sistem, tanpa mengubah konfigurasi, izin berbagi, kebijakan database,
atau pengaturan akun pihak ketiga. Google Sheets, Supabase, dan Vercel dipertahankan.

## Ringkasan

Sejumlah kelemahan aplikasi telah diperbaiki: pembagian evidence publik oleh kode,
pemeriksaan akses kasus yang terlalu luas, jalur admin offline, validasi upload,
Origin dan redirect autentikasi, detail kesalahan, serta perlindungan browser dan
cache. Next.js dan dependensi rentan telah diperbarui. Pemeriksaan dependensi terakhir
menghasilkan **0 advisory**, bukan jaminan bahwa tidak ada kerentanan yang belum dikenal.

Validasi berhasil: build produksi, pemeriksaan TypeScript, pemetaan 13 bentuk teks
stasiun, 91 tes fungsi yang sudah ada, 4 tes keamanan browser baru, dan 8 tes keamanan
termasuk pengujian HTTP dengan autentikasi simulasi lokal. Jumlah tes lulus: **103**,
dijalankan dalam beberapa pengujian terpisah.

Sistem **belum dapat dinyatakan aman sepenuhnya**. Pembatasan permintaan lintas instance,
penulisan bersamaan, makna cabang dalam teks bebas, dan pemeriksaan malware masih
memiliki keterbatasan yang dijelaskan di bawah. Perubahan tersedia di workspace;
belum diterapkan ke deployment produksi.

## Metode dan batas pengujian

- Memeriksa seluruh jalur server action, halaman sensitif, ekspor, upload, autentikasi,
  admin, pembacaan/penulisan Sheets, rendering HTML/DOCX, dan dependensi.
- Mengirim permintaan HTTP lokal dengan sesi anonim, palsu, aktif, pending, nonaktif,
  status tidak dikenal, pengguna cabang, dan admin. Penyedia autentikasi disimulasikan;
  tes ini memverifikasi kontrol aplikasi, bukan keamanan Supabase yang sesungguhnya.
- Menguji pemanggilan server action secara langsung tanpa menggunakan antarmuka,
  akses cabang lain, pemanggilan aksi admin oleh pengguna biasa, dan Origin lintas situs.
- Menguji skrip yang disisipkan ke respons HTML dengan CSP asli, HTML berbahaya dalam
  fixture, URL evidence berbahaya, file yang menyamar, serta body streaming berlebihan.
- Menjalankan pemindaian pola rahasia pada 115 file workspace dan seluruh ref Git lokal.
  Tidak ditemukan kecocokan pola. Nilai environment tidak dicetak; pemindaian ini
  tidak membuktikan bahwa semua bentuk rahasia atau riwayat remote bebas kebocoran.
- Tidak menjalankan serangan pada deployment publik, eksploit RCE, uji beban produksi,
  penghapusan data produksi, atau perubahan konfigurasi pihak ketiga.

## Temuan kritis

### SEC-001 — Dependensi Next.js berada dalam rentang advisory kritis — diperbaiki

Dampak: pada kondisi yang sesuai dengan advisory, dependensi rentan dapat membuka
jalan eksekusi kode di server tanpa autentikasi.

Versi awal Next.js 15.5.23 masuk dalam rentang advisory Image Optimization/AVIF dan
Windows-hosted servers. Advisory Windows tidak menunjukkan eksploit yang berlaku pada
Vercel; keberadaan versi terdampak juga tidak membuktikan jalur AVIF dapat dieksploitasi
pada aplikasi ini. Tidak dilakukan eksploit RCE.

Next.js diperbarui ke 15.5.25, Sharp ke versi terselesaikan 0.35.4, qs ke 6.16.0, dan
PostCSS bawaan Next di-override ke 8.5.28. Paket Supabase dipin ke versi tepat;
lockfile diperbarui. Build dan tes fungsi berhasil.

Bukti akhir: [package.json](/Users/nrzngr/Desktop/gapura-iap-tracker/package.json:21).
Rujukan: [advisory AVIF dari Next.js](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4),
[advisory Windows dari Next.js](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36).

## Temuan tinggi

### SEC-002 — Kode upload memberikan akses publik pada evidence — diperbaiki pada aplikasi

Sebelumnya upload selalu memanggil `permissions.create` dengan `type: anyone` dan
`role: reader`. Pengguna yang memperoleh tautan dapat melewati pembatasan cabang
pada aplikasi untuk membuka evidence yang dibagikan tersebut.

Pemanggilan pemberian izin publik dihapus. File baru mengikuti izin folder yang sudah
ada. Perubahan kode ini tidak mencabut izin file lama atau mengubah konfigurasi Drive,
dan tidak menjamin folder tujuan bersifat privat. Pengguna yang membuka tautan tetap
memerlukan izin Google sesuai keadaan folder/file.

Bukti akhir: [upload evidence](/Users/nrzngr/Desktop/gapura-iap-tracker/src/drive/evidence.ts:210).

### SEC-003 — Akses satu baris membuka operasi atas seluruh kasus — diperbaiki

Pemeriksaan awal menggunakan `some`: jika satu baris kasus cocok dengan cabang,
seluruh kasus boleh diekspor, dihapus, atau diubah. Jika stasiun berbeda antar langkah,
baris yang tidak boleh terlihat di dashboard dapat ikut terbaca atau berubah.

Operasi kasus sekarang memerlukan akses ke **setiap** baris yang menjadi sasaran.
Cabang biasa hanya boleh membuat/memindahkan metadata ke satu cabangnya sendiri,
sehingga menambahkan nama cabang lain tidak dapat memperluas cakupan kasus lewat form.
Admin dan PUSAT mendapat akses global sesuai model peran yang terdokumentasi.
Alias kota yang ambigu, seperti Jakarta untuk CGK dan HLP, tidak lagi memberikan
akses ke dua bandara sekaligus.

Bukti: [kontrol akses](/Users/nrzngr/Desktop/gapura-iap-tracker/src/domain/access.ts:9),
[guard kasus](/Users/nrzngr/Desktop/gapura-iap-tracker/src/lib/case-access.ts:24),
[pemetaan cabang](/Users/nrzngr/Desktop/gapura-iap-tracker/src/domain/branches.ts:132).
Tes HTTP menolak ekspor dan aksi mutasi lintas cabang; tes domain mencakup kasus
berisi baris CGK dan DPS yang terpisah.

### SEC-004 — Mode memory memberi identitas admin tanpa batas lingkungan — diperbaiki

Sebelumnya `SHEETS_TRANSPORT=memory` cukup untuk melewati autentikasi. Endpoint pengujian
bergantung pada transport saja, termasuk kemungkinan fallback fixture pada konfigurasi
produksi yang tidak lengkap.

Bypass memerlukan flag lokal eksplisit, transport memory, ketiadaan kredensial Google,
dan lingkungan yang bukan Vercel. Produksi menolak transport memory yang tidak memenuhi
isolasi tersebut. Endpoint `/api/test/*` mengembalikan 404 di luar mode lokal yang
memenuhi syarat. Clock fixture juga dibatasi pada mode tersebut.

Bukti: [mode lokal](/Users/nrzngr/Desktop/gapura-iap-tracker/src/lib/offline.ts:2),
[transport](/Users/nrzngr/Desktop/gapura-iap-tracker/src/sheets/index.ts:34),
[middleware](/Users/nrzngr/Desktop/gapura-iap-tracker/src/middleware.ts:23).

## Temuan menengah

### SEC-005 — Origin upload dan origin tautan autentikasi terlalu percaya header — diperbaiki

Origin upload sebelumnya dapat tidak ada dan dianggap valid; pemeriksaan juga menerima
host alternatif dari header proxy. Origin untuk email autentikasi diambil langsung
dari Host/forwarded headers. Pola ini terlalu mempercayai masukan permintaan.

Upload kini membutuhkan kecocokan Origin yang tepat dan menolak `Sec-Fetch-Site:
cross-site`. Header proxy tidak digunakan untuk membenarkan Origin. Tautan autentikasi
menggunakan origin dari pengaturan aplikasi `APP_URL`, dengan fallback environment
Vercel yang dikendalikan operator. Tujuan callback dibatasi ke `/` dan `/reset-password`.
Proteksi Origin bawaan Next.js untuk server action tetap aktif dan diuji lewat HTTP.

Bukti: [origin dan redirect](/Users/nrzngr/Desktop/gapura-iap-tracker/src/lib/security.ts:1).

### SEC-006 — File menyamar dan body upload berlebihan — diperbaiki sebagian

Validasi awal menerima file jika MIME **atau** ekstensi cocok; isi tidak diperiksa,
dan body multipart diurai sebelum ukuran aktual dibatasi.

Kini ekstensi harus diizinkan, MIME eksplisit harus cocok, dan signature diperiksa.
MIME kosong/octet-stream tetap diterima untuk kompatibilitas browser jika ekstensi
dan signature cocok. Batas file adalah **4 MiB**; body multipart dibatasi sebelum
parsing menjadi 4 MiB + 128 KiB, termasuk ketika Content-Length salah atau tidak ada.
Nama file, panjang teks, kedalaman payload, dan jumlah langkah juga dibatasi.

Bukti: [validasi file](/Users/nrzngr/Desktop/gapura-iap-tracker/src/drive/evidence.ts:134),
[pembatasan body](/Users/nrzngr/Desktop/gapura-iap-tracker/src/lib/upload-body.ts:4),
[signature](/Users/nrzngr/Desktop/gapura-iap-tracker/src/domain/evidence-file.ts:2),
[payload](/Users/nrzngr/Desktop/gapura-iap-tracker/src/domain/validate.ts:257).
Pemeriksaan ini **bukan scanner malware** dan tidak mendeteksi semua dokumen berbahaya.

### SEC-007 — Detail provider dan objek error dapat bocor — diperbaiki pada jalur yang diaudit

Mutasi/upload sebelumnya menampilkan pesan error mentah dan mencetak objek error
Google yang dapat membawa metadata permintaan/kredensial. Aksi auth/admin juga
meneruskan pesan provider ke pengguna.

Jalur tersebut kini memberikan pesan umum dan tidak mencetak objek error provider.
Recovery memberikan notice sama saat provider mengembalikan error, sehingga respons
tersebut tidak menjadi pembeda keberadaan akun. Logging keberhasilan/audit mutasi
terperinci masih belum tersedia; lihat SEC-013.

Bukti: [mutasi](/Users/nrzngr/Desktop/gapura-iap-tracker/src/app/actions.ts:33),
[recovery](/Users/nrzngr/Desktop/gapura-iap-tracker/src/app/auth/actions.ts:99),
[upload](/Users/nrzngr/Desktop/gapura-iap-tracker/src/app/api/evidence/[iapId]/[stepNo]/route.ts:145).

### SEC-008 — Perlindungan browser dan cache belum eksplisit — diperbaiki

Ditambahkan CSP dengan nonce per permintaan, tanpa unsafe-inline/unsafe-eval untuk
skrip produksi; frame-ancestors none, object-src none, nosniff, kebijakan referrer,
dan private/no-store pada respons aplikasi. Header nonce dari pemanggil ditimpa.
Cetakan menggunakan skrip dengan nonce, menggantikan event handler onload inline.
Halaman dirender dinamis agar nonce tidak dibagikan antar permintaan.

CSS inline tetap diizinkan untuk gaya komponen yang sudah ada; hal ini tidak membuka
izin menjalankan skrip inline. Tes browser menyisipkan skrip parser ke HTML dengan
CSP asli, memastikan skrip terblokir dan interaksi dashboard masih bekerja.

Bukti: [CSP](/Users/nrzngr/Desktop/gapura-iap-tracker/src/lib/security.ts:35),
[header](/Users/nrzngr/Desktop/gapura-iap-tracker/src/middleware.ts:10),
[ekspor](/Users/nrzngr/Desktop/gapura-iap-tracker/src/app/api/export/[iapId]/route.ts:65).
Pedoman: [CSP Next.js](https://nextjs.org/docs/app/guides/content-security-policy).

## Risiko aplikasi yang masih terbuka

### SEC-009 — Tinggi: konflik penulisan dan celah waktu pemeriksaan akses

Repository membaca posisi baris, lalu menulis/menghapus berdasarkan nomor baris.
Guard akses dan mutasi dapat memakai pembacaan yang berbeda. Tidak terdapat transaksi
atau koordinasi atomik lintas instance. Penulisan, penghapusan, dan perubahan stasiun
secara bersamaan dapat menggeser sasaran, menimpa perubahan, atau membuat keputusan
akses tidak lagi sesuai keadaan terakhir. Renumber juga menulis baris lain.

Bukti: [posisi baris](/Users/nrzngr/Desktop/gapura-iap-tracker/src/data/tracker-repository.ts:44),
[penulisan](/Users/nrzngr/Desktop/gapura-iap-tracker/src/data/tracker-repository.ts:144),
[renumber](/Users/nrzngr/Desktop/gapura-iap-tracker/src/data/tracker-repository.ts:96).
Ini ditemukan lewat analisis kode, belum dibuktikan dengan uji race pada data produksi.
Perlu rancangan koordinasi penulisan dan pemeriksaan akses pada snapshot mutasi yang
sama. Mutex lokal saja tidak menyelesaikan deployment Vercel dengan banyak instance.

### SEC-010 — Menengah: belum ada pembatasan permintaan lintas instance pada aplikasi

Auth, recovery, ekspor, dan mutasi tidak mempunyai anggaran permintaan yang dipersistenkan
oleh aplikasi. Batas body membantu permintaan tunggal, tetapi pengguna atau penyerang
masih dapat mengulangi permintaan untuk menghabiskan kuota, kapasitas, atau penyimpanan.
Perlu rate limiting yang berlaku lintas instance. Proteksi penyedia/edge berada di luar
lingkup dan tidak diasumsikan sebagai bukti bahwa masalah ini sudah selesai.

Bukti: [aksi auth](/Users/nrzngr/Desktop/gapura-iap-tracker/src/app/auth/actions.ts:16),
[aksi mutasi](/Users/nrzngr/Desktop/gapura-iap-tracker/src/app/actions.ts:68).

### SEC-011 — Menengah: signature tidak menjamin isi evidence bebas malware

PDF dapat mengandung konten aktif; DOC dapat mengandung macro; header dan marker DOCX
bisa dipalsukan. Tidak ada penguraian mendalam, scanner, atau karantina. Aplikasi tidak
menjalankan file upload sendiri, tetapi penerima yang mengunduhnya masih dapat terkena
risiko. Perlu kebijakan format/karantina atau scanner sesuai kebutuhan sistem.

### SEC-012 — Menengah: otorisasi masih bersandar pada teks bebas stasiun

Pencocokan kode dan nama kota menganggap semua stasiun yang disebut sebagai pemilik
baris. Contoh `Stasiun SUB (SUB-CGK)` juga mengenali CGK, tanpa mengetahui apakah CGK
hanya bagian rute. Alias ambigu sudah diperbaiki, tetapi arti teks tidak dapat
sepenuhnya ditentukan parser. Perlu sumber cabang yang eksplisit dan tervalidasi,
dengan model kasus bersama yang disepakati. Tidak dilakukan perubahan schema/data
pihak ketiga dalam audit ini.

Bukti: [parser cabang](/Users/nrzngr/Desktop/gapura-iap-tracker/src/domain/branches.ts:149).

### SEC-013 — Rendah: belum ada jejak audit mutasi yang tahan perubahan

Belum ada catatan aplikasi terstruktur yang menyimpan aktor, tindakan, waktu, sasaran,
dan hasil secara persisten. Log error sudah menghindari kebocoran, tetapi investigasi
penyalahgunaan/perubahan data masih terbatas. Perlu penyimpanan jejak audit yang sesuai
stack dan kebijakan retensi tanpa menyimpan token atau isi sensitif berlebihan.

## Kontrol yang sudah baik dan tetap dipertahankan

- Validasi sesi memakai `getUser`, bukan mempercayai cookie atau `getSession` saja:
  middleware memanggil `getUser` pada setiap request; halaman dan action sesudahnya
  memverifikasi tanda tangan JWT dengan `getClaims` (JWKS) agar tidak mengulang
  round trip yang sama. Halaman publik `/login` tetap memakai `getUser`.
- Role/status berasal dari profile, bukan metadata pengguna yang dikirim form.
- Filter baris/context berlangsung di server sebelum data dikirim ke dashboard.
- Server action dan route sensitif memeriksa akses secara mandiri.
- URL evidence non-HTTP(S), URL dengan kredensial, dan karakter kontrol dibuang.
- HTML/XML ekspor melakukan escaping; nama unduhan tidak memakai header mentah dari ID.
- Nilai Sheets ditulis dengan RAW, sehingga teks tidak dievaluasi sebagai formula.
- Aplikasi tidak menerima URL pemanggil untuk server-side fetching, perintah sistem,
  jalur file lokal, atau SQL mentah. Tidak ditemukan jalur SSRF/command/SQL injection
  semacam itu dalam kode aplikasi yang diaudit; ini bukan bukti universal ketiadaannya.
- Runtime aplikasi tidak menggunakan service-role key; script administrasi terpisah.

## Reproduksi dan hasil validasi

| Pemeriksaan | Hasil akhir |
| --- | --- |
| `npm run build` | Lulus, Next.js 15.5.25 |
| `npm run typecheck` | Lulus |
| `npm run check:branches` | Lulus, 13 bentuk teks stasiun |
| Suite fungsi yang sudah ada | 91/91 lulus |
| Tes keamanan browser baru | 4/4 lulus |
| Kontrol keamanan dan HTTP simulasi lokal | 8/8 lulus |
| `npm audit --json` | 0 advisory |
| Pola rahasia workspace/ref Git lokal | Tidak ditemukan kecocokan |
| Rahasia Google/service-role dalam 31 bundle browser produksi | Tidak ditemukan |

`npm test` sekarang mencakup 95 tes browser. `npm run test:security` membangun
`.next-security` dengan endpoint simulasi lokal sebelum menjalankan 8 tes keamanan.
Build terpisah diperlukan karena Next mengompilasi NEXT_PUBLIC environment ke output.
Tes tidak membuktikan RLS, konfigurasi Auth sesungguhnya, izin Drive, atau perlindungan
platform; semua itu dikecualikan sesuai batas lingkup pengguna.
