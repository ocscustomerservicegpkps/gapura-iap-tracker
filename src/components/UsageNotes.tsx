/** Kept from the original dashboard, updated for what the app now does automatically. */
export function UsageNotes() {
  return (
    <section className="card mt-9 px-5 py-5 sm:px-6">
      <h2 className="mb-3 text-[13px] font-bold tracking-[0.04em] text-ink">
        CARA MENGGUNAKAN TRACKER INI
      </h2>
      <ol className="list-decimal space-y-1 pl-5 text-[13px] leading-[1.9] text-ink-mid">
        <li>
          Setiap baris pada tabel Tracker mewakili satu item aksi dari sebuah
          Improvement Action Plan (IAP). Data dibaca langsung dari spreadsheet dan
          diperbarui otomatis paling lambat sekitar satu menit setelah seseorang
          mengubahnya di sana.
        </li>
        <li>
          Gunakan kotak pencarian, filter ID IAP / Status, serta tombol Overdue dan
          Jatuh tempo ≤ 7 hari untuk menyaring item. Klik judul kolom untuk mengurutkan.
        </li>
        <li>
          Tombol <b>Ubah</b> pada setiap baris membuka formulir item aksi: status,
          % progres, tanggal target, tanggal selesai aktual, dan bukti/catatan.
          Menandai item <b>Completed</b> otomatis menetapkan progres 100% dan
          mewajibkan Tanggal Selesai Aktual.
        </li>
        <li>
          Kolom <b>Overdue Status</b> tidak lagi diisi manual. Nilainya dihitung
          otomatis dari Tanggal Target terhadap tanggal hari ini di zona waktu
          Asia/Jakarta, dan ikut ditulis ke spreadsheet setiap kali sebuah baris
          disimpan.
        </li>
        <li>
          Kasus IAP baru dibuat melalui tombol <b>+ Kasus IAP Baru</b>. Formulirnya
          mengikuti struktur dokumen IAP: identitas kasus, konteks dokumen, lalu
          matriks langkah perbaikan yang dapat ditambah, diurutkan ulang, dan dihapus
          sebelum disimpan. Nomor langkah diberikan otomatis dari urutannya.
        </li>
        <li>
          Tombol <b>Konteks</b> pada ringkasan per kasus menampilkan insiden asal,
          pihak terkait, referensi surat peringatan, analisis akar masalah, Parameter
          Keberhasilan (KPI), dan komitmen manajemen. Bertuliskan <b>+ Konteks</b>{" "}
          bila kasus itu belum punya — semuanya dapat diisi dan diubah dari dalam
          aplikasi, tersimpan di tab <b>Konteks</b> pada spreadsheet yang sama.
          Bagian yang kosong tidak ditampilkan.
        </li>
      </ol>
    </section>
  );
}
