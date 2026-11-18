# Phase 2 — Sprint 5

17 noyabr 2026. Status **COMPLETE**.

## 1. Hazır imkanlar

- Mövcud menyuda işləyən 3D Heart Explorer və real anatomik GLB modeli.
- 360° rotasiya, zoom, mouse/touch pan və ilkin kameranı bərpa edən Reset view.
- Dörd ürək kamerasının həm siyahıdan, həm də model üzərində seçilməsi.
- Seçilmiş kamera divarının rənglə vurğulanması və ətraf strukturların solğun göstərilməsi.
- Struktur adı, funksiyası və qan dövranındakı yeri haqqında qısa izahlar.
- Qan dövranı ardıcıllığı, əsas damarlar və qapaqlar haqqında məlumat bələdçisi.
- Loading, çatışmayan model, WebGL dəstəyi və context itkisi üçün xəta/retry görünüşləri.
- Desktop, tablet, mobil, light/dark və keyboard idarəetməsi.

## 2. 3D texnologiyası

**Three.js 0.187.0**, `GLTFLoader` və `OrbitControls` istifadə olunur. Frontend-ə bir runtime dependency əlavə edilib. TypeScript üçün `@types/three` dev dependency-dir.

Səhifə və 3D kodu yalnız Heart Explorer açıldıqda lazy yüklənir. Model lokal statik fayldan oxunur. Render görünüş, seçim və ölçü dəyişəndə baş verir. Avtomatik hərəkət və inertial animasiya olmadığı üçün reduced-motion rejimi də sakit görünüş alır.

