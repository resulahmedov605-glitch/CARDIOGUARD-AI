# Phase 2 — Sprint 6

19 noyabr 2026. Status: **COMPLETE**.

## Hazır imkanlar

**Algorithms Lab** mövcud menyudan `#/algorithms-lab` yolunda açılır. Səhifə lazy
yüklənir və CardiGuard rəngləri, fontu, theme və responsive quruluşundan istifadə edir.

| Kateqoriya | Seçimlər |
| --- | --- |
| Data structures | Array, Linked List, Stack, Queue, Circular Queue, Hash Table, Binary Tree, Graph, Priority Queue |
| Sorting | Bubble Sort, Merge Sort |
| Searching | Binary Search |
| Graphs | BFS, DFS, Dijkstra |
| Window algorithms | Sabit enli maksimum cəm üçün Sliding Window |

Python implementasiyaları orijinaldır. Array indeks üzrə sürüşdürür; linked list,
stack və queue öz node/link-lərindən istifadə edir. Circular Queue modulo ilə
işləyir. Hash Table deterministik hash və separate chaining, Binary Tree balanssız
BST, Priority Queue isə stabil min-heap-dir. `heapq`, `deque` və hazır sort/graph
alqoritmləri istifadə olunmur.

Hər seçim üçün işlək nümunə, dəyişdirilə bilən giriş, izah, input/output,
pseudocode, time/space complexity, üstünlüklər, məhdudiyyətlər və tətbiq nümunəsi var.
Struktur əməliyyatları seçilib növbəyə əlavə olunur; nəticələr və xətalar saxlanılır.
BST insert/find/remove və inorder/preorder/postorder traversal təqdim edir.

## İcra və vizuallaşdırma

Backend giriş üzərində alqoritmi icra edir və həmin icranın müstəqil state
surətlərini qaytarır. Frontend həmin addımları göstərir. Sorting müqayisə/swap/write,
search interval/midpoint, graph isə node, edge, weight, current/visited/frontier
və Dijkstra predecessor/distance vəziyyətlərini göstərir. Stack, queue, list,
circular buffer, hash buckets, tree və heap üçün ayrıca görünüşlər var.

- **Run** yeni girişi icra edir; eyni girişdə dayandırılmış playback-i davam etdirir.
- **Pause** cari addımda dayanır.
- **Reset** ilk addıma qayıdır və playback-i dayandırır.
- **Step Forward** dayandırılmış icranı bir addım irəli aparır.
- **0.5x / 1x / 2x / 4x** addımlar arasında müvafiq olaraq 1600/800/400/200 ms saxlayır.

Cari addım, status və uyğun pseudocode sətri göstərilir. Execution log hazırkı
addıma qədər olan mesajları açır. Sonda returned values və ölçülmüş iş sayları görünür.
Input dəyişiklikləri növbəti Run-da tətbiq edilir. Algorithm dəyişdikdə köhnə
sorğu və playback ləğv olunur. Sorğularda mövcud 15 saniyə timeout/retry hook-u işləyir.

**Compare** eyni girişi Bubble Sort və Merge Sort-da icra edir. İki real trace
yan-yana göstərilir; qısa trace son addımında qalır. Comparison, swap və array write
sayları qaytarılır. Bunlar təlim üçün sayğaclardır; wall-clock benchmark deyil.
`operations` graph üçün baxılan adjacency entry-ləri, strukturlar üçün verilmiş
əməliyyatları, sliding window üçün çıxma/toplama addımlarını sayır. Sayğaclar bütün
Python təlimatlarının cəmini ifadə etmir.

## Backend API

| Yol | Cavab |
| --- | --- |
| `GET /api/v1/algorithms` | 16 seçim, metadata, əməliyyat sahələri və nümunə sorğular |
| `POST /api/v1/algorithms/execute` | `runs[]`, `step_count`; hər run-da `steps`, `result`, `metrics` |

Nümunə request:

```json
{
  "algorithm": "bubble-sort",
  "values": [3, 2, 1],
  "compare": true
}
```

Hər step-də `line`, `message`, typed `state`, aktiv/tamamlanan indekslər, range,
current/visited/frontier, distances, path_edges və error sahələri var.
Müqavilə lokal `/openapi.json` içində də görünür. Yeni endpoint-lər əvvəlki 7
ECG/AI/health yoluna əlavə olunub. Dataset və ML modeli laboratoriya üçün lazım deyil.

