# Qısa kod bələdçisi

Gündəlik iş üçün README-dəki iki serveri başlatmaq kifayətdir.

## Backend: əvvəl bu fayllara bax

| Fayl | İşi |
| --- | --- |
| `backend/app/main.py` | FastAPI-ni başladır, xəta cavablarını hazırlayır |
| `backend/app/routes.py` | Mövcud 7 ECG/AI/health API endpoint-i |
| `backend/app/algorithms/` | Laboratoriyanın strukturları, alqoritmləri, metadata və 2 API yolu |
| `backend/app/schemas.py` | API-yə gedən və API-dən gələn məlumat sahələri |
| `backend/app/dataset.py` | Lokal MIT-BIH fayllarını oxuyur |
| `backend/app/processing.py` | Filtrasiya, pik aşkarlanması, normallaşdırma və BPM/RR riyaziyyatı |
| `backend/app/analysis.py` | Bu addımları birləşdirib analiz cavabını qaytarır |
| `backend/app/ml.py` | Ortaq heartbeat feature-ləri və saxlanmış modeldən proqnoz |

Axın sadədir: **sorğu → routes → dataset/analysis → cavab**.

`processing.py` içində əsas funksiyalar:

- `preprocess`: siqnalı filtrləyir.
- `detect_peaks`: QRS pik namizədlərini tapır.
- `normalize`: z-score hesablayır.
- `rr_statistics`: piklər arasındakı məsafədən RR və BPM hesablayır.
- `compare_peaks`: aşkarlanan pikləri referens annotasiyalarla müqayisə edir.

## Frontend: əsas ekran faylları

| Fayl | İşi |
| --- | --- |
| `frontend/src/App.tsx` | Hansı səhifənin açılacağını seçir |
| `frontend/src/features/ecg/ECGAnalyzer.tsx` | Record, kanal və interval seçimi |
| `frontend/src/features/ecg/SignalAnalysis.tsx` | Analiz düyməsi, ayarlar və nəticələr |
| `frontend/src/features/ecg/ECGChart.tsx` | Siqnal və pikləri qrafikdə göstərir |
| `frontend/src/hooks/useApiResource.ts` | API sorğusu, loading, error və retry |
| `frontend/src/styles.css` | Ümumi görünüş |

## API yolları

- `GET /api/v1/health`
- `GET /api/v1/ecg/records`
- `GET /api/v1/ecg/records/100`
- `GET /api/v1/ecg/records/100/signal`
- `POST /api/v1/ecg/analyze`
- `GET /api/v1/ai/model` — modelin hazır olub-olmadığı və real versiyası
- `POST /api/v1/ai/predict` — seçilmiş interval üçün N/PVC model təxminləri
- `GET /api/v1/algorithms` — 16 seçim, izahlar, pseudocode və işlək nümunələr
- `POST /api/v1/algorithms/execute` — girişdən real icra addımlarını və nəticəni yaradır

`POST /api/v1/ecg/analyze` üçün birləşdirilmiş analiz sorğusu aşağıdakı kimidir.

```json
{
  "record_id": "208",
  "channel": 0,
  "start_seconds": 0.55,
  "duration_seconds": 10,
  "include_ai": true
}
```

`include_ai` standart olaraq `false` olur. `true` seçildikdə eyni filtrli siqnal və
piklər həm BPM/RR, həm də `ai_classification` üçün istifadə edilir. AI MLII/360 Hz,
0.5–40 Hz order-3 filtr və standart detection ayarları tələb edir. Digər ayarlar
422 qaytarır. Z-score qrafikdə ayrıca göstərilə bilər.

Naməlum record 404, səhv giriş 422, çatışmayan dataset/model 503 qaytarır.
Gözlənilməz xəta 500 və `detail` mesajı qaytarır, texniki məlumat backend loguna yazılır.
Model statusu model olmadıqda `available=false` ilə 200 qaytarır.
Hər signal sorğusu maksimum 30 saniyə, analiz intervalı 0.5–30 saniyədir.
Frontend sorğuları 15 saniyədən sonra dayandırır və retry göstərir.
Maşınla oxunan tam API sənədi lokal backend-də `/openapi.json` yolundadır.

Orijinal və filtrli siqnal mV olaraq qalır. Z-score ayrıca, vahidsiz sağ oxda
verilir. Piklər və BPM filtrli siqnaldan hesablanır. Nəticələr diaqnoz deyil.