Çıxışda fetch dayandırılır, timer, observer və event listener-lər silinir. Geometry, material və texture resursları azad edilir, WebGL context-i bağlanır. Gec tamamlanan model parse nəticəsi də unmount olduqda azad edilir. Bu yanaşma Three.js-in rəsmi resurs və render təlimatlarına əsaslanır. [Resursların azad edilməsi](https://threejs.org/manual/pages/cleanup.html), [render on demand](https://threejs.org/manual/pages/rendering-on-demand.html)

## 3. Model mənbəyi və lisenziyası

**HuBMAP Human Reference Atlas — Heart, Female v1.3.** Müəlliflər Kristen Browne və Heidi Schlehlein-dir. Mənbənin model manifesti bu versiyanı və ümumi **CC BY 4.0** lisenziyasını göstərir. GLB və crosswalk faylları orijinal baytları ilə lokal saxlanılıb. Görünüşdə framing, işıqlandırma və highlight materialları tətbiq edilir. [HRA model qeydi](https://purl.humanatlas.io/ref-organ/heart-female/v1.3), [rəsmi kitabxana manifesti](https://humanatlas.io/assets/content/3d-reference-library-page/data.yaml)

| Fayl | Məlumat |
| --- | --- |
| `frontend/public/models/heart/heart.glb` | 1,745,560 bayt, 14 mesh |
| `frontend/public/models/heart/crosswalk.csv` | Mənbənin node/ontology xəritəsi |
| `frontend/public/models/heart/source.json` | URL-lər, müəlliflər, lisenziya və SHA-256 |
| `frontend/public/models/heart/LICENSE.txt` | CC BY 4.0 lisenziyasının tam mətni |

GLB SHA-256 qiyməti `98f66e46b149bfc3836592d9404c50290e21d302ec55c98813435e2d9847b1d9`-dur.

Seçim həm mənbə node adını, həm də GLB extras içindəki UBERON ID-ni yoxlayır.

| Ekrandakı ad | Mənbə node-u | Ontology ID |
| --- | --- | --- |
| Right atrium | `VH_F_right_cardiac_atrium` | `UBERON:0002078` |
| Right ventricle | `VH_F_right_ventricle` | `UBERON:0002080` |
| Left atrium | `VH_F_left_cardiac_atrium` | `UBERON:0002079` |
| Left ventricle | `VH_F_left_ventricle` | `UBERON:0002084` |

Bu modeldə ayrıca aorta və ağciyər arteriyası mesh-ləri yoxdur. Onlar məlumat bələdçisində izah olunur. Seçilə bilən highlight-lar dörd kamera divarını əhatə edir. Modeldə qapaqlar, septum və papillary muscle geometriyası da qorunub.

Tədris mətnləri NIH/NHLBI anatomiya və qan dövranı izahları əsasında qısa şəkildə hazırlanıb. [Ürək anatomiyası](https://www.nhlbi.nih.gov/health/heart/anatomy), [qan dövranı](https://www.nhlbi.nih.gov/health/heart/blood-flow)

## 4. Yaradılan və dəyişən fayllar

| Fayl | Məqsəd |
| --- | --- |
| Yeni `frontend/src/features/heart/HeartExplorer.tsx` | Səhifə və tədris paneli |
| Yeni `frontend/src/features/heart/HeartViewer.tsx` | Viewer lifecycle, loading, retry və toolbar |
| Yeni `frontend/src/features/heart/heart-scene.ts` | Kamera, işıq, model, picking və cleanup |
| Yeni `frontend/src/features/heart/anatomy.ts` | Təsdiqlənmiş xəritə və tədris mətnləri |
| Yeni `frontend/src/features/heart/heart.css` | Mövcud rənglərlə responsive görünüş |
| Yeni `HeartExplorer.test.tsx`, `heart-model.test.tsx` | UI, source mapping, hash və disposal testləri |
| Yeni `frontend/e2e/heart.spec.ts` | Real WebGL və inteqrasiya testləri |
| Yeni `frontend/public/models/heart/` | Model və provenance faylları |
| `frontend/src/App.tsx` | Mövcud hash route-a lazy Heart Explorer qoşulması |
| `frontend/src/components/Icon.tsx` | Zoom düymələrinin ikonları |
| `frontend/src/features/overview/Overview.tsx` | Heart Explorer üçün Available statusu və Phase 2 göstəricisi |
| `frontend/e2e/ecg.spec.ts` | Xəta ssenarisində StrictMode sorğu yarışının sabitləşdirilməsi |
| `frontend/package.json`, `frontend/package-lock.json` | Three.js və type dependency-ləri |
| `README.md`, `docs/development.md`, bu hesabat | İstifadə və kod izahı |

## 5. UI inteqrasiyası

Route `#/heart-explorer`-dir. Desktop-da viewer solda, seçim və izahlar sağdadır. Dar ekranda panellər alt-alta düzülür. Qan dövranı bələdçisi aşağıda açılır. Başlıq, border, spacing, Inter fontu və theme mövcud dizayndan istifadə edir.

Modelə fokus veriləndə ox düymələri rotasiya, `+` / `−` zoom, `Home` reset edir. Mouse üçün sol drag rotasiya, sağ drag pan, scroll zoom edir. Touch üçün bir barmaq rotasiya, iki barmaq zoom/pan edir. Seçim siyahısı və toolbar native button-larla keyboard-dan işləyir. WebGL xətası zamanı tədris mətnləri əlçatan qalır.

## 6. Faktiki yoxlamalar

| Əmr | Nəticə |
| --- | --- |
| `backend/` — `.venv/bin/python -m pytest -q` | **154 passed**, skip yoxdur |
| `frontend/` — `npm test` | **49 passed**, 11 test faylı |
| `frontend/` — `npm run build` | TypeScript və production build keçdi |
| `frontend/` — `npm run test:e2e -- e2e/heart.spec.ts` | **15 passed** |
| `frontend/` — `npm run test:e2e` | **39 passed**, bütün ECG/AI/3D ssenariləri |
| Layihə kökü — `git diff --check` | Keçdi |

Cəmi **242 avtomatlaşdırılmış test** keçdi. Brauzer testləri Chromium-da desktop 1440×1000, tablet 1024×1366 və mobil 393×852 ölçülərində icra olundu.

Real GLB render-i, görünüş dəyişməsi, reset-in əvvəlki görüntünü bərpa etməsi, mouse pan/scroll, keyboard, bir barmaq rotasiyası və iki barmaq pinch yoxlandı. Dörd kameranın highlight-ı və model üzərində picking işlədi. Səhifədən çıxışda əvvəlki canvas DOM-dan silindi və onun WebGL context-i bağlandı. Idle yoxlamasında 350 ms ərzində requestAnimationFrame sayğacı artmadı.

404 və WebGL context itkisi yaradılaraq retry ilə real modelin bərpası yoxlandı. WebGL dəstəyi söndürülərək fallback, tədris paneli və ECG səhifəsinə keçid test edildi. Screenshot-lar vasitəsilə light/dark və responsive görünüş də nəzərdən keçirildi.

İlk tam regresiya run-ında mövcud ECG xəta testində ləğv olunan ilk StrictMode sorğusu birdəfəlik mock-u istifadə etmişdi. Xəta cavabı retry addımına qədər saxlanılaraq ssenari sabitləşdirildi, son tam run-da 39 test keçdi.

Ayrı lint əmri konfiqurasiya edilməyib. Build TypeScript yoxlamasını da icra edir.

## 7. Qalan məsələlər

- Seçilə bilən geometriya dörd kamera divarı ilə məhdudlaşır. Damar izahları ayrıca tədris bələdçisindədir.
- WebGL 2 dəstəyi tələb olunur. Uyğun olmayan cihazlarda xəta ekranı və məlumat bələdçisi göstərilir.
- Lazy Heart Explorer chunk-u təxminən **653 KB**, gzip ilə **163 KB**-dır. Plotly chunk-u da əvvəlki build ölçü xəbərdarlığını verir.
- Brauzer verifikasiyası Chromium ilə aparılıb.

## 8. Tamamlanma qərarı

**Sprint 5 COMPLETE.** Lisenziyalı anatomik asset lokal render olunur. Rotasiya, zoom, pan, reset, təsdiqlənmiş kamera seçimi, tədris məzmunu, responsive görünüş və xəta bərpası yoxlanıb. Phase 1 regresiya testləri keçib.

## 9. Sprint 6 — Algorithms Lab

1. Mövcud `processing.py` funksiyalarından istifadə edərək filtr və R-pik aşkarlanmasını addım-addım göstərmək.
2. Hər addımın giriş/çıxış siqnalını və parametr təsirini müqayisə etmək.
3. BPM/RR hesablamasını seçilmiş piklər üzərində izah etmək.
4. Qısa real ECG intervalları ilə UI və rəqəmsal uyğunluq testləri hazırlamaq.
