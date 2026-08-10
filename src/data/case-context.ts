/**
 * Context lifted from the nine source IAP documents, keyed by `ID IAP`.
 *
 * This is reference material, not tracked state: it is read-only in the UI and is
 * never written back to the spreadsheet. Two of the source documents (HU702 and
 * TR273/275/245) are written in English; their summaries are given in Indonesian
 * here so the dashboard reads as one language, with the original filename kept so
 * the source can still be found.
 */
export interface CaseContext {
  /** Kasus / Insiden */
  incident: string;
  /** Pihak Terkait */
  parties: string;
  /** Tujuan Dokumen */
  purpose: string;
  /** Tanggal Efektif, as written in the document. */
  effectiveDate: string;
  /** Ringkasan analisis akar masalah. */
  rootCause: string;
  /** Parameter Keberhasilan (Key Performance Indicators). */
  kpis: string[];
  /** File the context was extracted from. */
  sourceDocument: string;
}

export const CASE_CONTEXT: Readonly<Record<string, CaseContext>> = {
  HU702: {
    incident:
      "Irregularity HU702 — selisih jumlah bagasi terhadap load sheet, Stasiun CGK, 3 Juli 2026.",
    parties: "Hainan Airlines (HU)",
    purpose:
      "Manajemen PT Gapura Angkasa Stasiun CGK & Intl. Airlines Account Management",
    effectiveDate: "16 Juli 2026",
    rootCause:
      "Jumlah bagasi pada load sheet tidak sesuai dengan jumlah yang benar-benar dimuat. Selisih berawal dari proses check-in: saat check-in penumpang dibatalkan lalu diproses ulang, petugas tidak memverifikasi kembali data bagasi sehingga data yang masuk ke sistem tidak akurat. Load Control kemudian tetap menerbitkan load sheet meskipun mengetahui adanya selisih, tanpa menerapkan prosedur LMC sebelum keberangkatan. Akar masalah utama: lemahnya verifikasi data bagasi pada proses reprocessing check-in dan rendahnya pemahaman serta kepatuhan Load Control terhadap prosedur LMC. Hainan Airlines mempertimbangkan penalti sebesar 10% dari handling fee penerbangan terkait.",
    kpis: [
      "Zero Repeat Baggage/Load Sheet Discrepancy: tidak ada temuan selisih jumlah bagasi antara load sheet dan jumlah aktual di Stasiun CGK selama 90 hari monitoring ke depan.",
      "Refreshment & Compliance Completion: 100% petugas check-in dan Load Control menyelesaikan refresher/briefing dan debriefing SOP verifikasi bagasi serta prosedur LMC.",
      "Check-in Reprocessing Verification: setiap pembatalan dan pemrosesan ulang check-in wajib melalui verifikasi ulang data bagasi, dipantau Check-in Supervisor.",
      "LMC Compliance: prosedur LMC diterapkan konsisten oleh Load Control setiap kali ditemukan selisih sebelum keberangkatan dan load sheet tidak diterbitkan; divalidasi melalui hidden audit dan review KPI.",
    ],
    sourceDocument: "IAP HU eng.docx",
  },

  GA254: {
    incident:
      "Irregularity Report GA254 rute YIA–DPS, 09 Agustus 2026 — SLA Fibag & Labag Not Achieved akibat priority baggage misload ke Compartment 2 (CPT2); First Bag tiba 14.39 LT (terlambat 7 menit), Last Bag tiba 14.52 LT (terlambat 14 menit).",
    parties:
      "PT Gapura Angkasa Stasiun YIA (Yogyakarta) & DPS (Denpasar) / Garuda Indonesia",
    purpose: "GM/Manager Ops YIA–DPS & Manajemen PT Gapura Angkasa",
    effectiveDate: "12 Agustus 2026",
    rootCause:
      "Sebagian bagasi Priority/Business Class — termasuk bagasi bertag Priority milik penumpang Gold Member — termuat di CPT2, padahal sesuai Loading Instruction seluruh bagasi Business/Gold/Priority seharusnya dimuat di CPT1. Akar masalah utama: lemahnya kepatuhan terhadap prosedur load/unload sequence oleh petugas loading di YIA dan tidak adanya verifikasi independen sortir priority tag sebelum bagasi masuk compartment. Akibatnya proses unloading di DPS memerlukan waktu tambahan karena CPT2 bukan prioritas unload pertama, sehingga SLA Fibag dan Labag tidak tercapai. Belum ada cross-check konsisten antara Loading Instruction/Baggage Make Up Checklist dengan actual loading sebelum cargo door closing.",
    kpis: [
      "Zero Repeat Priority Baggage Misload: tidak ada temuan bagasi priority/bisnis dimuat di luar CPT1 selama 90 hari monitoring ke depan.",
      "SLA Fibag Compliance: SLA Fibag tercapai <20 menit secara konsisten pada seluruh flight GA254 YIA–DPS.",
      "SLA Labag Compliance: SLA Labag tercapai <30 menit secara konsisten pada seluruh flight GA254 YIA–DPS.",
      "Loading Sequence Briefing Compliance: 100% loading staff/porter mengikuti briefing & refreshment training load sequence, dibuktikan dengan daftar hadir & tanda tangan.",
      "Priority Baggage Verification: setiap bagasi priority wajib melalui verifikasi fisik sebelum dimasukkan compartment, dipantau oleh Load Master.",
      "Cross-check Compliance: 100% flight melakukan cross-check Loading Instruction vs actual loading sebelum cargo door closing.",
      "Supervision & Reporting Consistency: peningkatan frekuensi pengawasan on-the-spot pada proses loading dan pelaporan berkala kepada GM/Manager Ops, termasuk kepada Garuda Indonesia.",
    ],
    sourceDocument: "Improvement Action Plan GA253.docx",
  },

  "TR273/275/245": {
    incident:
      "Irregularity TR273 (Double Seat — Boarding Gate, 14 Jul 2026), TR275 (Cargo Not Loaded, 23 Jul 2026), dan TR245 (Passenger Misdirection, 01 Agu 2026) — Scoot, Stasiun CGK & KNO.",
    parties:
      "Scoot / PT Gapura Angkasa — Stasiun CGK (Soekarno-Hatta) & KNO (Kualanamu)",
    purpose:
      "General Manager & Manajemen PT Gapura Angkasa Stasiun CGK/KNO, serta Scoot Airline Account Management",
    effectiveDate: "02 Agustus 2026",
    rootCause:
      "TR273: petugas Boarding Gate mengabaikan red warning pada sistem scanning dan tetap memboarding penumpang, yang kemudian harus di-offload untuk verifikasi ulang dokumen; akar masalah pada lemahnya kepatuhan menyelesaikan scan warning sebelum boarding dan pengawasan supervisi yang belum optimal. TR275: 1 item Bulk (B082, 8 pcs/150 kg) tidak termuat dan harus direschedule ke TR309; akar masalah pada tidak konsistennya prosedur check, re-check, dan cross-check (load reconciliation) antara Ramp Handling dan Loadmaster. TR245: passenger misdirection di area boarding-disembarkation KNO; akar masalah pada risiko overlap/cross-boarding di koridor bersama KNO, minimnya signage pengarah penumpang, dan belum adanya mekanisme rekonsiliasi jumlah penumpang di pintu pesawat.",
    kpis: [
      "Zero Repeat Double Seat Incident: tidak ada pengulangan insiden double seat akibat scan warning yang diabaikan di Boarding Gate CGK.",
      "Zero Repeat Cargo Short-Shipment: tidak ada temuan kargo tidak termuat/short-shipment pada penerbangan Scoot di CGK & KNO selama 90 hari monitoring ke depan.",
      "Zero Repeat Passenger Misdirection: tidak ada insiden passenger misdirection di area koridor bersama boarding/disembarkation KNO.",
      "Scan Compliance & Override Documentation: 100% red warning/reject pada sistem scan diselesaikan dan didokumentasikan sebelum boarding, dipantau melalui hidden audit bulanan.",
      "Load Reconciliation Compliance: 100% keberangkatan melalui proses check, re-check, dan cross-check kargo antara Ramp Handling dan Loadmaster, dibuktikan pada DLS dan LIR.",
      "Training & Briefing Compliance: 100% staf Boarding Gate, Ramp, dan Ground mengikuti refreshment training/briefing terkait, dibuktikan dengan daftar hadir & tanda tangan.",
    ],
    sourceDocument: "TR (IAP & Evidence).docx",
  },

  "FS-951": {
    incident:
      "(1) Irregularity Report FS-951 MDC–TIM No. MO/606/JUN/2026 tgl 24 Juni 2026 — indikasi penitipan bagasi tanpa klarifikasi; (2) Surat PT Airfast Indonesia No. 012/AOD/Gapura Angkasa/SRT-SP/PK-OFI/2026 tgl 2 Juli 2026 — pelanggaran verifikasi identitas penumpang; (3) Keterlambatan buka check-in counter Lombok, 11–12 Juli 2026.",
    parties:
      "PT Airfast Indonesia (Stasiun Timika & Lombok) / PT Gapura Angkasa Stasiun Manado–Timika & Lombok",
    purpose: "MDCGM & Manajemen PT Gapura Angkasa",
    effectiveDate: "16 Juli 2026",
    rootCause:
      "Tiga temuan terpisah. Pertama, ditemukan 3 bagasi tidak bertuan di Stasiun TIM akibat penitipan bagasi yang diterima staf check-in tanpa klarifikasi kepada penumpang pemilik bagasi — akar masalah pada lemahnya pemahaman batasan kewenangan petugas dan lemahnya fungsi pengawasan pada serah-terima bagasi titipan. Kedua, penumpang diizinkan melakukan perjalanan hanya dengan fotokopi kartu identitas, melanggar prosedur keamanan penerbangan sebagaimana diatur dalam SGHA — akar masalah pada lemahnya kepatuhan kewajiban verifikasi dokumen identitas asli. Ketiga, deploy SDM pukul 08.00 LT sementara first flight Airfast STD 07.45 LT menyebabkan check-in counter terlambat dibuka dan keberangkatan tertunda 34 menit — akar masalah pada lemahnya update rencana produksi dari unit operation ke unit terkait.",
    kpis: [
      "Zero Repeat Baggage Irregularity: tidak ada temuan bagasi tidak bertuan/tanpa klarifikasi di Stasiun MDC/TIM selama 90 hari monitoring ke depan.",
      "Zero Repeat Identity Document Irregularity: tidak ada temuan penumpang check-in atau travel tanpa kartu identitas asli selama 90 hari monitoring ke depan.",
      "Zero Repeat Delay Open Check-in Counter: tidak ada komplain dari customer atas keterlambatan buka check-in pada layanan Airfast.",
      "Integrity & Compliance Briefing Compliance: 100% staf check-in dan Avsec mengikuti briefing integritas, batasan kewenangan, dan verifikasi dokumen identitas, dibuktikan dengan daftar hadir & tanda tangan.",
      "Baggage Handover Verification: setiap serah-terima bagasi titipan wajib melalui klarifikasi ke penumpang pemilik bagasi, dipantau oleh Supervisor Landside.",
      "Identity Verification Compliance: 100% staf check-in mematuhi SOP verifikasi dokumen identitas asli, dipantau melalui spot check berkala oleh Supervisor/Avsec.",
      "Supervision & Reporting Consistency: peningkatan frekuensi pengawasan on-the-spot pada proses check-in dan pelaporan berkala kepada GM, termasuk kepada PT Airfast Indonesia.",
    ],
    sourceDocument: "Imrprovement Plan gabungan.docx",
  },

  IP200: {
    incident:
      "Investigation Report No. CGKMQGP/IR/034/VII/2026 — dugaan pelanggaran prosedur penanganan excess baggage dan penerimaan uang, penerbangan IP200/CGK–SUB, 16 Juli 2026.",
    parties:
      "Staff Check-in Counter PT Gapura Angkasa / Airport Handling Travel Agent",
    purpose:
      "Manager of Safety, Security & Quality & Manajemen PT Gapura Angkasa Stasiun CGK",
    effectiveDate: "18 Juli 2026",
    rootCause:
      "Staff Check-in Counter memproses check-in group 26 pax dengan 46 koli bagasi dan kelebihan berat 121 kg. Atas permintaan berulang Airport Handling Travel Agent, pembayaran kelebihan bagasi diproses secara pribadi di luar prosedur resmi, dan untuk menghindari terbitnya Excess Baggage Ticket (EBT) dilakukan manipulasi data berat bagasi pada sistem check-in. Sebagai imbalan, Travel Agent mentransfer Rp2.200.000,- ke rekening pribadi petugas. Akar masalah: (1) lemahnya kepatuhan terhadap SOP penanganan excess baggage, (2) tidak adanya verifikasi berlapis atas perubahan data berat bagasi pada sistem check-in, dan (3) minimnya penegasan larangan penerimaan imbalan dari pihak ketiga. Manipulasi data ini juga berpotensi memengaruhi validitas perhitungan Weight and Balance.",
    kpis: [
      "Zero Repeat Data Manipulation: tidak ditemukan indikasi manipulasi data berat bagasi pada sistem check-in di seluruh stasiun selama 90 hari monitoring ke depan.",
      "Zero Unauthorized Payment: tidak ada transaksi excess baggage yang diproses melalui rekening pribadi petugas; seluruh pembayaran melalui kanal resmi perusahaan.",
      "Integrity Briefing Compliance: 100% staff Check-in Counter mengikuti briefing SOP excess baggage dan integritas, dibuktikan dengan daftar hadir & tanda tangan.",
      "EBT Reconciliation Accuracy: rekonsiliasi EBT vs manifest dilakukan berkala tanpa ditemukan selisih yang tidak dapat dijelaskan.",
      "Supervision & Reporting Consistency: peningkatan frekuensi pengawasan on-the-spot pada proses check-in dan pelaporan berkala kepada GM.",
    ],
    sourceDocument: "Improvement_Action_Plan_IP200_Excess_Baggage.docx",
  },

  GA159: {
    incident:
      "Selisih jumlah bagasi tercatat (5 pcs) dengan bagasi milik penumpang (3 pcs) pada flight GA159 (BTH–CGK), dikeluhkan penumpang secara publik melalui platform Threads, 08 Agustus 2026.",
    parties:
      "Garuda Indonesia / PT Gapura Angkasa — Stasiun BTH (Hang Nadim, Batam), Lion Air (rekanan pelapor check-in), Protokol Polsek Bandara Hang Nadim",
    purpose:
      "General Manager & Manajemen PT Gapura Angkasa Stasiun BTH, serta Airline Account Management Garuda Indonesia",
    effectiveDate: "09 Agustus 2026",
    rootCause:
      "Penumpang mengunggah keluhan di media sosial karena data sistem check-in mencatat 5 pcs bagasi atas namanya, sementara miliknya hanya 3 pcs. Investigasi menunjukkan 2 pcs sisanya merupakan titipan Protokol Polsek Bandara yang dikomunikasikan antara staf Lion Air dan Protokol kepada penumpang. Akar masalah utama: (1) proses profiling bagasi tidak secara eksplisit menanyakan adanya bagasi titipan saat menerima 5 bagasi, (2) tidak adanya prosedur formal dan terdokumentasi untuk penitipan barang oleh pihak ketiga non-penumpang melalui proses check-in penumpang, dan (3) tidak adanya kanal verifikasi cepat bagi penumpang untuk mengonfirmasi status bagasi sebelum keluhan tereskalasi ke publik. Penumpang juga menyampaikan ketidaksesuaian kursi (memesan 21BC berbayar, mendapat 28BC).",
    kpis: [
      "Zero Repeat Baggage Ownership Mismatch: tidak ada kejadian selisih jumlah/kepemilikan bagasi berulang akibat penitipan pihak ketiga yang tidak terverifikasi di Stasiun BTH.",
      "Baggage Profiling Compliance: 100% bagasi yang diinput ke sistem check-in diverifikasi langsung kepemilikannya oleh petugas counter kepada penumpang, dibuktikan dengan dokumentasi profiling.",
      "Third-Party Consignment Documentation: 100% permintaan penitipan barang oleh pihak ketiga non-penumpang dilaporkan kepada airline dan, bila disetujui, menggunakan form penitipan barang resmi dengan persetujuan tertulis airline dan penumpang.",
      "Public Complaint Response Time: respons formal kepada keluhan penumpang di media sosial disampaikan maksimal 1x24 jam sejak unggahan teridentifikasi.",
      "Seat Assignment Accuracy: 100% kesesuaian antara kursi berbayar (priority services) yang dipesan dan yang diterima penumpang.",
      "Training & Briefing Compliance: 100% staff check-in Stasiun BTH mengikuti refreshment training/briefing terkait, dibuktikan dengan daftar hadir & tanda tangan.",
    ],
    sourceDocument: "Improvement_Action_Plan_GA159_BTH.pdf",
  },

  "GA-121": {
    incident:
      "Keluhan pelanggan terkait layanan Check-in Counter, penerbangan GA-121, 4 Juli 2026, Bandara Internasional Kualanamu (KNO).",
    parties: "Garuda Indonesia / PT Gapura Angkasa — Stasiun KNO (Kualanamu)",
    purpose:
      "Service Delivery Group Head PT Garuda Indonesia & Manajemen PT Gapura Angkasa Stasiun KNO",
    effectiveDate: "7 Juli 2026",
    rootCause:
      "Investigasi internal atas operasional GA-121 menemukan bahwa kegagalan layanan disebabkan oleh ketidakpatuhan petugas front liner Check-in Counter terhadap Service Level Agreement (SLA) dan standar perilaku pelayanan yang ditetapkan Garuda Indonesia. Faktor utama mencakup kegagalan dalam complaint handling, penurunan standar komunikasi verbal, serta kurangnya pengawasan aktif pada jam-jam sibuk.",
    kpis: [
      "Zero Customer Complaint: tidak ada keluhan berulang terkait aspek perilaku (attitude) dan komunikasi petugas di Bandara Kualanamu selama 90 hari ke depan.",
      "SLA Adherence: tingkat kepatuhan terhadap SLA Garuda Indonesia mencapai ≥ 98,5% pada evaluasi bulanan.",
      "100% Training Completion: seluruh personel frontliner penanganan penumpang lulus Refreshment Training dengan nilai minimum 80 pada ujian kompetensi pasca-pelatihan.",
    ],
    sourceDocument:
      "Improvement Action Plan Gapura Angkasa HUB V KNO (1).docx",
  },

  "CZ8138/CZ8354": {
    incident:
      "Service lapses PT Gapura Angkasa dalam penanganan China Southern Airlines: CZ8138 Surabaya (01 Sep 2025) dan CZ8354 Jakarta (07/09/13 Sep 2025) — SLA Load Sheet release & equipment availability Not Achieved.",
    parties:
      "PT Gapura Angkasa Stasiun CGK (Jakarta) & Surabaya / China Southern Airlines (CZ)",
    purpose:
      "Station Manager China Southern Airlines & Manajemen PT Gapura Angkasa Stasiun CGK dan Surabaya",
    effectiveDate: "24 September 2025",
    rootCause:
      "Pada CZ8138 di Surabaya, Load Sheet release terlambat sekitar 41 menit dari ketentuan SLA (≤15 menit setelah final distribution); akar masalah teridentifikasi pada kurangnya kesiapan dan profesionalisme staff mulai dari check-in counter hingga boarding gate, sehingga handling tidak berjalan sesuai standar performa. Pada CZ8354 di Jakarta, keterlambatan berulang terkait ketersediaan equipment (HLL dan dollies) dan gangguan sistem Load Control yang berdampak pada penerbitan Load Sheet.",
    kpis: [
      "Equipment SLA Compliance: minimal 2 unit HLL dan dollies dalam jumlah cukup tersedia pada 100% flight CZ di CGK dan Surabaya.",
      "Load Sheet Release Compliance: Load Sheet diterbitkan ≤15 menit setelah final distribution pada seluruh flight CZ.",
      "System Uptime & Stability: tidak ada downtime Load Control system yang menyebabkan keterlambatan Load Sheet selama 90 hari monitoring ke depan.",
      "Zero Repeat SLA Non-Compliance: tidak ditemukan pengulangan delay akibat equipment shortage maupun system disruption pada flight CZ berikutnya.",
      "Staff Competency Compliance: 100% Front Liner Surabaya mengikuti training/refreshment SOP dan profesionalisme kerja, dibuktikan dengan daftar hadir & tanda tangan.",
      "On-Time Performance (OTP): keberangkatan CZ8354 dan CZ8138 tercapai sesuai STD tanpa delay akibat faktor internal Gapura Angkasa.",
    ],
    sourceDocument: "Improvement_Action_Plan_CZ.docx",
  },

  IP207: {
    incident:
      "Hard complaint passenger IP207 — Pelita Air, Stasiun SUB (SUB–CGK), 8 Juli 2026.",
    parties: "PT Pelita Air Service / PT Gapura Angkasa Stasiun SUB",
    purpose:
      "Manajemen PT Pelita Air Service & internal Gapura Angkasa Stasiun SUB",
    effectiveDate: "16 Juli 2026",
    rootCause:
      "Penumpang menyampaikan hard complaint di Customer Service Pelita Air karena tiket tidak dapat direroute dan nilai refund yang ditawarkan dinilai terlalu kecil, disertai persepsi perbedaan penerapan SOP antara stasiun CGK dan SUB terkait reschedule, reroute, dan refund. Interaksi pelayanan sempat tidak kondusif karena kurangnya pengendalian emosi controller. Akar masalah utama: belum konsistennya SOP wording lintas stasiun terkait reroute/reissue/reschedule/refund, serta lemahnya pengendalian emosi dan kesiapan eskalasi frontliner saat menghadapi hard complaint. Mengingat potensi risiko somasi, dilakukan fact finding dan pengamanan bukti bersama Legal Pelita Air.",
    kpis: [
      "Fewer Repeat Complaint Themes: berkurangnya tema keluhan berulang terkait reroute/refund/SOP di stasiun SUB selama 90 hari monitoring ke depan.",
      "Evidence-Based Case Closure: seluruh case closure disertai apology record dan dokumentasi service recovery yang lengkap.",
      "People Discipline Compliance: 100% frontliner/controller lulus refreshment role-play hard complaint handling dan emotional control coaching.",
      "Cross-Station SOP Consistency: SOP wording reroute, reissue, reschedule, dan refund konsisten diterapkan di seluruh stasiun (CGK–SUB) serta tervalidasi melalui weekly review dengan airline.",
    ],
    sourceDocument: "IAP PELITA SUB.docx",
  },
};
