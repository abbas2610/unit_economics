# Model Biaya

Rumus yang dipakai seluruh aplikasi, dan **kenapa** tiap yang tidak jelas ditulis
begitu. Ini dokumen rujukan saat ada yang bertanya "angka ini dari mana"; kalau
satu rumus di sini berbeda dari kodenya, yang salah dokumennya — kodenya dijaga
`npm run probe:hitung`, dokumen ini tidak.

Angka contoh di bawah memakai nilai awal (kurs Rp17.000, 3 varian × 25 L,
komposisi 25%, penyusutan 15%, alokasi 50/50).

---

## 1. Dari biang ke jumlah botol

```
liter biang dipesan              75 L      Σ qtyLiter tiap varian
÷ komposisi fragrance (25%)   = 300 L      total campuran
× (1 − penyusutan 15%)        = 255 L      yang benar-benar bisa dibotolkan
```

Volume itu lalu dibagi menurut **alokasi volume**, bukan jumlah botol:

```
botol besar  50% × 255.000 mL ÷ 100 mL = 1.275 pcs
botol kecil  50% × 255.000 mL ÷  15 mL = 8.500 pcs
```

> ⚠️ Alokasi 50:50 **tidak** menghasilkan jumlah botol yang sama. Satu botol
> besar menghabiskan 6,7× isi botol kecil, jadi separuh volume jadi 8.500 botol
> kecil berbanding 1.275 botol besar. Ini yang paling sering salah dibaca di
> layar, dan angka mana pun yang menimbang "campuran batch" harus memakai
> perbandingan itu — bukan 1:1.

**Pembulatan ke bawah.** Botol ke-8.501 yang cuma terisi separuh bukan barang
yang bisa dijual, dan pcs itu ikut jadi pembagi amortisasi molding.

**Qty batch tidak pernah disimpan.** Ia fungsi dari campuran, dihitung ulang tiap
kali. Builder lama menyimpannya *dan* menghitungnya ulang; dua sumber untuk satu
angka selalu berbeda pada akhirnya, dan yang tersimpan menang di jalur kode yang
lupa menghitung ulang.

> ⚠️ **Angka di atas adalah KAPASITAS CAIRAN, bukan jumlah botol yang dibeli.**
> Keduanya sama hanya selama tim tidak memesan jumlah lain. Sejak `dok.pembelian`
> ada, "berapa botol yang cairannya cukup" dan "berapa botol yang dipesan" adalah
> dua pertanyaan berbeda — lihat bagian 4. Yang dipakai `unitEconomics()` dan
> penimbangan gross profit adalah **qty produksi**, bukan angka di bagian ini.

---

## 2. COGS per botol

Tiga kelompok, dan pengelompokannya bukan hiasan: yang pertama bergerak dengan
harga bahan, yang kedua dengan pilihan supplier, yang ketiga dengan harga jual.

### Bahan baku

```
fragrance = isi nominal × komposisi × harga per mL × (1 + waste) × (1 + PPN)
```

Botol kecil: `15 mL × 25% × Rp41,93 × 1,30 × 1,11 = Rp226,91`

Urutannya: waste dikalikan **sebelum** PPN karena PPN memang dibayar atas seluruh
biang yang dibeli, termasuk yang nanti terbuang.

> ⚠️ Yang benar-benar berbahaya bukan urutan waste dan PPN (perkalian komutatif),
> melainkan **menjumlahkannya**: `1 + 0,30 + 0,11 = 1,41` bukan
> `1,30 × 1,11 = 1,443`. Selisih 2,3% pada komponen sekecil ini tidak terlihat di
> layar — tapi kesalahan yang sama pada komponen besar menggeser margin satu poin
> penuh. Dijaga `probe:hitung` bagian 3.

**Harga biang memakai RATA-RATA seluruh varian.** Selisih $2,40–$2,60 pada botol
15 mL adalah Rp16 di atas COGS Rp65.000 — di bawah 0,02%. Menghitungnya per
varian menambah tiga kolom ke tiap tabel dan tidak mengubah satu pun keputusan.

> ⚠️ Yang membuat asumsi ini basi bukan jumlah varian, tapi **sebarannya**. Kalau
> ada varian premium yang harganya berlipat, rata-rata berhenti mewakili.
> `probe:hitung` bagian 12 menolak sebaran lebih dari 2×.

