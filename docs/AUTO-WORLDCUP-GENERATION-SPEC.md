# [기획 사양서] AI 월드컵 템플릿 일일 자동 생성 (Auto WorldCup Template Generator)

본 문서는 사용자가 매일 직접 주제를 선정하고 이상형 월드컵을 수동으로 생성하는 번거로움을 해결하기 위해, 정해진 시간마다 AI(Gemini 2.5 Flash 및 YouTube Search API)가 스스로 주제를 기획하고 템플릿 생성까지 완료하는 완전 자동화 스케줄러 기능에 대한 기획 사양서입니다.

---

## 1. 요구사항 정의 (Requirements)

### 1.1. 스케줄링 주기 및 작동 시간
* **주기**: 매일 1회 실행
* **실행 시간**: **한국 시간 오전 5시 30분 (UTC 20시 30분)**
  * **선정 사유**: API 쿼터가 리셋되는 오후 4~5시를 피하고, 전세계/국내 트래픽 피크 타임 및 Gemini Free Tier API 트래픽이 덜 몰리는 새벽 시간대를 고려하여 최적의 오프 피크(Off-Peak) 타임으로 선정했습니다.

### 1.2. AI 자동 주제 선정 규칙
* **동작 방식**: 
  1. 최근 데이터베이스에 등록된 `WorldCupTemplate` 목록의 제목들을 조회합니다.
  2. 조회한 제목 리스트를 Gemini API 프롬프트에 제외 대상(Exclusion)으로 주입합니다.
  3. "기존 주제와 겹치지 않는 참신하고 유저들이 좋아할 만한 새로운 이상형 월드컵 주제"를 1개 생성하도록 요청합니다.
* **유사 중복 허용 범위**:
  * 말만 바꾼 동일한 주제는 불허합니다.
    * *(불허 예시)* "K-pop TOP 100 월드컵" vs "인기 K-pop 월드컵"
  * 단, 아이템이 겹치더라도 선정 기준이나 기획 의도가 다른 주제는 허용합니다.
    * *(허용 예시)* "K-pop TOP 100 월드컵" vs "K-pop 유튜브 조회수 TOP 100 월드컵"
* **접두사 강제**:
  * AI가 생성했음을 직관적으로 구분하기 위해, 자동 생성된 월드컵의 제목 앞에 반드시 `[AI생성]` 접두사를 붙여 저장합니다.
    * *ex)* `[AI생성] K-pop 유튜브 조회수 TOP 100 월드컵`
* **공개 상태**:
  * 즉시 플레이가 가능하도록 별도의 검토 과정 없이 **`ACTIVE`** 상태로 바로 데이터베이스에 공개 저장합니다.
* **작성자 설정**:
  * 생성자 계정(`creator_id`)은 `users` 테이블의 `id = 2`(ADMIN 계정)로 매핑합니다.

### 1.3. 대량 아이템 생성 및 분할 생성 규칙
Gemini API를 통해 한 번에 다수의 아이템 목록(예: 총 100개)을 받아온 후, 이상형 월드컵의 대진 강수 단위($2^n$)에 맞춰 여러 개의 월드컵 템플릿으로 분할 생성합니다.

* **분할 알고리즘**:
  1. Gemini에게 요청하여 대상 주제에 속하는 아이템 목록 $M$개를 획득합니다 (기본 요청 개수: 100개).
  2. 획득한 아이템 개수가 $M \ge 64$ 이면:
     * 첫 번째 템플릿: 64강 설정. 아이템 목록 중 앞의 64개를 사용해 템플릿을 생성합니다.
     * 남은 아이템 개수 $R = M - 64$ (예: 100 - 64 = 36개).
  3. 남은 아이템 개수 $R$에 대해:
     * 만약 $R \ge 32$ 이면: 
       * 두 번째 템플릿: 32강 설정. 남은 아이템 중 앞의 32개(또는 36개 전체)를 넣어 템플릿을 추가 생성합니다.
       * 남은 아이템 개수 $R_2 = R - 32$ (예: 36 - 32 = 4개).
     * 만약 $R < 32$ 이고 $R \ge 16$ 이면: 
       * 16강 설정으로 추가 템플릿을 생성합니다.
  4. 남은 아이템 개수가 최소 강수(예: 16강 미만)인 경우, 추가 생성을 하지 않고 남은 아이템은 폐기합니다.
