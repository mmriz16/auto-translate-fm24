# 🚀 Auto Translate FM24

**Aplikasi web untuk menerjemahkan file bahasa Football Manager 2024 dari Bahasa Inggris ke Bahasa Indonesia secara otomatis menggunakan AI.**

![Next.js](https://img.shields.io/badge/Next.js-16.0.0-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19.2.0-blue?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-green?style=flat-square&logo=openai)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.0-38B2AC?style=flat-square&logo=tailwind-css)

## ✨ Fitur Utama

### 🎯 **Terjemahan Cerdas**
- **AI-Powered Translation**: Menggunakan OpenAI GPT-4o-mini untuk terjemahan yang natural dan kontekstual
- **Football Manager Context**: Dioptimalkan khusus untuk terminologi dan konteks Football Manager
- **Batch Processing**: Menerjemahkan hingga 400 entries per siklus dengan 8 request concurrent
- **Smart Retry**: Sistem retry otomatis untuk menangani kegagalan API

### ⚡ **Performa Tinggi**
- **Concurrent Processing**: 8 batch concurrent untuk "Translate All" (400 entries/cycle)
- **Optimized Batching**: 6 batch concurrent untuk "Translate Current Page" (240 entries/cycle)
- **Real-time Progress**: Progress bar dengan estimasi waktu yang akurat
- **Zero Delay**: Tidak ada delay antar batch group untuk kecepatan maksimal

### 🎮 **Antarmuka User-Friendly**
- **Drag & Drop Upload**: Upload file .ltf dengan mudah
- **Live Preview**: Lihat hasil terjemahan secara real-time
- **Pagination**: Navigasi mudah untuk file besar
- **Search & Filter**: Cari entry tertentu dengan cepat
- **Export Ready**: Download hasil dalam format .ltf siap pakai

### 💰 **Estimasi Biaya Transparan**
- **Real-time Cost Calculation**: Hitung biaya OpenAI dalam USD dan IDR
- **Token Estimation**: Estimasi penggunaan token yang akurat
- **Budget Planning**: Rencanakan budget sebelum memulai terjemahan

## 🛠️ Teknologi

- **Frontend**: Next.js 16.0.0 + React 19.2.0 + TypeScript
- **Styling**: TailwindCSS 4.0 dengan desain modern
- **AI Integration**: OpenAI GPT-4o-mini API
- **File Processing**: Parser .ltf custom untuk Football Manager
- **State Management**: React Hooks dengan optimasi performa

## 📋 Prasyarat

- Node.js 18.0.0 atau lebih baru
- npm, yarn, pnpm, atau bun
- OpenAI API Key

## 🚀 Instalasi

1. **Clone repository**
   ```bash
   git clone https://github.com/mmriz16/auto-translate-fm24.git
   cd auto-translate-fm24
   ```

2. **Install dependencies**
   ```bash
   npm install
   # atau
   yarn install
   # atau
   pnpm install
   ```

3. **Setup Environment Variables**
   
   Copy file `.env.example` ke `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   
   Kemudian edit `.env.local` dan masukkan OpenAI API key Anda:
   ```env
   OPENAI_API_KEY=your_actual_openai_api_key_here
   ```
   
   **Cara mendapatkan OpenAI API Key:**
   - Kunjungi [OpenAI Platform](https://platform.openai.com/api-keys)
   - Login atau buat akun baru
   - Buat API key baru
   - Copy dan paste ke file `.env.local`

4. **Jalankan development server**
   ```bash
   npm run dev
   # atau
   yarn dev
   # atau
   pnpm dev
   ```

5. **Buka aplikasi**
   
   Akses [http://localhost:3000](http://localhost:3000) di browser Anda.

## 📖 Cara Penggunaan

### 1. **Upload File LTF**
- Drag & drop file `.ltf` Football Manager ke area upload
- Atau klik untuk memilih file secara manual
- File akan diparse otomatis dan menampilkan statistik

### 2. **Pilih Mode Terjemahan**

#### **🌍 Translate All**
- Menerjemahkan semua entry yang belum diterjemahkan
- Throughput: 400 entries per 3 detik (8 concurrent batches)
- Cocok untuk file besar dengan ribuan entries

#### **📄 Translate Current Page**
- Menerjemahkan hanya entries di halaman saat ini
- Throughput: 240 entries per 3 detik (6 concurrent batches)
- Cocok untuk terjemahan bertahap atau review

#### **🎯 Translate Single**
- Menerjemahkan entry individual
- Cocok untuk koreksi atau terjemahan spesifik

### 3. **Monitor Progress**
- **Real-time Progress Bar**: Lihat kemajuan terjemahan
- **Accurate Time Estimation**: Estimasi waktu berdasarkan performa aktual
- **Cost Tracking**: Monitor penggunaan token dan biaya
- **Cancel Anytime**: Batalkan proses kapan saja

### 4. **Review & Export**
- Edit hasil terjemahan secara manual jika diperlukan
- Export file `.ltf` yang sudah diterjemahkan
- File siap digunakan di Football Manager 2024

## ⚙️ Konfigurasi Performa

### **Batch Processing Settings**

```typescript
// Translate All Mode
const BATCH_SIZE = 50;           // Entries per batch
const CONCURRENT_BATCHES = 8;    // Simultaneous batches
const THROUGHPUT = 400;          // Entries per cycle (~3 seconds)

// Translate Current Page Mode  
const BATCH_SIZE = 40;           // Entries per batch
const CONCURRENT_BATCHES = 6;    // Simultaneous batches
const THROUGHPUT = 240;          // Entries per cycle (~3 seconds)
```

### **Time Estimation Formula**
```typescript
const avgTimePerEntry = 0.0075; // seconds per entry
const estimatedTime = remainingEntries * avgTimePerEntry;
```

## 💡 Tips Penggunaan

### **🎯 Untuk Hasil Terjemahan Terbaik**
- Pastikan file .ltf tidak corrupt dan format sesuai standar FM
- Gunakan "Translate All" untuk konsistensi terminologi
- Review hasil terjemahan untuk entry penting (nama pemain, klub, dll.)

### **💰 Untuk Efisiensi Biaya**
- Cek estimasi biaya sebelum memulai terjemahan besar
- Gunakan "Translate Current Page" untuk testing kecil
- Monitor penggunaan token secara real-time

### **⚡ Untuk Performa Optimal**
- Pastikan koneksi internet stabil
- Jangan buka terlalu banyak tab browser saat terjemahan
- Gunakan mode "Translate All" untuk file besar (lebih efisien)

## 🔧 Development

### **Build untuk Production**
```bash
npm run build
npm run start
```

### **Linting**
```bash
npm run lint
```

### **Project Structure**
```
auto-translate-fm24/
├── app/
│   ├── api/translate/          # OpenAI API endpoint
│   ├── globals.css            # Global styles
│   ├── layout.tsx             # App layout
│   └── page.tsx               # Main application
├── public/                    # Static assets
├── package.json              # Dependencies
└── README.md                 # Documentation
```

## 🤝 Kontribusi

Kontribusi sangat diterima! Silakan:

1. Fork repository ini
2. Buat feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit perubahan (`git commit -m 'Add some AmazingFeature'`)
4. Push ke branch (`git push origin feature/AmazingFeature`)
5. Buat Pull Request

## 📄 Lisensi

Distributed under the MIT License. See `LICENSE` for more information.

## 🙏 Acknowledgments

- [OpenAI](https://openai.com/) untuk GPT-4o-mini API
- [Next.js](https://nextjs.org/) untuk framework yang luar biasa
- [TailwindCSS](https://tailwindcss.com/) untuk styling yang elegant
- Komunitas Football Manager Indonesia

## 📞 Support

Jika Anda mengalami masalah atau memiliki pertanyaan:

- 🐛 **Bug Reports**: Buat issue di GitHub
- 💡 **Feature Requests**: Diskusikan di GitHub Discussions
- 📧 **Contact**: [Your Email Here]

---

**⚽ Selamat menerjemahkan dan semoga Football Manager 2024 Anda semakin seru dengan bahasa Indonesia! ⚽**