```
OEM = biaya per botol (sudah termasuk alkohol, aquadest, pencampuran)
```

Dipisah per ukuran: mengisi 100 mL bukan sekadar 6,7× kerja mengisi 15 mL.

### Botol & packaging

```
botol       = harga botol + perizinan (% dari harga botol)
aksesoris   = aksesoris + cap
box         = box packaging + aksesoris box
freight     = tarif per CBM ÷ pcs per CBM
```

`pcs per CBM` diturunkan dari dimensi:

```
volume efektif = (p × l × t) ÷ efisiensi packing
pcs per CBM    = 1.000.000 ÷ volume efektif
```

> ⚠️ Efisiensi packing **membagi**, bukan mengalikan. Ruang kosong di kardus tetap
> dikirim dan tetap dibayar, jadi tiap botol menempati lebih dari volumenya
> sendiri. Mengalikannya memberi freight per botol yang lebih murah — angka yang
> masih masuk akal di layar, dan salah ke arah yang menyenangkan.

### Fulfillment

```
fulfillment = biaya tetap per botol
royalti     = harga jual × % royalti Miranti
amortisasi  = total molding ÷ qty batch      (hanya kalau dinyalakan)
```

> ⚠️ **Royalti dihitung dari HARGA JUAL, bukan dari biaya.** Menaikkan harga
> Rp200.000 hanya menambah gross profit Rp196.000 pada royalti 2% — sisanya ikut
> jadi royalti. Ini komponen COGS satu-satunya yang bergerak saat harga digeser.

### Hasilnya

| | Kecil (15 ML) | Besar (100 ML) |
| --- | ---: | ---: |
| Fragrance | Rp227 | Rp1.513 |
| OEM | Rp10.000 | Rp10.000 |
| Botol + perizinan | Rp8.976 | Rp17.600 |
| Aksesoris + cap | Rp10.030 | Rp3.000 |
| Box | Rp25.000 | Rp25.000 |
| Freight | Rp2.139 | Rp3.937 |
| Fulfillment | Rp5.000 | Rp5.000 |
| Royalti | Rp4.000 | Rp7.000 |
| **COGS** | **Rp65.372** | **Rp73.050** |
| Harga jual | Rp200.000 | Rp350.000 |
| **Gross margin** | **67,3%** | **79,1%** |

---

## 3. Amortisasi molding & kelebihan MOQ — dan kenapa mati secara default

Molding adalah **capex**, dan ia sudah dihitung penuh di Initial Investment.
Memasukkannya lagi ke COGS per botol berarti menghitungnya dua kali kalau kedua
angka dibaca berdampingan — dan keduanya memang dibaca berdampingan, di rapat
yang sama.

Dinyalakan saat yang ditanya "berapa biaya per unit sesungguhnya **untuk batch
ini**". Jawabannya berbeda jauh: molding Rp42,7 juta dibagi 8.500 botol adalah
Rp5.022 per botol — hampir 8% dari COGS.

**DUA komponen diserap, bukan satu:**

```
amortisasi = molding ÷ qty produksi
           + (botol kelebihan MOQ × biaya botol per unit lengkap) ÷ qty produksi
```

> ⚠️ Yang kedua sempat hilang, dan hilangnya diam. Toggle ini dulu hanya membagi
> molding, sementara botol yang terpaksa dibeli karena MOQ adalah uang yang sama
> nyatanya — dan jumlahnya sebanding. Pada penawaran Gelas Bening (A): molding
> Rp45,2 juta, kelebihan MOQ Rp33,4 juta. Toggle yang menyala melaporkan COGS
> Rp71.821 (margin 64,09%) padahal yang benar Rp75.750 (margin 62,13%) — selisih
> 4,6 poin margin, tanpa satu pun error. Dijaga `probe:hitung` bagian 7 dan
> `probe:pembelian` bagian 5, keduanya dengan kontrol negatif.

Kelebihan MOQ dinilai **termasuk freight** — botol itu benar-benar dikapalkan.

Yang membuatnya rumit: molding dipakai lintas batch. Kalau cetakan yang sama
dipakai tiga tahun, membebankan seluruhnya ke batch pertama membuat batch pertama
terlihat jauh lebih buruk daripada bisnisnya. Aplikasi ini tidak memutuskan itu —
ia menyediakan sakelarnya dan menyebut pembaginya di layar.