## Validasiya və limitlər

- İlk massivdə maksimum 24 tam ədəd, hər biri −999…999; maksimum 24 struktur əməliyyatı.
- Graph-da maksimum 12 unikal node və 32 edge; node adı 1–12 ASCII hərf/rəqəm/`_`/`-`.
- Edge və priority sonlu −999…999 ədədlərdir. Dijkstra mənfi edge weight qəbul etmir.
- Circular Queue və Hash Table capacity-si 1–16, hash key uzunluğu 1–20-dir.
- Window width 1–24; qeyri-boş massivə sığmalıdır. Binary Search sıralanmış giriş istəyir.
- Bir run-da müdafiə limiti 4096 trace addımıdır. Giriş limitləri icranı lokal və qısa saxlayır.

Səhv format, naməlum əməliyyat, çatışmayan sahə və uyğun olmayan ilkin vəziyyət
422 qaytarır. Boş strukturdan silmə, dolu buffer-ə əlavə etmə və mövcud olmayan
indeks/key kimi əməliyyat xətaları `steps[].error=true` və `result.errors` ilə
qaytarılır; əvvəlki state saxlanır və sonrakı əməliyyatlar davam edir. UI sonda
bu xətaları ayrıca bildirir. İcra yalnız icazəli əməliyyat adlarını çağırır;
istifadəçi Python və ya JavaScript kodu göndərə bilmir.

Boş massiv/graph dəstəklənir. Binary Search tapmayanda `index=null`, boş Sliding
Window-da `max_sum=null`, Dijkstra-da əlçatmaz node üçün distance `null`, path `[]`
olur. Traversal start node-dan əlçatan hissəni gəzər. Node və edge giriş sırası
tie-ları deterministik edir. Min-heap bərabər priority üçün əlavə edilmə sırasını saxlayır.

## Yaradılan fayllar

| Fayl | Məqsəd |
| --- | --- |
| `backend/app/algorithms/__init__.py` | Modul paketi |
| `backend/app/algorithms/structures.py` | 9 struktur |
| `backend/app/algorithms/execution.py` | 7 alqoritm, əməliyyatlar və trace |
| `backend/app/algorithms/catalog.py` | Tədris məzmunu və nümunələr |
| `backend/app/algorithms/schemas.py` | Pydantic request/response modelləri |
| `backend/app/algorithms/routes.py` | 2 endpoint |
| `backend/tests/test_algorithms.py` | 61 struktur/alqoritm/API/validasiya testi |
| `frontend/src/lib/algorithms.ts` | TypeScript tipləri |
| `frontend/src/features/algorithms/AlgorithmsLab.tsx` | Səhifə, formalar və ortaq execution controls |
| `frontend/src/features/algorithms/AlgorithmVisualization.tsx` | State-dən vizuallaşdırmalar |
| `frontend/src/features/algorithms/algorithms.css` | Responsive üslub və keçidlər |
| `frontend/src/features/algorithms/AlgorithmsLab.test.tsx` | Controls, sürət, input, retry və keçid testləri |
| `frontend/e2e/algorithms.spec.ts` | Real API ilə 4 ssenari × 3 ekran ölçüsü |
| `docs/sprint-6.md` | Bu hesabat |

Dəyişən fayllar: `backend/app/main.py` router-i qoşur; `frontend/src/App.tsx`
lazy səhifəni açır; `frontend/src/features/overview/Overview.tsx` Available göstərir.
`frontend/e2e/heart.spec.ts` mövcud 3D səhifənin `.heart-structure-list` selektoruna
uyğunlaşdırılıb. `README.md` və `docs/development.md` istifadə/kod bələdçisini yeniləyir.
Yeni runtime və dev dependency əlavə edilməyib.

## Faktiki yoxlamalar

| Əmr | Nəticə |
| --- | --- |
| `backend/` — `.venv/bin/python -m pytest` | **215 passed** |
| `frontend/` — `npm test` | **54 passed**, 12 test faylı |
| `frontend/` — `npm run build` | TypeScript və production build keçdi |
| `frontend/` — `npm run test:e2e` | **51 passed**, desktop/tablet/mobile |
| Layihə kökü — `git diff --check` | Keçdi |