AI təlim əmri `backend/scripts/train_model.py`, ekranı isə
`frontend/src/features/ai/AILab.tsx` içindədir. Feature çıxarılması train və predict
üçün ortaqdır. Annotasiyalar yalnız təlim/evaluation üçündür; predict onları oxumur.
Real modelin hazırlanması və ölçüləri [Sprint 3](sprint-3.md) sənədindədir.

## 3D Heart Explorer

`App.tsx` Heart Explorer səhifəsini menyudan açıldıqda lazy yükləyir.
3D üçün birbaşa Three.js və onun `GLTFLoader` / `OrbitControls` modulları istifadə olunur.

| Fayl | İşi |
| --- | --- |
| `frontend/src/features/heart/HeartExplorer.tsx` | Səhifə, struktur seçimi, qatlar və anatomiya izahları |
| `frontend/src/features/heart/HeartViewer.tsx` | Loading, xəta, retry və idarəetmə düymələri |
| `frontend/src/features/heart/heart-scene.ts` | GLB oxunması, işıq, kamera, picking və resursların azad edilməsi |
| `frontend/src/features/heart/anatomy.ts` | Kamera, damar və daxili strukturların mənbə xəritəsi və izahları |
| `frontend/public/models/heart/` | Lokal model, crosswalk, mənbə hash-ləri və lisenziya |

Struktur seçimi `anatomy.ts` mənbə xəritəsinə əsaslanır. Kamera, damar və daxili
strukturlar seçilir; hover qısa məlumat göstərir və layer controls daxili görünüşü açır.
Render yalnız görünüş, seçim və ölçü dəyişəndə baş verir.
Səhifədən çıxış fetch-i dayandırır, event/observer-ləri silir və WebGL resurslarını
azad edir. Retry yeni viewer yaradır.

Model mənbəyi, mövcud geometriyanın əhatəsi və testlər [Sprint 5](sprint-5.md) hesabatındadır.

## Algorithms Lab

Axın: **giriş → Pydantic yoxlaması → Python icrası → addımlar → React playback**.
Backend hər addımın ayrıca surətini saxlayır. Frontend həmin addımları göstərir;
Pause və Reset yeni hesablama başlatmır. Giriş dəyişəndə növbəti Run yeni sorğu göndərir.

| Fayl | İşi |
| --- | --- |
| `backend/app/algorithms/structures.py` | 9 strukturun orijinal implementasiyası |
| `backend/app/algorithms/execution.py` | 7 alqoritm, struktur əməliyyatları, addım və nəticələr |
| `backend/app/algorithms/catalog.py` | İzahlar, complexity, əməliyyat formaları və nümunələr |
| `backend/app/algorithms/schemas.py`, `routes.py` | Pydantic müqaviləsi və 2 endpoint |
| `frontend/src/features/algorithms/AlgorithmsLab.tsx` | Seçim, giriş formaları, ortaq controls və addımların göstərilməsi |
| `frontend/src/features/algorithms/AlgorithmVisualization.tsx` | Bar, graph, tree və struktur görünüşləri |
| `frontend/src/features/algorithms/algorithms.css` | Mövcud dizayna uyğun görünüş |
| `frontend/src/lib/algorithms.ts` | TypeScript sorğu/cavab tipləri |

Səhv format və uyğun olmayan giriş 422 qaytarır. Boş strukturdan silmək kimi
əməliyyat xətaları 200 cavabının `steps[].error` və `result.errors` sahələrində
göstərilir; sonrakı düzgün əməliyyatlar davam edir. İstifadəçi kodu icra edilmir.
Limitlər və API nümunəsi [Sprint 6](sprint-6.md) hesabatındadır.

## Testlər və köhnə sənədlər

Python testləri `backend/tests/`, komponent testləri frontend-də `*.test.tsx`,
brauzer testləri `frontend/e2e/` içindədir. Onları dəyişiklikdən sonra işlət.
Brauzer testləri ayrıca 18000/15173 portlarından istifadə edir; nəticələri
`.cache/browser-tests` və `.cache/browser-report` qovluqlarına yazır.

Əvvəlki sprint və audit hesabatları [archive/](archive/) içində saxlanılıb.
Oradakı fayl yolları, CI və coverage məlumatları həmin tarixlərin vəziyyətidir.
Hazırkı sadə versiyada ayrıca CI workflow, coverage həddi və Python lock faylı yoxdur.
