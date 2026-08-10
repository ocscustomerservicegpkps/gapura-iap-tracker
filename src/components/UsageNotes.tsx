import { CASE_CONTEXT } from "@/data/case-context";

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
          Gunakan kotak pencarian, filter ID IAP / Status, serta tombol Terlambat dan
          Jatuh tempo ≤ 7 hari untuk menyaring item. Klik judul kolom untuk mengurutkan.
        </li>
        <li>
          Tombol <b>Ubah</b> pada setiap baris membuka formulir item aksi: status,
          % progres, tanggal target, tanggal selesai aktual, dan bukti/catatan.
          Menandai item <b>Selesai</b> otomatis menetapkan progres 100% dan
          mewajibkan Tanggal Selesai Aktual.
        </li>
        <li>
          Kolom <b>Status Terlambat</b> tidak lagi diisi manual. Nilainya dihitung
          otomatis dari Tanggal Target terhadap tanggal hari ini di zona waktu
          Asia/Jakarta, dan ikut ditulis ke spreadsheet setiap kali sebuah baris
          disimpan.
        </li>
        <li>
          Kasus IAP baru dibuat melalui tombol <b>+ Kasus IAP Baru</b>; nomor langkah
          diberikan otomatis. Menghapus item atau kasus selalu meminta konfirmasi dan
          menyebutkan jumlah baris yang terhapus.
        </li>
        <li>
          Tombol <b>Konteks</b> pada ringkasan per kasus menampilkan insiden asal,
          pihak terkait, analisis akar masalah, dan Parameter Keberhasilan (KPI) dari
          dokumen IAP sumber.
        </li>
      </ol>
      <p className="mt-3.5 border-t border-line-soft pt-3.5 text-[11.5px] leading-relaxed text-faint">
        Sumber dokumen:{" "}
        {Object.entries(CASE_CONTEXT)
          .map(([iapId, context]) => `${context.sourceDocument} (${iapId})`)
          .join(", ")}
        .
      </p>
    </section>
  );
}
