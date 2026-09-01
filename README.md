# MAIWORLD 🎀

Dunia karakter chibi pixel — kustomisasi karaktermu (kulit, rambut, dress atau atasan+celana, aksesori), jelajahi tiga dunia berbeda, kenalan dengan teman, dan main bareng. Dibangun murni dengan **HTML, CSS, JavaScript**, dan data **JSON** — tanpa framework atau backend, siap deploy ke GitHub Pages.

## Struktur Proyek

```
maiworld/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── pixelart.js   # renderer karakter berlapis dari grid JSON
│   ├── audio.js       # musik latar santai, dibuat lewat Web Audio API
│   └── main.js         # customizer, engine dunia, teman, interaksi objek
├── data/
│   ├── body.json          # grid badan dasar (kulit, mata, sepatu)
│   ├── hair.json          # 5 gaya rambut
│   ├── hairColors.json    # 6 warna rambut
│   ├── skinTones.json     # 4 warna kulit
│   ├── palettes.json      # 6 warna pastel untuk baju
│   ├── tops.json           # grid atasan/kaos
│   ├── bottoms.json        # grid celana
│   ├── dresses.json        # grid dress
│   ├── accessories.json    # daftar aksesori
│   ├── worlds.json         # 3 dunia + objek interaktif
│   └── friends.json        # teman NPC + posisi + mini-dialog
└── README.md
```

## Fitur

- **Kustomisasi Karakter Lengkap** — 4 warna kulit, 5 gaya rambut × 6 warna, pilih **Dress** atau **Atasan + Celana terpisah** (masing-masing warnanya sendiri), dan 7 aksesori (kacamata, pita, topi, tas, sayap, bunga). Semua digambar lewat `<canvas>` dari grid pixel JSON — orisinal, bukan aset pihak lain.
- **Nama karakter bisa diganti kapan saja**, tersimpan otomatis di perangkat.
- **3 Dunia yang Bisa Dijelajahi** — Taman, Sekolah, Alun-Alun, masing-masing dengan objek interaktif sendiri (ayunan, papan tulis, kios es krim, dll) yang menampilkan obrolan singkat saat diklik, plus penghitung "sudah dikunjungi berapa kali".
- **Teman NPC dengan Mini-Dialog** — klik teman untuk lihat ceritanya, pilih respons, dapat reaksi balik, dan kirim "High Five".
- **Undang Teman** — tombol ini membuat link berisi data karaktermu; saat temanmu membuka link itu, karaktermu ikut muncul di dunia mereka.
- **Musik Latar Santai** — dibuat langsung lewat kode (Web Audio API, pad chord lo-fi), bisa dinyalakan/dimatikan dari tombol 🎵 di header. Tidak memakai file audio dari luar sama sekali.
- Desain responsif, tema pink & pastel cerah, modern minimalis.

## Menambah / Mengubah Konten

Semua konten ada di folder `data/`:

- **`hair.json`** — tambah gaya rambut baru dengan grid 10 kolom × 14 baris (kode `H` = warna rambut).
- **`tops.json` / `bottoms.json` / `dresses.json`** — ubah bentuk pakaian (kode `T`/`L`/`D`).
- **`palettes.json` / `hairColors.json` / `skinTones.json`** — tambah pilihan warna baru.
- **`worlds.json`** — ubah `tiles` untuk bentuk peta (`G`=lantai, `F`=dekorasi, `P`=jalan, `W`=tidak bisa dilewati), atau tambah `spots` baru untuk objek interaktif.
- **`friends.json`** — tambah teman baru dengan `world`, koordinat `x`/`y`, `appearance`, `story`, dan `replies`.

## Menjalankan di Komputer Sendiri

```bash
# dari dalam folder maiworld/
python3 -m http.server 8000
# lalu buka http://localhost:8000
```

Situs memuat data lewat `fetch()`, jadi harus dibuka lewat server lokal, bukan klik dua kali file HTML.

## Deploy ke GitHub Pages

1. Buat repository baru di GitHub, misalnya `maiworld`.
2. Push seluruh isi folder ini ke branch `main`:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: MAIWORLD"
   git branch -M main
   git remote add origin https://github.com/USERNAME/maiworld.git
   git push -u origin main
   ```
3. Di GitHub, buka **Settings → Pages**.
4. Pada **Source**, pilih branch `main` dan folder `/ (root)`, lalu **Save**.
5. Situs akan aktif beberapa menit kemudian di:
   ```
   https://USERNAME.github.io/maiworld/
   ```

Setelah live, **siapa pun yang membuka link tersebut bisa langsung membuat karakternya sendiri dan main** — situsnya publik seperti website biasa.

## Catatan Jujur Soal "Teman Online"

Karena ini situs statis tanpa server, fitur teman dan dunia berjalan lewat data yang sudah disiapkan (`friends.json`) plus mekanisme **link undangan** (data karakter dikirim lewat parameter URL). ini bukan koneksi real-time sungguhan antar banyak pengguna sekaligus. Untuk multiplayer betulan (posisi pemain lain terlihat langsung, chat live), perlu backend ringan seperti Firebase Realtime Database atau Supabase.

## Kredit Gambar & Musik

Foto latar (langit pastel senja, dua teman tertawa main game) berasal dari [Pexels](https://www.pexels.com), gratis digunakan di bawah [Pexels License](https://www.pexels.com/license/). Semua karakter pixel adalah karya orisinal yang digambar lewat kode. Musik latar dibuat sepenuhnya lewat Web Audio API (bukan file audio), jadi bebas hak cipta dan tidak bergantung pada link eksternal.

## Ide Pengembangan Lanjutan

- Backend ringan untuk posisi pemain & chat real-time.
- Lebih banyak dunia, objek interaktif, dan gaya rambut/pakaian.
- Sistem inventaris atau "koleksi" barang yang bisa dikumpulkan.