Backend testləri boundary/invalid girişlər, collision, wraparound, boş/full
strukturlar, BST removal, heap tie-ları, random sorting, graph cycles/unreachable/
zero-weight/stale heap, determinism, bütün 16 catalog nümunəsi və API-ni yoxlayır.
Frontend testləri real returned frame-lər üzrə controls, sürət, pseudocode,
formalar və xətadan bərpanı yoxlayır.

Brauzer yoxlaması Chromium-da desktop 1440×1000, tablet 1024×1366 və mobil
393×852 ölçülərindədir. ECG/AI/3D regresiya ssenariləri də eyni suite-dədir.
Screenshot/report artefaktları `.cache/browser-tests` və `.cache/browser-report` içindədir.
Ayrıca lint əmri konfiqurasiya edilməyib; build TypeScript yoxlamasını da icra edir.

Cəmi **320 test** keçdi, skip yoxdur. Bunlardan 76-sı Sprint 6 ilə əlavə edilib:
61 backend, 3 frontend və 12 brauzer testi. Yeni 16 seçimin hamısı real lokal
API ilə işlədildi. Sorting müqayisəsi, controls, graph distance/path, input xətaları
və boş girişlər yoxlandı. Mobil graph və desktop light/dark screenshot-ları
nəzərdən keçirildi; üç ölçüdə səhifənin üfüqi daşması yoxlanıldı. Əvvəlki ECG,
AI və 3D ürək brauzer ssenarilərinin hamısı keçdi.

Son production build-də Algorithms Lab JavaScript chunk-u **19.27 KB**,
gzip ilə **6.10 KB**-dır. TypeScript xətası yoxdur.

## Lokal başlatmaq

Layihə kökündən iki terminalda:

```bash
cd backend
.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

```bash
cd frontend
npm run dev
```

Brauzerdə `http://127.0.0.1:5173/#/algorithms-lab` aç. Hazır dependency-lər kifayətdir.
Brauzer testləri öz serverlərini ayrıca 18000/15173 portlarında açır.

## Məhdudiyyətlər və qərarlar

- Müqayisə Bubble Sort və Merge Sort üçündür. Eyni giriş və eyni playback addımı istifadə olunur.
- Binary Tree balanssız BST-dir, ayrı AVL/red-black balancing implementasiyası yoxdur.
- Graph bir node cütü üçün bir edge saxlayır. Əməliyyatla eyni edge-in çəkisi yenilənə bilər.
- Sliding Window maksimum cəm üçün sabit enli nümunədir. Bərabər maksimumda ilk window seçilir.
- Trace əvvəlcə tam hesablanır, sonra lokal göstərilir. Streaming və böyük dataset benchmark-ı yoxdur.
- Big-O əsas alqoritmin işini təsvir edir. Binary Search girişinin sıralanma yoxlaması
  O(n)-dir. Snapshot-ların surətlənməsi və JSON transferi əlavə vaxt/yaddaş tələb edir.
  Dijkstra lazy heap üçün O((V + E) log(V + E)) vaxt, O(V + E) əlavə yaddaş göstərir.
- Vite-in böyük chunk xəbərdarlığı mövcud Plotly və Three.js hissələrinə aiddir.
  Algorithms Lab ayrıca lazy chunk-dur. Brauzer yoxlaması Chromium ilə məhdudlaşır.
- Nümunələr tədris məqsədlidir; klinik diaqnoz və ya tibbi qərar vermir.

Complexity mətnləri üçün texniki istinadlar:
[NIST Binary Search](https://xlinux.nist.gov/dads/HTML/binarySearch.html),
[MIT 6.006 mühazirə qeydləri](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/lecture-notes/).

## Tamamlanma qərarı

**Sprint 6 COMPLETE.** Tələb olunan 9 struktur və 7 alqoritm, real execution
trace-ləri, custom input, playback controls, müqayisə, tədris məzmunu, API və
responsive UI hazırdır. Backend, frontend, production build və əvvəlki funksiyaları
əhatə edən brauzer yoxlamaları keçib. Tələb olunan funksiyalar üzrə açıq blocker yoxdur.