---

## 4. Initial Investment

```
Category 1 — Produk
  bahan baku      = (fragrance + PPN) + OEM × qty + perizinan varian
  botol & packing = investasi supplier kecil + besar + box × total botol
  fulfillment     = biaya per botol × total botol

Category 2 — Marketing
  offline + online + lainnya
```

### Empat qty yang berbeda, dan menyatukannya melahirkan empat bug

Ini bagian yang paling sering salah dibaca, jadi ditulis penuh:

```
kapasitas cairan = berapa botol yang CAIRANNYA cukup       (dari campuran)
qty diminta      = berapa botol yang DIPESAN               (dok.pembelian, null = ikut kapasitas)
qty dibeli       = max(MOQ, qty diminta)                   (yang DIBAYAR ke supplier)
qty produksi     = min(kapasitas cairan, qty dibeli)       (botol yang JADI)
```

**`qty produksi` yang mengalikan OEM, box, fulfillment, dan menimbang gross
profit. `qty dibeli` yang ditagih supplier.** Keduanya berbeda begitu MOQ atau
pembelian sampel ikut bermain.

> ⚠️ **MOQ adalah LANTAI, bukan pesanan.** MOQ 100 pcs pada kebutuhan 8.500
> berarti yang dibayar 8.500 — angka 100 tidak ikut menghitung apa pun. Ini
> pernah dilaporkan sebagai bug ("harga botol $0,5 × MOQ 100 masa hasilnya
> Rp84 juta?"): angkanya benar, tabelnya yang menonjolkan MOQ dan menyembunyikan
> qty yang dipakai. Sekarang baris pertama tabel adalah **Qty dibeli**, dan MOQ
> turun jadi keterangan yang menyebut apakah ia mengikat.

Investasi per supplier:

```
total = molding + (botol + aksesoris + perizinan + freight) × qty dibeli
```

> ⚠️ **MOQ yang melebihi pesanan meninggalkan botol tanpa isi.** MOQ 10.000 untuk
> 8.500 yang diproduksi berarti 1.500 botol dibayar sekarang dan disimpan. Modal
> tertahan itu masuk Initial Investment walau tidak satu pun botolnya terjual di
> batch ini — dan kalau ia cuma terlihat sebagai total supplier yang membengkak,
> ia akan dikira harga yang mahal alih-alih MOQ yang tinggi.

> ⚠️ **Arah sebaliknya juga ada, dan ia baru.** Memesan 100 botol sementara
> cairannya cukup untuk 8.500 meninggalkan **126 L cairan tanpa botol** — biang,
> alkohol, dan OEM-nya sudah dibayar tanpa jadi barang yang bisa dijual.
> Ditampilkan sebagai baris tersendiri di Initial Investment.

Nilai kelebihan stok memakai **biaya botol per unit termasuk freight**, dan
**tanpa** molding:

- **Freight ikut** karena botol kelebihan itu benar-benar dikapalkan dan
  benar-benar dibayar per CBM. Mengecualikannya melaporkan modal tertahan 9,6%
  lebih rendah dari yang sesungguhnya — Rp30,2 juta untuk Rp33,4 juta yang
  dibayar. Itu bug nyata yang pernah lolos di sini.
- **Molding dikecualikan** karena ia dibayar penuh berapa pun qty-nya, jadi
  memasukkannya melebih-lebihkan modal yang tertahan sebagai barang di gudang.

### Membandingkan supplier: total investasi TIDAK setara

Dua supplier ber-MOQ berbeda membelanjakan uang untuk jumlah botol yang berbeda.
Menobatkan yang totalnya lebih kecil sebagai "termurah" adalah cara tercepat
memilih vendor yang salah — dan supplier yang seluruh harganya masih Rp0 selalu
menang di baris itu.

Yang setara: **biaya per botol terpakai** = total investasi ÷ botol yang terisi.
Ia memasukkan molding dan botol kelebihan MOQ sebagai beban, jadi ia menjawab
pertanyaan yang sebenarnya ditanyakan.

Baris **biaya botol per unit** memakai `satuan.totalLengkap` — **termasuk
freight**. Tanpa freight ia bisa menobatkan vendor yang COGS-nya justru lebih
mahal: botol lebih murah tapi lebih gemuk membayar jauh lebih banyak per CBM.
`probe:pembelian` bagian 4 mengunci ini dengan kasus yang membalik pemenangnya.

### Pajak tidak dijumlahkan ulang

PPN fragrance dan perizinan botol sudah menempel di komponennya masing-masing.
KPI "Total Pajak Termasuk" **menjumlahkan ulang keduanya untuk ditampilkan**,
bukan menambahkannya ke total. Menjadikannya baris rincian tersendiri akan
menghitungnya dua kali — dan hasilnya masih terlihat seperti angka yang wajar.

---

## 5. Break-even & rata-rata tertimbang

```
gross profit tertimbang = (gp kecil × 8.500 + gp besar × 1.275) ÷ 9.775
break-even              = ceil(total investasi ÷ gross profit tertimbang)
```

Ditimbang **qty batch**, bukan rata-rata sederhana dari dua angka. Rata-rata
sederhana memberi botol besar bobot tujuh kali lipat dari porsinya yang
sebenarnya.

> ⚠️ Break-even bernilai **`null`, bukan `0`**, kalau gross profit tertimbangnya
> tidak positif. `0` adalah pernyataan ("tidak perlu menjual apa pun"); yang benar
> di sana adalah "tidak akan pernah balik modal pada harga ini". Meleburnya
> menampilkan kabar terburuk di halaman sebagai kabar terbaik.

### Target penjualan memakai asumsi yang BERBEDA

Halaman Target Penjualan mengasumsikan botol kecil dan besar terjual **sama
banyak** (1:1), bukan mengikuti komposisi batch (8.500 : 1.275). Dua angka pcs di
aplikasi ini karena itu tidak bisa langsung disandingkan. Disebut di layar, dan
disebut lagi di sini, karena angka pcs yang tidak menyebut asumsi campurannya
akan dibawa ke rapat sebagai target produksi.

---

## 6. Sensitivitas

Skenario adalah **dokumen lain** — bukan state global yang ditukar sementara.
Builder lama menukar variabel global `S` ke kloning lalu memulihkannya di
`finally`; itu bekerja, dan juga berarti tiap fungsi hitung punya satu argumen
tersembunyi yang tidak muncul di tanda tangannya.

Yang digeser tiap slider:

| Slider | Yang diubah |
| --- | --- |
| Kurs | `asumsi.kurs` |
| Tarif freight | `asumsi.freightPerCBM` **dan** `ratePerCBM` tiap supplier, diskala faktor yang sama |
| Harga fragrance | `usdPerLiter` tiap varian, diskala terhadap rata-rata saat ini |
| Waste, penyusutan | `asumsi.wastePct`, `campuran.susutPct` |
| Harga jual | `harga.kecil`, `harga.besar` |

> ⚠️ Baris freight itu penting dan pernah rusak diam-diam. **Tiap supplier
> menyimpan `ratePerCBM`-nya sendiri**, terlepas dari asumsi dasar — mengubah
> tarif di tab 1 tidak menggeser supplier yang sudah ada. Slider yang cuma
> mengganti tarif dasar karena itu tidak menggerakkan apa pun, dan terbaca sebagai
> "freight tidak berpengaruh". Dijaga `probe:hitung` bagian 9.

Harga fragrance digeser sebagai **faktor**, bukan ditetapkan ke satu nilai: kalau
tiap varian dipaksa ke rata-rata yang sama, sebaran harga antar varian hilang
begitu slider disentuh.

### Tornado memakai satuan yang berbeda, dan menyebutnya

Kurs, freight, dan harga fragrance diguncang **+10%**. Waste dan penyusutan
**+10 poin**. Bedanya disengaja: menaikkan waste 30% "sebesar 10%" jadi 33%
adalah guncangan yang jauh lebih kecil daripada yang dibayangkan pembacanya, dan
tabel yang mencampur dua makna tanpa menyebutnya membuat urutan pengaruhnya tidak
bisa dipercaya.

Titik awalnya **kondisi saat ini**, bukan posisi slider. Kalau ia mengikuti
slider, urutan pengaruhnya berubah tiap kali seseorang menggeser hal lain.