* **주의**: 32강 설정이지만 아이템이 36개 들어가는 등 강수 기준보다 조금 더 많은 아이템이 할당되어도 이상형 월드컵 플레이 로직 상 문제가 없어야 합니다.

---

## 2. 관련 기존 시스템 코드 분석

Claude가 개발할 때 참고할 수 있는 백엔드의 기존 핵심 구현 코드입니다.

1. **[AiGenerationService.kt](file:///C:/Users/Administrator/CursorProjects/Pickty_Workspace/Pickty/backend/src/main/kotlin/com/pickty/server/domain/ai/service/AiGenerationService.kt)**
   * Gemini 2.5 Flash API와 연동해 아이템 목록을 가져오고, [MediaSearchRouter](file:///C:/Users/Administrator/CursorProjects/Pickty_Workspace/Pickty/backend/src/main/kotlin/com/pickty/server/domain/ai/media/MediaSearchRouter.kt)를 활용해 각 아이템의 유튜브/이미지 검색 후보군(`MediaCandidate`)을 멀티스레드로 수집하는 핵심 서비스입니다.
2. **[WorldCupTemplateService.kt](file:///C:/Users/Administrator/CursorProjects/Pickty_Workspace/Pickty/backend/src/main/kotlin/com/pickty/server/domain/worldcup/service/WorldCupTemplateService.kt)**
   * 월드컵 템플릿을 최종 생성(`create`)하고 데이터베이스에 등록하는 비즈니스 로직을 포함하고 있습니다. `CreateWorldCupTemplateRequest` DTO 형식을 확인해야 합니다.
3. **[MediaSearchRouter.kt](file:///C:/Users/Administrator/CursorProjects/Pickty_Workspace/Pickty/backend/src/main/kotlin/com/pickty/server/domain/ai/media/MediaSearchRouter.kt)**
   * 아이템 이름에 맞는 미디어(동영상/이미지 등)를 검색하는 라우터 인터페이스입니다. 자동 매핑 시 검색 결과 리스트 중 최상위(인덱스 0번) 후보 정보를 추출해 바인딩해야 합니다.

---

## 3. 구현 추천 아키텍처 (Proposed Technical Design)

* **패키지 위치**: `com.pickty.server.domain.worldcup.scheduler`
* **클래스명**: `WorldCupAutoGeneratorScheduler`
* **사용 기술**: Spring `@Scheduled` 및 Kotlin Coroutine Async 연동
* **트랜잭션 관리**: 
  * 전체 프로세스가 하나의 트랜잭션으로 묶이면 안 됩니다. (Gemini API 호출 및 외부 검색 API 호출이 길어지면 커넥션 풀을 과도하게 점유함)
  * 데이터베이스 저장 부분(`WorldCupTemplateService.create`)에만 트랜잭션이 전파되도록 비동기 및 비트랜잭션 영역에서 API 연동을 마친 뒤 영속화 단계를 수행해야 합니다.

---

## 4. Claude를 위한 질문 및 고민 사항 (Open Questions for Claude)

Claude가 개발을 시작하기 전, 코드 정합성과 안정성을 높이기 위해 먼저 아래 질문들에 대해 분석하고 답변하도록 유도해 주세요.

1. **검색 후보 누락 대응**:
   * Gemini가 생성한 아이템 중 특정 키워드는 외부 검색 API(유튜브 등) 결과가 한 개도 반환되지 않을 수 있습니다. 이 경우, 해당 아이템은 어떻게 처리해야 할까요? (예: 제외 처리 후 남은 아이템 수로 강수 재조정, 혹은 더미 이미지로 대체 등)
2. **이상형 월드컵 플레이 강수 정합성**:
   * 32강 월드컵 템플릿에 아이템이 36개 들어가는 등 강수 크기와 등록 아이템 수가 딱 맞아떨어지지 않을 때, 프론트엔드 플레이 UX나 백엔드 연동에 예외가 발생하지 않는지 확인이 필요합니다. 만약 2의 거듭제곱 개수 외의 데이터가 에러를 유발한다면 강수 정수값에 맞춰서 남는 아이템을 엄격하게 버려야(Truncate) 할까요?
3. **스케줄러 실패 및 쿼터 소진 알림**:
   * 만약 일시적인 네트워크 장애나 API 쿼터 부족(Gemini 429 에러 등)으로 스케줄러 작업이 통째로 실패했을 때, 로그 외에 시스템이나 관리자에게 어떤 예외 알림을 보낼지(혹은 다음 실행 시간까지 단순 스킵할지) 방안이 필요합니다.
4. **AI 전용 시스템 계정(ADMIN id = 2)의 인증 처리**:
   * `WorldCupTemplateService.create`는 보통 컨트롤러 레벨에서 인증된 유저 세션을 바탕으로 동작합니다. 스케줄러가 백그라운드 스레드에서 돌아갈 때, Spring Security 컨텍스트나 인프라 상에서 권한 관련 예외(예: `anonymousUser` 에러)가 발생하지 않고 `creator_id = 2`를 안전하게 바인딩할 수 있는 우회 설계는 무엇일까요?

---

## 5. Claude 분석 결과 및 추가 질문 (코드 검증 후 작성)

> 아래는 `AiGenerationService`, `WorldCupTemplateService`, `WorldCupTemplate` 엔티티, 프론트 플레이 스토어(`worldcup-store.ts`), `worldcup-bracket-sizes.ts` 등을 직접 읽고 검증한 결과입니다. **4번의 기존 질문에 대한 답과, 기획서 전제를 수정해야 하는 중대한 발견을 함께 정리합니다.**

### 5.1. 🔴 [중대·해결됨] 1.3 "분할"의 진짜 의도 = 강수 분할이 아니라 **유튜브 일일 쿼터 예산을 여러 주제에 알뜰하게 분배**

**(사용자 확인 완료)** 기존 기획서 1.3은 "한 주제 100개 아이템을 64강/32강 템플릿으로 쪼갠다"로 적혀 있으나, 이는 Gemini(안티그래비티)가 의도를 오해한 것입니다. 실제 의도는 다음과 같습니다:

- 유튜브 Data API 무료 한도는 **하루 약 100회 검색**(10,000 units ÷ search.list 100 units). 아이템 1개 = 유튜브 검색 1회 소모.
- 한 주제는 자연히 아이템 수가 정해짐(예: "좋아하는 알파벳 월드컵" → 26개). 이 경우 26회만 쓰고 74회가 남음.
- **남는 쿼터로 또 다른 주제의 월드컵을 추가 생성**하여, 하루 무료 한도를 최대한 알뜰하게 소진하며 콘텐츠를 여러 개 뽑아내는 것이 목표.
- 예: 30개짜리 1개 + 60개짜리 1개 생성 → 90회 사용, 남은 10개는 (한 강수도 못 채우니) 폐기.

**따라서 1.3의 "강수 단위 분할" 알고리즘은 폐기하고, 아래 5.9의 "예산 기반 다중 주제 루프"로 대체합니다.**

데이터 모델 사실관계(설계 근거):
- `WorldCupTemplate`에는 **강수 컬럼이 없습니다.** `items`(JSON 배열)만 저장.
- 강수는 **플레이 시점에 플레이어가 선택**합니다. `worldcupSelectableBracketSizes(totalItems)`가 `totalItems` 이하의 2의 거듭제곱을 제공하고, 스토어 `initialize`가 셔플 후 N명만 대진에 넣고 나머지는 리롤 풀로 보관. → 한 템플릿에 26개를 넣으면 자동으로 [2,4,8,16] 선택지가 생기고 10개는 리롤 풀로 갑니다. **개발자가 강수를 정할 필요가 전혀 없습니다.**

### 5.2. ✅ Open Q2 답 — 2의 거듭제곱이 아닌 아이템 수는 에러를 유발하지 않음

- `store.initialize`는 `Math.min(bracketSize, length)` 후 셔플하여 **2의 거듭제곱 N명만 slice**, 나머지는 reserve로 넘깁니다. 즉 36개 아이템에 32강을 골라도 32명 출전 + 4명 리롤풀로 정상 동작합니다.
- 따라서 **남는 아이템을 엄격하게 Truncate(폐기)할 필요가 없습니다.** 아이템을 많이 넣을수록 플레이어 선택지(강수)와 리롤 다양성만 늘어납니다. → 1.3의 "남은 아이템 폐기" 규칙은 불필요.

### 5.3. ✅ Open Q1 답 — 미디어 후보 0개 아이템 처리 권장안

- `MediaSearchRouter.searchCandidates`는 모든 전략 실패 시 **빈 리스트**를 반환합니다. 이 경우 해당 아이템은 `imageUrl`이 없는 상태가 됩니다.
- 5.2에서 보듯 아이템 수가 유연하므로, **후보가 0개인 아이템은 제외(drop)하고 남은 아이템으로 진행**하는 것을 권장합니다. 더미 이미지는 UX·법적 측면에서 비권장.
- ❓ **질문 2:** drop 방식에 동의하시나요? (동의 시 별도 강수 재조정 로직 불필요 — 그냥 남은 개수로 저장하면 됨)

### 5.4. ✅ Open Q4 답 — 인증 우회 설계가 사실상 불필요

- `WorldCupTemplateService.create(request, creatorId: Long)`는 `creatorId`를 **평범한 함수 파라미터**로 받습니다. `SecurityContext`를 전혀 읽지 않습니다.
- 따라서 스케줄러는 `create(request, creatorId = 2L)`를 직접 호출하면 됩니다. `anonymousUser` 문제는 발생하지 않습니다.
- ⚠️ 단, **`users.id = 2`인 ADMIN 계정이 운영 DB에 실제 존재하는지** 보장이 필요합니다(없으면 FK/표시 문제). id를 하드코딩하기보다 설정값(`pickty.ai.auto-generator.creator-id`)으로 빼는 것을 권장.

### 5.5. 🟡 [갭] "주제(제목) 자동 생성" 기능이 현재 코드에 없음

- 기존 `AiGenerationService.autoGenerate`는 **주제가 주어졌을 때 그 주제의 아이템 목록을 생성**할 뿐입니다.
- `AiAutoGenerateRequest.existingItemNames`는 **아이템 이름 중복 방지용**이며, 기획서 1.2가 요구하는 **"기존 템플릿 제목들을 제외하고 새 주제 1개를 생성"** 하는 기능과는 다릅니다.
- 즉, 스케줄러는 Gemini를 **2단계**로 호출해야 합니다: ① 신규 주제 생성(신규 메서드 필요) → ② 그 주제로 아이템 생성(`autoGenerate` 재사용). 두 호출 모두 일일 쿼터에 카운트됩니다.
- **(사용자 확인 완료)** 주제 생성용 Gemini 메서드를 `AiGenerationService`에 신규 추가하는 것으로 합의. 제외 대상으로 최근 템플릿 제목 N개 + (당일 루프에서) 이미 생성한 주제들을 함께 주입합니다.

### 5.6. ✅ [해결됨] mediaType = **YOUTUBE 고정** — 단, 썸네일 변환 필요

**(사용자 확인 완료)** 현재 연결된 미디어 검색 API는 **유튜브뿐**입니다. 이미지(PHOTO) API는 모두 유료이거나(구글은 신규 사이트에 이미지 서치 API를 막음) 미연결이므로, 자동 생성은 `AiMediaType.YOUTUBE`로 고정합니다.

⚠️ **반드시 처리할 부수 작업 — 썸네일:**
- `WorldCupTemplateService.create()`의 `inferThumbnail`은 첫 아이템의 `imageUrl`을 그대로 썸네일로 씁니다. YOUTUBE 아이템의 `imageUrl`은 `https://www.youtube.com/watch?v=...` (watch URL)이라, 그대로 두면 **목록 썸네일이 깨집니다**(이미지로 렌더 시도).
- 스케줄러가 `create` 호출 시 `request.thumbnailUrl`에 **첫 아이템 영상의 `https://img.youtube.com/vi/{videoId}/hqdefault.jpg`** 를 직접 채워 넣어야 합니다. (프론트 `getYoutubeThumbnailUrl` 로직과 동일. 백엔드에서 watch URL → videoId 추출 후 조립.)
- 플레이 화면은 `imageUrl`이 watch URL이어도 `classifyWorldCupMediaUrl`이 youtube로 인식해 iframe으로 정상 재생하므로 추가 작업 없음.

### 5.7. 🟢 [구현 시 반영할 사소한 제약]

- **제목 길이:** `title`은 최대 100자. `"[AI생성] "` 접두사 포함 100자 이내가 되도록 잘라야 함.
- **layoutMode 필수:** `create`는 `split_lr` | `split_diagonal` 중 하나를 반드시 요구. 스케줄러가 기본값(예: `split_diagonal`) 지정 필요.
- **cron 타임존:** 기존 스케줄러들은 `zone` 미지정으로 JVM 타임존에 의존합니다. UTC 20:30을 하드코딩하기보다 `@Scheduled(cron = "0 30 5 * * *", zone = "Asia/Seoul")`로 명시하는 편이 안전합니다(서버 TZ 변경에 영향받지 않음). → 운영 서버 JVM 타임존 확인 필요.
- **트랜잭션:** `create`는 이미 메서드 단위 `@Transactional`. 외부 API 호출(주제·아이템·미디어 검색)은 트랜잭션 밖에서 끝낸 뒤 `create`만 호출하면 3번 요구사항(커넥션 풀 점유 방지)이 자연히 충족됩니다.
- **`@EnableScheduling`은 이미 활성화**되어 있고(`ServerApplication.kt`), `ViewCountBatchScheduler` 등 `@Scheduled` 컴포넌트 패턴이 이미 존재하므로 그대로 따르면 됩니다.

### 5.8. ✅ Open Q3 (실패/쿼터 알림) — 제안

- `autoGenerate`는 쿼터 소진 시 `AiQuotaExhaustedException`을 던집니다(`GenerateRequestsPerDay` 토큰 기반 판정). 스케줄러는 이를 잡아 **에러 로그만 남기고 다음 날까지 스킵**하는 것을 기본으로 제안합니다(별도 알림 채널이 현재 없으므로).
- ❓ **질문 5:** 별도 관리자 알림(예: 디스코드 웹훅/이메일)이 필요하면 채널을 알려주세요. 없으면 로그 + 스킵으로 진행합니다.

---

### 5.9. 🟢 [신규 핵심 설계] 예산 기반 다중 주제 생성 루프 (1.3 대체)

기존 코드에 **유튜브 쿼터 추적이 이미 존재**합니다:
- `AiApiUsageService.recordYouTubeSearchCall()` — 검색 1회마다 Valkey 카운터 증가. **PT(미 태평양) 자정 기준 날짜 키**(유튜브 쿼터 리셋 시점과 일치).
- `AiApiUsageService.getTodayUsagePt().youtube` — 현재 PT-day에 사용한 유튜브 검색 누적 수 조회.
- → 스케줄러는 `남은 예산 = 일일한도 − 현재까지 사용량`을 직접 계산할 수 있습니다.

**정책 확정 (사용자):**
- **자동 생성은 ADMIN 전용 기능이며 현재 일반 사용자가 없으므로, 예산을 아껴 남길 필요 없이 남은 쿼터를 전량 소진**합니다. (`DAILY_QUOTA − 오늘 사용량` 전부 사용)
- 단, **주제의 자연스러운 아이템 수를 억지로 부풀리지 않습니다.** 예: "알파벳 월드컵"은 26개가 자연스러우면 그대로 26개. 28·29개로 패딩 금지.
- **최소 아이템 수 = 16개(16강).** 한 주제가 16개 미만이거나 남은 예산이 16 미만이면 그 주제는 버리고 루프 종료.

**제안 알고리즘 (의사코드):**
```
DAILY_QUOTA = 100  // 설정값 pickty.ai.auto-generator.youtube-daily-quota, 기본 100
MIN_ITEMS   = 16

used = aiApiUsageService.getTodayUsagePt().youtube       // 그날 이미 쓴 검색 수 반영
remaining = max(0, DAILY_QUOTA - used)

while (remaining >= MIN_ITEMS) {
    // ① 주제 + 그 주제의 자연스러운 아이템 수를 함께 받음 (패딩 방지)
    (topic, naturalCount) = aiGenerationService.generateTopic(제외 = 최근제목 + 이번_루프_생성주제들)

    // ② 자연 개수와 남은 예산 중 작은 값만큼만 아이템 생성 → 억지 패딩 없음, 예산 초과 없음
    requestCount = min(naturalCount, remaining)
    if (requestCount < MIN_ITEMS) break
    items = aiGenerationService.autoGenerate(prompt=topic, mediaType=YOUTUBE, count=requestCount)

    remaining -= requestCount                            // 검색은 drop 여부와 무관하게 소모됨 → 요청 수 기준 차감
    valid = items.filter { 후보 1개 이상 존재 }          // 후보 0개 아이템 drop (5.3)
    if (valid.size < MIN_ITEMS) continue                 // 이 주제는 폐기, 다음 주제 시도

    thumbnailUrl = img.youtube.com 변환(valid[0])        // (5.6)
    worldCupTemplateService.create(
        request = (title="[AI생성] $topic", items=valid 매핑, layoutMode="split_diagonal", thumbnailUrl),
        creatorId = 2L)                                  // (5.4)
}
```

설계 메모:
- **drop된 아이템도 유튜브 검색 쿼터는 소모**합니다(검색은 했고 결과가 0이었을 뿐). 따라서 `remaining` 차감은 `valid.size`가 아니라 요청한 `requestCount`(=검색 횟수) 기준.
- `generateTopic`은 Gemini가 `{ "topic": "...", "itemCount": N }` 형태로 주제와 자연 개수를 함께 반환하도록 프롬프트 설계. (예산이 충분해도 주제 규모 이상으로 아이템을 만들지 않기 위함)
- 트랜잭션: 루프 내 외부 API(주제·아이템·검색)는 트랜잭션 밖. `create`만 메서드 단위 `@Transactional`. (요구사항 3 충족)
- 한 주제라도 만들었으면 부분 성공으로 간주, 중간 실패(쿼터 소진 `AiQuotaExhaustedException` 등)는 로그 후 루프 종료.

---

## 6. 추가 기획 사양 - 월드컵 랭킹 기반 동적 썸네일 (피쿠 스타일)

유저 플레이가 누적됨에 따라, 월드컵 템플릿 목록 화면의 카드 대표 이미지를 단순 고정이 아니라 **실시간 누적 랭킹 1, 2위 아이템의 썸네일로 동적 분할 렌더링**되게 구현합니다.

### 6.1. 데이터 저장 및 하위 호환성 설계
* **대표 썸네일 데이터 포맷 (`thumbnailUrl`)**:
  * DB 변경(마이그레이션) 부담을 없애기 위해, 기존 `worldcup_templates` 테이블의 `thumbnail_url` VARCHAR(2048) 컬럼을 그대로 사용합니다.
  * 단일 URL 대신, **콤마(`,`)로 구분된 다중 URL 포맷**을 허용하도록 변경합니다.
    * *ex)* `url1,url2` (앞에 위치한 URL이 1위, 뒤에 위치한 URL이 2위 썸네일)
  * 프론트엔드는 `thumbnailUrl`에 콤마가 포함되어 있는지 확인하여:
    * **콤마가 없음**: 기존처럼 해당 이미지를 1장 가득 채워 렌더링.
    * **콤마가 있음**: 문자열을 `split(",")`하여 **좌우 반반(50%:50%) 분할 렌더링 UI**로 스타일리시하게 처리 (피쿠 스타일).

### 6.2. 썸네일 업데이트 타이밍 및 알고리즘
* **초기 생성 시 (플레이 횟수 = 0)**:
  * 첫 생성 시점에는 랭킹 정보가 없으므로, 기본적으로 1번, 2번 아이템의 썸네일 이미지 주소를 콤마로 연결(`url1,url2`)하여 `thumbnailUrl`로 등록합니다.
* **플레이 결과 제출 시 (`submitPlayResult` 트리거)**:
  * [WorldCupStatService.submitPlayResult](file:///C:/Users/Administrator/CursorProjects/Pickty_Workspace/Pickty/backend/src/main/kotlin/com/pickty/server/domain/worldcup/service/WorldCupStatService.kt#L25) 트랜잭션이 끝나는 시점에 비동기 혹은 트랜잭션 이벤트 리스너(또는 로직 끝부분)에서 해당 월드컵의 **누적 랭킹 1, 2위 아이템**을 재계산합니다.
  * 랭킹 1, 2위 아이템의 이미지 URL을 조회하여 `url1,url2` 형태로 포맷팅한 뒤, `WorldCupTemplate` 엔티티의 `thumbnailUrl`을 갱신합니다.
  * **장점**: 이 방식을 사용하면 목록 조회 API 호출 시점에는 DB 조인 없이 단일 컬럼만 빠르게 리드할 수 있어, **성능 부하(N+1 쿼리 등)가 전혀 없는 상태로 실시간 랭킹 썸네일 변화를 구현**할 수 있습니다.

