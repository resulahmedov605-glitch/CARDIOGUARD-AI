# Phase 1 — Sprint 4

Yekun yoxlama tarixi 17 noyabr 2026.

## A. Sprintlərin vəziyyəti

| Sprint | Status | Yoxlanmış nəticə |
| --- | --- | --- |
| 1 | COMPLETE | Lokal record seçimi, real ECG, zoom/pan/hover/reset |
| 2 | COMPLETE | Filtrləmə, z-score, piklər, BPM/RR və annotasiya müqayisəsi |
| 3 | COMPLETE | Real N/PVC təlimi, saxlanmış model, inference API və AI Lab |
| 4 | COMPLETE | Birləşdirilmiş analiz, xəta cavabları və desktop/tablet/mobil testləri |

## B. Tamamlanan dəyişikliklər

- ECG Analyzer-də **Analyze with AI** eyni siqnalı və aşkarlanmış pikləri BPM/RR və modelə ötürür. N/PVC sayları, ehtimallar və qrafik işarələri birlikdə göstərilir.
- Mövcud analiz endpoint-inə `include_ai` əlavə edilib. AI nəticəsində siqnal massivi təkrar göndərilmir. Ayrı AI prediction endpoint-i də işləyir.
- AI düyməsi MLII/360 Hz üçün modelin 0.5–40 Hz order-3 filtrini və standart pik ayarlarını tətbiq edir. Bu seçim ekranda göstərilir. Adi analiz fərdi ayarları qəbul edir.
- Record siyahısındakı metadata təkrar istifadə olunur. İlk ECG yüklənməsi üçün API sorğuları üçdən ikiyə enib.
- Model versiya və fayl dəyişikliklərinə görə yenidən yoxlanan cache-də saxlanılır. Paralel ilk sorğular üçün yükləmə qorunur. Korlanmış və dəyişdirilmiş fayllar 503 qaytarır.
- İnference bir dəfə `predict_proba` hesablayır. Cavabın ölçüsü, sonlu qiymətləri və ehtimal cəmləri yoxlanılır. Pik refinement hər pik üçün bütün intervalın medianını təkrar hesablamır.
- Qrafik formadakı hər dəyişiklikdə təkrar render edilmir. AI işarələri dolu dairə/romb, detektor işarələri konturla göstərilir.
- Gözlənilməz backend xətaları JSON `detail` cavabı və server logu yaradır. OpenAPI xəta cavabları sənədləşdirilib. Dataset bərpa mesajları seçilmiş record-u göstərir.
- Referenslə uyğun gəlməyən piklər barədə xəbərdarlıq əlavə edilib. Model versiyası, iki sinif məhdudiyyəti və kalibrasiya olunmamış ehtimallar göstərilir.

### Sprint 3 yenidən yoxlandı

Beş real MIT-BIH record-un `.hea`, `.dat`, `.atr` faylları ilə dataset yenidən hazırlanıb və RandomForest ayrıca müvəqqəti qovluqda öyrədilib. Hazırkı model `603d5a015e2f5cc4`, yoxlama təlimi `6ea0ce5de8fe37c0` olub. Mənbə hash-ləri, seçilmiş nümunələr və evaluation nəticələri uyğun gəlib.

| Split | Record-lar | Nümunə sayı |
| --- | --- | --- |
| Train | 100, 106, 200 | 6706 |
| Validation | 119 | 1949 |
| Test | 208 | 2528 |

Patient qrupları split-lər arasında ayrıdır. Validation/test təlimə daxil edilmir. Held-out test accuracy **99.2089%**, macro F1 **99.1677%**, confusion matrix `[[1535,19],[1,973]]` olub. Bu ölçülər seçilmiş N/V annotasiyalarının mərkəzlərində klassifikasiyaya aiddir. Detektor səhvləri bu ölçülərə daxil edilmir.

## C. Dəyişdirilən fayllar

| Qovluq | Fayllar və məqsəd |
| --- | --- |
| `backend/app/` | `analysis.py`, `ml.py`, `processing.py` — ortaq analiz və cache |
| `backend/app/` | `routes.py`, `schemas.py`, `main.py`, `dataset.py` — API kontraktı və xətalar |
| `backend/scripts/` | `train_model.py` — medianın təkrar hesablanmasının aradan qaldırılması |
| `backend/tests/` | `test_ml.py`, yeni `test_pipeline.py` — inteqrasiya, cache və xəta yoxlamaları |
| `frontend/src/features/ecg/` | `ECGAnalyzer.tsx`, `SignalAnalysis.tsx`, `ECGChart.tsx`, `ecg.css` və əlaqəli üç test faylı |
| `frontend/src/features/ai/` | `AILab.tsx`, yeni `ClassificationResults.tsx` — ortaq nəticə görünüşü |
| `frontend/src/lib/` | `analysis.ts`, `ai.ts` — API tipləri |
| `frontend/e2e/` | `ecg.spec.ts`, yeni `pipeline.spec.ts` — regresiya və bütün analiz axını |
| `frontend/` | `playwright.config.ts` — tablet ölçüsü |
| Sənədlər | `README.md`, `docs/development.md`, bu hesabat |

## D. İcra edilmiş yoxlamalar

