# Qısa kod bələdçisi

Gündəlik iş üçün README-dəki iki serveri başlatmaq kifayətdir.

## Backend: əvvəl bu fayllara bax

| Fayl | İşi |
| --- | --- |
| `backend/app/main.py` | FastAPI-ni başladır, xəta cavablarını hazırlayır |
| `backend/app/routes.py` | Bütün 5 API endpoint-i bir yerdədir |
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

Orijinal və filtrli siqnal mV olaraq qalır. Z-score ayrıca, vahidsiz sağ oxda
verilir. Piklər və BPM filtrli siqnaldan hesablanır. Nəticələr diaqnoz deyil.

AI təlim əmri `backend/scripts/train_model.py`, ekranı isə
`frontend/src/features/ai/AILab.tsx` içindədir. Feature çıxarılması train və predict
üçün ortaqdır. Annotasiyalar yalnız təlim/evaluation üçündür; predict onları oxumur.
Real modelin hazırlanması və ölçüləri [Sprint 3](sprint-3.md) sənədindədir.

## Testlər və köhnə sənədlər

Python testləri `backend/tests/`, komponent testləri frontend-də `*.test.tsx`,
brauzer testləri `frontend/e2e/` içindədir. Onları dəyişiklikdən sonra işlət.
Brauzer testləri ayrıca 18000/15173 portlarından istifadə edir; nəticələri
`.cache/browser-tests` və `.cache/browser-report` qovluqlarına yazır.

Əvvəlki sprint və audit hesabatları [archive/](archive/) içində saxlanılıb.
Oradakı fayl yolları, CI və coverage məlumatları həmin tarixlərin vəziyyətidir.
Hazırkı sadə versiyada ayrıca CI workflow, coverage həddi və Python lock faylı yoxdur.
