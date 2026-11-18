# CARDIOGUARD AI

Lokal işləyən ECG layihəsi. Real MIT-BIH siqnalını göstərir, filtrləyir,
pikləri tapır və təxmini BPM/RR hesablayır. Klinik diaqnoz üçün nəzərdə tutulmayıb.

## Layihəni açmaq

İki terminal aç. Hər ikisində bu layihənin qovluğundan başla.

**1. Backend**

```bash
cd backend
.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**2. Frontend**

```bash
cd frontend
npm run dev
```

Brauzerdə aç: http://127.0.0.1:5173

ECG Analyzer bölməsində kanal və vaxt intervalı seç, sonra **Run analysis** bas.
Normallaşdırma üçün **Normalization → Z-score** seçə bilərsən.

Siqnal, BPM/RR və AI nəticələrini birlikdə görmək üçün **MLII → Analyze with AI** bas.
Bu düymə modelin sabit filtr və pik ayarlarını tətbiq edir. Adi **Run analysis**
seçdiyin ayarlarla işləyir. Modelin versiyası və evaluation nəticələri AI Lab-da görünür.

## İlk quraşdırma

Yalnız dependency-lər və dataset yoxdursa lazımdır. Node.js 24 və Python 3.13 ilə yoxlanıb.

Backend qovluğunda:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python -m scripts.download_mitbih --annotations
```

Frontend qovluğunda:

```bash
npm ci
```

Windows-da `.venv/bin/python` yerinə `.venv\Scripts\python.exe` istifadə et.

## Fayllar haradadır?

| Qovluq | Nə üçündür? |
| --- | --- |
| `backend/app/` | API, dataset oxunması və ECG hesablamaları |
| `backend/tests/` | Backend testləri |
| `backend/scripts/` | Dataset endirmə və nəticə yoxlama əmrləri |
| `frontend/src/` | Səhifələr, düymələr və qrafik |
| `data/mitbih/` | Lokal ECG faylları |
| `docs/` | Qısa kod bələdçisi; köhnə hesabatlar `archive/` içindədir |
| `.cache/` | Avtomatik yaranan cache və test nəticələri |

Kodun izahı: [Qısa bələdçi](docs/development.md).
Dataset mənbəyi: [MIT-BIH / PhysioNet](data/README.md).

## Yoxlamaq

Backend qovluğunda:

```bash
.venv/bin/python -m pytest
```

Frontend qovluğunda:

```bash
npm test
npm run build
```

Əlavə brauzer testləri lazım olsa:

```bash
npm run test:e2e:install
npm run test:e2e
```

## Mövcud imkanlar

- Record 100, 106, 119, 200 və 208; hər sorğuda maksimum 30 saniyə.
- Zoom, pan, hover və reset.
- Filtrasiya, ayrıca z-score siqnalı, piklər və BPM/RR cədvəli.
- Light/dark görünüş və ölçüsü dəyişən sidebar.

AI Lab artıq real N/PVC model nəticələrini göstərir. AI üçün MLII / 360 Hz istifadə olunur.
3D Heart Explorer lokal anatomik ürək modeli ilə işləyir. Algorithms Lab növbəti sprint üçündür.
Plotly üçün build ölçü xəbərdarlığı normaldır; build uğurla tamamlanır.

## AI modelini hazırlamaq

Backend qovluğunda bir dəfə:

```bash
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python -m scripts.download_mitbih --ml
.venv/bin/python -m scripts.train_model
```

Sonra **AI Lab → record seç → Classify beats**. Model backend açılarkən avtomatik
öyrədilmir. Mövcud dataset faylları `--ml` ilə yenidən yazılmır.

Train: 100/106/200, validation: 119, test: 208. Eyni şəxsin döyüntüləri split-lər
arasında qarışdırılmır. Yalnız N və V annotasiyaları istifadə olunur.
Model, metadata və hazırlanmış dataset `data/models/` içində lokal saxlanılır.
Ətraflı nəticələr: [Sprint 3](docs/sprint-3.md).

MVP inteqrasiyası və son yoxlamalar [Sprint 4](docs/sprint-4.md) hesabatındadır.

## 3D Heart Explorer

Menyudan **3D Heart Explorer** aç. Mouse ilə sürüşdürərək döndər, scroll/pinch ilə
zoom et. Sağ düymə ilə sürüşdürmək və ya iki barmaq pan edir. **Reset view** ilkin
görünüşü bərpa edir. Modelə fokus verildikdə ox düymələri döndərir, `+` / `−` zoom,
`Home` isə reset edir.

Modeldə və ya siyahıda dörd ürək kamerasından birini seçərək onun funksiyasını oxu.
HRA Heart Female v1.3 modeli, mənbə xəritəsi və CC BY 4.0 lisenziyası
`frontend/public/models/heart/` içindədir. Aorta və ağciyər arteriyaları məlumat
bələdçisində izah olunur. 3D seçim dörd kamera divarını əhatə edir.

Model əlavə download və ya API açarı tələb etmir. WebGL olmadıqda məlumat bələdçisi
işləyir. Mənbə və yoxlama nəticələri [Sprint 5](docs/sprint-5.md) hesabatındadır.