| Qovluq və əmr | Faktiki nəticə |
| --- | --- |
| `backend/` — `.venv/bin/python -m pytest -q` | **154 passed**, skip yoxdur |
| `frontend/` — `npm test` | **44 passed**, 9 test faylı |
| `frontend/` — `npm run build` | TypeScript yoxlaması və production build keçdi |
| `frontend/` — `npm run test:e2e` | **24 passed**, Chromium desktop/tablet/mobil |
| `backend/` — `.venv/bin/python -m pip check` | Dependency konflikti yoxdur |
| `backend/` — `.venv/bin/python -m scripts.evaluate_ecg --full-record` | Record 100, iki kanal üzrə 122 interval |
| Layihə kökü — `git diff --check` | Whitespace xətası yoxdur |

Ümumilikdə **222 avtomatlaşdırılmış test** keçdi. Brauzerdə 1440×1000, 1024×1366 və 393×852 ölçüləri yoxlandı. Birləşdirilmiş nəticə 820×1180 tablet ölçüsündə də yoxlandı. Real siqnal, BPM/RR, model versiyası, N/PVC sayları, marker koordinatları, ehtimal cədvəli, interval dəyişməsi, naviqasiya, theme və sidebar test edildi. Çatışmayan model/dataset və API xətaları brauzerdə idarə olunan cavablarla yoxlandı. Retry real backend nəticəsi ilə bərpa olundu.

Backend testləri beş real record-un tam API axınını da işlətdi. Ayrıca testlər model olmadıqda adi analizin işləməsini, yanlış parametrləri, korlanmış artifact-ları, paralel cache yüklənməsini və gözlənilməz 500 cavabını yoxlayır.

Tam record-100 müqayisəsi əvvəlki saxlanmış nəticələrlə uyğun gəldi. Kanal 0 üçün TP/FP/FN **2261/0/12**, kanal 1 üçün **2253/0/20** oldu.

Təlim yoxlaması `.venv/bin/python` ilə aşağıdakı çağırışları icra etdi.

```python
from pathlib import Path
from tempfile import TemporaryDirectory
from app.ml import load_model
from scripts.train_model import train

_, current = load_model()
with TemporaryDirectory(dir="../.cache", prefix="sprint-4-model-") as folder:
    result = train(directory=Path(folder))
    model, restored = load_model(Path(folder))
    assert current["records"] == result["records"]
    assert current["evaluation"] == result["evaluation"]
```

Lokal ölçmədə cache-siz model yüklənməsinin medianı 30 təkrarda **12.258 ms**, cache ilə 100 təkrarda **0.053 ms** oldu. Beş record üçün 30 saniyəlik birləşdirilmiş TestClient sorğuları **14.389–21.201 ms** çəkdi. Bunlar bu maşındakı prosesdaxili ölçmələrdir.

Build Plotly chunk-u üçün ölçü xəbərdarlığı verdi. Ayrı lint əmri konfiqurasiya edilməyib. Brauzer yoxlamaları Chromium-da icra edilib.

## E. Qalan məhdudiyyətlər

| Səviyyə | Vəziyyət |
| --- | --- |
| Kritik/yüksək texniki bloker | Yoxlanmış lokal MVP axınında aşkarlanmadı |
| Orta | Detektor bəzi morfologiyalarda pikləri qaçırır. Record 208-in ilk 30 saniyəsində 52 annotasiya edilmiş döyüntüdən 35-i uyğunlaşdırıldı, 17-si qaçırıldı. BPM/RR və AI sayları bundan təsirlənir. Ekran bu uyğunsuzluğu bildirir. |
| Orta | Model yalnız beş record və N/V sinifləri ilə məhdudlaşır. Digər ritmlər bu iki sinfə təyin oluna bilər. Ehtimallar kalibrasiya edilməyib. |
| Aşağı | Lazy yüklənən Plotly chunk-u təxminən 1.17 MB, gzip ilə 388 KB-dır. |

Detektor üzrə bu nəticə tədqiqat MVP-sinin ölçülmüş məhdudiyyəti kimi saxlanılır. Məhsul təxmini alqoritm nəticələri göstərir. Daha geniş dəqiqlik iddiaları üçün müxtəlif record-larda əlavə detector və classifier qiymətləndirilməsi lazımdır.

## F. Phase 1 qərarı

**COMPLETE — lokal tədris və tədqiqat MVP-si üzrə. Phase 2 inkişafına keçmək olar.**

Dataset → filtr → piklər → BPM/RR → klassifikasiya → API → dashboard axını real data ilə işləyir. Məlumatların sample/time uyğunluğu, modelin yenidən öyrədilməsi, xətalar və əvvəlki imkanlar testlərlə yoxlanıb. Yuxarıdakı dəqiqlik məhdudiyyətləri bu qərarın əhatəsini müəyyən edir.

## G. Sprint 5 üçün növbəti addımlar

1. Lokal saxlanacaq, lisenziyası aydın anatomik 3D ürək asset-i seçmək.
2. Mövcud Heart Explorer bölməsinə rotate, zoom və reset əlavə etmək.
3. Ürək hissələrinin seçilməsi, adları və qısa tədris izahlarını hazırlamaq.
4. Modelin yüklənməsi, WebGL xətası, tablet idarəetməsi və render performansını yoxlamaq.

İstifadə qaydası və API sorğu nümunəsi [qısa bələdçidə](development.md) verilib.
