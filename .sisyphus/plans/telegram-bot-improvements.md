# Telegram Bot Plugin 개선

## TL;DR

> **Quick Summary**: OpenCode Telegram Bot Plugin의 사용자 경험 개선 - 중복 알림 해결, 다국어 지원(한국어/영어), 알림 필터링, 상세 작업 요약, 이모지 개선, 테스트 인프라 추가

> **Deliverables**:
> - 알림 중복 제거 시스템 (dedup)
> - 다국어 지원 모듈 (ko/en)
> - 알림 타입별 on/off 설정
> - 세션 완료 시 상세 요약 (파일 목록, 변경 사항)
> - 풍부한 이모지 적용
> - Vitest 테스트 인프라

> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Vitest 설정 → i18n/dedup/config 병렬 → 통합 → 테스트

---

## Context

### Original Request
사용자가 보고한 문제점들:
1. 알림이 폭탄처럼 몰림 (여러 터미널에서 중복 알림)
2. 기본 기능이 약함
3. 영어만 지원
4. 이모지가 구림
5. 서브에이전트 알림을 끌 수 없음
6. 여러 세션 운용 시 polling 에러
7. 제목만 오고 내용이 없음

### Interview Summary
**Key Discussions**:
- **알림 내용**: 전체 요약 (파일 목록, 변경 사항, 에러 여부)
- **알림 필터링**: 서브에이전트 시작 알림 끄기
- **다국어**: 한국어 + 영어 (기본: 한국어)
- **중복 해결**: 알림 dedup (해시 기반)
- **이모지**: 풍부한 이모지 (🚀🎯📦🔧✨📝)
- **설정 방식**: 환경변수 + 향후 opencode.json 확장
- **파일 목록**: 전체 표시 (제한 없음)
- **diff 상세도**: 파일명만
- **테스트**: Vitest 추가

**Research Findings**:
- **세션 요약 데이터**: `session.updated` 이벤트에서 `Session.summary` (additions, deletions, files, diffs) 제공
- **세션 diff**: `session.diff` 이벤트에서 `Array<FileDiff>` 제공
- **플러그인 설정**: `config` 훅 존재, 환경변수 기본 방식 유지

### Metis Review
**Identified Gaps** (addressed):
- 세션 요약 데이터 가용성: SDK에서 `Session.summary` 확인 → 해결
- 설정 전달 방식: 환경변수 기본 + 향후 확장으로 결정

---

## Work Objectives

### Core Objective
텔레그램 봇 플러그인의 사용자 경험을 개선하여 알림 유용성을 높이고 중복/불필요한 알림을 제거한다.

### Concrete Deliverables
- `src/dedup.ts` - 알림 중복 제거 모듈
- `src/i18n/index.ts` - 다국어 지원 모듈
- `src/i18n/ko.ts` - 한국어 번역
- `src/i18n/en.ts` - 영어 번역
- `src/config.ts` - 설정 로더
- `vitest.config.ts` - 테스트 설정
- 수정된 `src/telegram.ts`, `src/router.ts`, `src/index.ts`

### Definition of Done
- [ ] `npm run typecheck` → 0 errors
- [ ] `npm run build` → success
- [ ] `npm test` → all tests pass
- [ ] 중복 알림 발생하지 않음 (동일 메시지 5분 내 1회만)
- [ ] 한국어/영어 알림 정상 동작
- [ ] 서브에이전트 알림 끄기 가능

### Must Have
- 파일 기반 dedup (TTL: 5분)
- 한국어/영어 지원 (기본: 한국어)
- 환경변수로 알림 타입 on/off
- 세션 완료 시 파일 목록 표시

### Must NOT Have (Guardrails)
- 외부 i18n 서비스 또는 번역 API
- 데이터베이스 사용 (파일 기반 유지)
- 실시간 설정 핫 리로드
- 메시지 재시도/큐 시스템
- 새로운 OpenCode SDK 이벤트 리스너 (기존 것만 사용)
- Telegram API 통합 테스트
- 설정 UI 또는 대화형 설정

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO
- **Automated tests**: YES (TDD)
- **Framework**: Vitest
- **TDD**: 각 모듈 RED → GREEN → REFACTOR

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Unit Tests**: Vitest로 핵심 로직 검증
- **Build Verification**: `npm run typecheck` + `npm run build`
- **Integration**: 모듈 간 연동 검증

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — Foundation):
├── Task 1: Vitest 설정 + 테스트 인프라 [quick]
├── Task 2: i18n 모듈 (한국어/영어) [quick]
├── Task 3: dedup 모듈 [quick]
└── Task 4: config 모듈 [quick]

Wave 2 (After Wave 1 — Integration):
├── Task 5: telegram.ts에 i18n 적용 + 이모지 개선 [visual-engineering]
├── Task 6: telegram.ts에 dedup 적용 [unspecified-high]
├── Task 7: router.ts에 세션 요약 추가 [deep]
└── Task 8: router.ts에 알림 필터링 추가 [quick]

Wave 3 (After Wave 2 — Final):
├── Task 9: 통합 테스트 [unspecified-high]
└── Task 10: README 업데이트 [writing]

Wave FINAL (After ALL tasks — 4 parallel reviews):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
```

### Dependency Matrix

- **1-4**: — — 5-8
- **5**: 2 — 9
- **6**: 3 — 9
- **7**: 4 — 9
- **8**: 4 — 9
- **9**: 5, 6, 7, 8 — 10
- **10**: 9 — F1-F4

### Agent Dispatch Summary

- **Wave 1**: **4** — T1 → `quick`, T2 → `quick`, T3 → `quick`, T4 → `quick`
- **Wave 2**: **4** — T5 → `visual-engineering`, T6 → `unspecified-high`, T7 → `deep`, T8 → `quick`
- **Wave 3**: **2** — T9 → `unspecified-high`, T10 → `writing`
- **FINAL**: **4** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. Vitest 설정 + 테스트 인프라 구축

  **What to do**:
  - `vitest.config.ts` 생성
  - `package.json`에 test 스크립트 추가
  - vitest 및 @vitest/coverage-v8 설치
  - `src/__tests__/setup.test.ts` 생성하여 동작 확인

  **Must NOT do**:
  - E2E 테스트 설정 (단위 테스트만)
  - 실제 Telegram API 호출 테스트

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 설정 파일 생성 및 패키지 설치는 간단한 작업
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4)
  - **Blocks**: Tasks 5-8 (테스트 필요)
  - **Blocked By**: None

  **References**:
  - `package.json:17-21` - 기존 스크립트 구조
  - `tsconfig.json` - TypeScript 설정 (ESM, target)

  **Acceptance Criteria**:
  - [ ] `npm test` 실행 → 1 pass, 0 fail
  - [ ] `vitest.config.ts` 파일 존재
  - [ ] package.json에 `"test": "vitest"` 스크립트 존재

  **QA Scenarios**:
  ```
  Scenario: Vitest 동작 확인
    Tool: Bash
    Steps:
      1. cd /home/ubuntu/app/jupyterLab/notebooks/opencode-telegram-bot-plugin
      2. npm test
    Expected Result: "1 passed" 메시지 출력
    Evidence: .sisyphus/evidence/task-1-vitest-setup.txt
  ```

  **Commit**: YES
  - Message: `chore: add vitest configuration and test infrastructure`
  - Files: `vitest.config.ts`, `package.json`, `src/__tests__/setup.test.ts`

- [x] 2. i18n 모듈 구현 (한국어/영어)

  **What to do**:
  - `src/i18n/index.ts` 생성 (i18n 코어 로직)
  - `src/i18n/ko.ts` 생성 (한국어 번역)
  - `src/i18n/en.ts` 생성 (영어 번역)
  - 모든 알림 메시지 키 정의
  - 언어 설정에 따른 메시지 반환 함수 구현

  **Must NOT do**:
  - 외부 i18n 라이브러리 사용 (직접 구현)
  - 번역 API 호출
  - 실시간 언어 전환

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단순한 키-값 매핑 구조
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4)
  - **Blocks**: Task 5 (i18n 적용)
  - **Blocked By**: None

  **References**:
  - `src/telegram.ts:213-219` - 현재 하드코딩된 메시지 패턴
  - `src/telegram.ts:228-250` - Permission Request 메시지
  - `src/telegram.ts:253-263` - Todos Complete 메시지
  - `src/telegram.ts:266-279` - Subtask Started 메시지
  - `src/telegram.ts:282-290` - Error 메시지

  **Acceptance Criteria**:
  - [ ] `src/i18n/index.ts` 존재
  - [ ] `src/i18n/ko.ts`, `src/i18n/en.ts` 존재
  - [ ] `npm test src/__tests__/i18n.test.ts` → PASS
  - [ ] `t('session.idle.title', 'ko')` → "작업 완료"
  - [ ] `t('session.idle.title', 'en')` → "Task Complete"

  **QA Scenarios**:
  ```
  Scenario: 한국어 메시지 반환
    Tool: Bash (node REPL)
    Steps:
      1. node -e "import('./dist/i18n/index.js').then(m => console.log(m.t('session.idle.title', 'ko')))"
    Expected Result: "작업 완료" 출력
    Evidence: .sisyphus/evidence/task-2-i18n-ko.txt

  Scenario: 영어 메시지 반환
    Tool: Bash (node REPL)
    Steps:
      1. node -e "import('./dist/i18n/index.js').then(m => console.log(m.t('session.idle.title', 'en')))"
    Expected Result: "Task Complete" 출력
    Evidence: .sisyphus/evidence/task-2-i18n-en.txt

  Scenario: 잘못된 언어 코드 → 기본값(한국어)
    Tool: Bash (node REPL)
    Steps:
      1. node -e "import('./dist/i18n/index.js').then(m => console.log(m.t('session.idle.title', 'invalid')))"
    Expected Result: "작업 완료" 출력 (fallback)
    Evidence: .sisyphus/evidence/task-2-i18n-fallback.txt
  ```

  **Commit**: YES
  - Message: `feat(i18n): add internationalization module with ko/en support`
  - Files: `src/i18n/index.ts`, `src/i18n/ko.ts`, `src/i18n/en.ts`, `src/__tests__/i18n.test.ts`

- [x] 3. dedup 모듈 구현

  **What to do**:
  - `src/dedup.ts` 생성
  - 메시지 해시 생성 함수 (SHA-256)
  - 해시 저장/조회 함수 (파일 기반)
  - TTL 만료 체크 (기본 5분)
  - graceful degradation (파일 오류 시 알림은 전송)

  **Must NOT do**:
  - 데이터베이스 사용
  - 외부 라이브러리 추가 (Node.js crypto 사용)
  - 복잡한 락 메커니즘

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 간단한 파일 I/O + 해시 로직
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4)
  - **Blocks**: Task 6 (dedup 적용)
  - **Blocked By**: None

  **References**:
  - `src/telegram.ts:7` - 기존 LOCK_PATH 패턴 참고
  - `src/telegram.ts:293-304` - sendMessage 함수 (dedup 적용 위치)

  **Acceptance Criteria**:
  - [ ] `src/dedup.ts` 존재
  - [ ] `npm test src/__tests__/dedup.test.ts` → PASS
  - [ ] 동일 메시지 5분 내 중복 전송 방지
  - [ ] 5분 경과 후 동일 메시지 전송 허용
  - [ ] 파일 손상 시 알림 전송 계속 (graceful)

  **QA Scenarios**:
  ```
  Scenario: 중복 메시지 차단
    Tool: Bash (node REPL)
    Steps:
      1. node -e "import('./dist/dedup.js').then(m => m.checkAndStore('test-msg', 300000).then(r => console.log(r)))"
      2. node -e "import('./dist/dedup.js').then(m => m.checkAndStore('test-msg', 300000).then(r => console.log(r)))"
    Expected Result: 첫 번째 true, 두 번째 false
    Evidence: .sisyphus/evidence/task-3-dedup-block.txt

  Scenario: TTL 만료 후 전송 허용
    Tool: Bash (node REPL)
    Steps:
      1. node -e "import('./dist/dedup.js').then(m => m.checkAndStore('test-msg', 1).then(r => console.log(r)))"
      2. sleep 2
      3. node -e "import('./dist/dedup.js').then(m => m.checkAndStore('test-msg', 1).then(r => console.log(r)))"
    Expected Result: 두 번 모두 true
    Evidence: .sisyphus/evidence/task-3-dedup-ttl.txt

  Scenario: 파일 손상 시 graceful degradation
    Tool: Bash
    Steps:
      1. rm -f /tmp/opencode-telegram-dedup.json
      2. echo "invalid json" > /tmp/opencode-telegram-dedup.json
      3. node -e "import('./dist/dedup.js').then(m => m.checkAndStore('test-msg', 300000).then(r => console.log(r)))"
    Expected Result: true (파일 무시하고 전송 허용)
    Evidence: .sisyphus/evidence/task-3-dedup-graceful.txt
  ```

  **Commit**: YES
  - Message: `feat(dedup): add notification deduplication with file-based storage`
  - Files: `src/dedup.ts`, `src/__tests__/dedup.test.ts`

- [x] 4. config 모듈 구현

  **What to do**:
  - `src/config.ts` 생성
  - 환경변수 기반 설정 로더
  - 기본값 정의 (language: 'ko', notifications: all enabled, dedup: enabled)
  - 설정 검증 (유효하지 않은 값 → 기본값)
  - TypeScript 타입 정의

  **Must NOT do**:
  - 복잡한 설정 파일 파싱
  - 실시간 설정 리로드
  - 설정 UI

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 환경변수 읽기 + 기본값 설정
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3)
  - **Blocks**: Tasks 5, 7, 8 (설정 사용)
  - **Blocked By**: None

  **References**:
  - `src/index.ts:20-21` - 기존 환경변수 패턴

  **Acceptance Criteria**:
  - [ ] `src/config.ts` 존재
  - [ ] `npm test src/__tests__/config.test.ts` → PASS
  - [ ] `getConfig().language` → 'ko' (기본값)
  - [ ] `TELEGRAM_LANGUAGE=en` 설정 시 → 'en'
  - [ ] `TELEGRAM_NOTIFY_SUBTASK=false` 설정 시 → false

  **QA Scenarios**:
  ```
  Scenario: 기본 설정값
    Tool: Bash (node REPL)
    Steps:
      1. node -e "import('./dist/config.js').then(m => console.log(JSON.stringify(m.getConfig())))"
    Expected Result: {"language":"ko","notifications":{...},"dedup":{...}}
    Evidence: .sisyphus/evidence/task-4-config-default.txt

  Scenario: 환경변수 오버라이드
    Tool: Bash (node REPL)
    Steps:
      1. TELEGRAM_LANGUAGE=en node -e "import('./dist/config.js').then(m => console.log(m.getConfig().language))"
    Expected Result: "en"
    Evidence: .sisyphus/evidence/task-4-config-override.txt

  Scenario: 잘못된 값 → 기본값
    Tool: Bash (node REPL)
    Steps:
      1. TELEGRAM_LANGUAGE=invalid node -e "import('./dist/config.js').then(m => console.log(m.getConfig().language))"
    Expected Result: "ko" (fallback)
    Evidence: .sisyphus/evidence/task-4-config-invalid.txt
  ```

  **Commit**: YES
  - Message: `feat(config): add plugin configuration loader`
  - Files: `src/config.ts`, `src/__tests__/config.test.ts`, `src/types.ts` (확장)

- [x] 5. telegram.ts에 i18n 적용 + 이모지 개선

  **What to do**:
  - 기존 하드코딩 메시지를 i18n 호출로 변경
  - 풍부한 이모지 적용 (🚀🎯📦🔧✨📝⚡🔥💡📌)
  - 메시지 포맷 개선 (가독성 향상)
  - config에서 언어 설정 읽기

  **Must NOT do**:
  - 이모지 과다 사용 (필요한 곳에만)
  - 메시지 구조 크게 변경 (기존 패턴 유지)
  - 외부 이모지 라이브러리 사용

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: 사용자 경험 개선, 시각적 요소 다룸
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 8)
  - **Blocks**: Task 9 (통합 테스트)
  - **Blocked By**: Task 2 (i18n 모듈)

  **References**:
  - `src/telegram.ts:213-290` - 모든 메시지 함수
  - `src/i18n/ko.ts` - 한국어 키
  - `src/i18n/en.ts` - 영어 키

  **Acceptance Criteria**:
  - [ ] 모든 메시지 함수가 i18n 사용
  - [ ] 풍부한 이모지 적용됨
  - [ ] `npm run typecheck` → 0 errors
  - [ ] `npm run build` → success

  **QA Scenarios**:
  ```
  Scenario: 한국어 알림 메시지
    Tool: Bash (node REPL)
    Steps:
      1. TELEGRAM_LANGUAGE=ko npm run build
      2. node -e "import('./dist/telegram.js').then(m => console.log(new m.TelegramBridge({botToken:'x',chatId:'y'}).formatSessionIdle('테스트 세션')))"
    Expected Result: "🚀 작업 완료" 포함
    Evidence: .sisyphus/evidence/task-5-i18n-ko-msg.txt

  Scenario: 영어 알림 메시지
    Tool: Bash (node REPL)
    Steps:
      1. TELEGRAM_LANGUAGE=en npm run build
      2. node -e "import('./dist/telegram.js').then(m => console.log(new m.TelegramBridge({botToken:'x',chatId:'y'}).formatSessionIdle('Test Session')))"
    Expected Result: "🚀 Task Complete" 포함
    Evidence: .sisyphus/evidence/task-5-i18n-en-msg.txt
  ```

  **Commit**: NO (Task 6과 함께 커밋)

- [x] 6. telegram.ts에 dedup 적용

  **What to do**:
  - sendMessage 함수에 dedup 체크 추가
  - config에서 dedup 활성화 여부 확인
  - 중복 메시지 전송 방지

  **Must NOT do**:
  - 모든 메시지에 dedup 적용 (Permission Request는 제외)
  - dedup 실패 시 알림 차단

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 기존 코드 수정, 로직 통합
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 7, 8)
  - **Blocks**: Task 9 (통합 테스트)
  - **Blocked By**: Task 3 (dedup 모듈)

  **References**:
  - `src/telegram.ts:293-304` - sendMessage 함수
  - `src/dedup.ts` - dedup 모듈

  **Acceptance Criteria**:
  - [ ] sendMessage 호출 전 dedup 체크
  - [ ] 중복 메시지는 전송되지 않음
  - [ ] Permission Request는 dedup 제외
  - [ ] `npm run typecheck` → 0 errors

  **QA Scenarios**:
  ```
  Scenario: 중복 알림 차단
    Tool: Bash (node REPL)
    Steps:
      1. rm -f /tmp/opencode-telegram-dedup.json
      2. TELEGRAM_DEDUP_ENABLED=true node -e "import('./dist/telegram.js').then(...)sendSessionIdle twice"
    Expected Result: 두 번째 호출은 dedup에 의해 스킵
    Evidence: .sisyphus/evidence/task-6-dedup-integration.txt

  Scenario: dedup 비활성화 시 모든 알림 전송
    Tool: Bash (node REPL)
    Steps:
      1. TELEGRAM_DEDUP_ENABLED=false node -e "..."
    Expected Result: 모든 알림 전송됨
    Evidence: .sisyphus/evidence/task-6-dedup-disabled.txt
  ```

  **Commit**: YES (Task 5 포함)
  - Message: `feat(notifications): integrate i18n, filtering, dedup, and rich emojis`
  - Files: `src/telegram.ts`

- [x] 7. router.ts에 세션 요약 추가

  **What to do**:
  - `session.updated` 이벤트 핸들러 수정
  - 세션 summary 데이터 (files, additions, deletions) 저장
  - `session.diff` 이벤트 핸들러 추가 (선택적)
  - `handleSessionIdle`에서 저장된 요약 데이터 사용
  - 파일 목록 표시 (전체, 제한 없음)

  **Must NOT do**:
  - diff 내용 포함 (파일명만)
  - 새로운 SDK 이벤트 생성
  - 데이터베이스 사용

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 이벤트 핸들링 로직, 상태 관리
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 8)
  - **Blocks**: Task 9 (통합 테스트)
  - **Blocked By**: Task 4 (config 모듈)

  **References**:
  - `src/router.ts:46-52` - 기존 session.updated 핸들러
  - `src/router.ts:96-104` - handleSessionIdle (수정 대상)
  - `node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts` - Session, FileDiff 타입

  **Acceptance Criteria**:
  - [ ] session.updated에서 summary 저장
  - [ ] handleSessionIdle에서 파일 목록 포함
  - [ ] `npm run typecheck` → 0 errors
  - [ ] 세션 완료 알림에 파일 목록 표시

  **QA Scenarios**:
  ```
  Scenario: 세션 요약 데이터 저장
    Tool: Bash (node REPL)
    Steps:
      1. router.handleEvent({type: 'session.updated', properties: {info: {id:'test', summary:{files:3, additions:10, deletions:5}}}})
      2. router.getSessionSummary('test')
    Expected Result: {files:3, additions:10, deletions:5}
    Evidence: .sisyphus/evidence/task-7-summary-save.txt

  Scenario: 세션 완료 알림에 파일 목록
    Tool: Bash (node REPL)
    Steps:
      1. summary 저장 후 handleSessionIdle 호출
      2. telegram.sendSessionIdle 호출 확인
    Expected Result: 파일 목록이 메시지에 포함됨
    Evidence: .sisyphus/evidence/task-7-summary-display.txt
  ```

  **Commit**: YES
  - Message: `feat(summary): enhance session idle message with file list and stats`
  - Files: `src/router.ts`, `src/telegram.ts`

- [x] 8. router.ts에 알림 필터링 추가

  **What to do**:
  - config에서 알림 타입별 활성화 여부 확인
  - `handleMessagePartUpdated`에서 subtask 알림 필터링
  - `handleTodoUpdated`에서 todo 알림 필터링
  - `handleSessionError`에서 error 알림 필터링
  - 기본값: 모든 알림 활성화

  **Must NOT do**:
  - Permission Request 필터링 (항상 전송)
  - 복잡한 필터링 로직
  - 설정 없이 알림 차단

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단순 조건문 추가
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 7)
  - **Blocks**: Task 9 (통합 테스트)
  - **Blocked By**: Task 4 (config 모듈)

  **References**:
  - `src/router.ts:139-156` - handleMessagePartUpdated (subtask)
  - `src/router.ts:116-137` - handleTodoUpdated
  - `src/router.ts:158-176` - handleSessionError

  **Acceptance Criteria**:
  - [ ] TELEGRAM_NOTIFY_SUBTASK=false → 서브에이전트 알림 안 옴
  - [ ] TELEGRAM_NOTIFY_TODO=false → todo 완료 알림 안 옴
  - [ ] TELEGRAM_NOTIFY_ERROR=false → 에러 알림 안 옴
  - [ ] Permission Request는 항상 전송

  **QA Scenarios**:
  ```
  Scenario: 서브에이전트 알림 비활성화
    Tool: Bash (node REPL)
    Steps:
      1. TELEGRAM_NOTIFY_SUBTASK=false
      2. router.handleEvent({type: 'message.part.updated', properties: {part: {type: 'subtask', ...}}})
    Expected Result: telegram.sendSubtaskStarted 호출되지 않음
    Evidence: .sisyphus/evidence/task-8-filter-subtask.txt

  Scenario: 모든 알림 활성화 (기본값)
    Tool: Bash (node REPL)
    Steps:
      1. 환경변수 없이
      2. 모든 이벤트 핸들러 호출
    Expected Result: 모든 알림 전송됨
    Evidence: .sisyphus/evidence/task-8-filter-default.txt
  ```

  **Commit**: NO (Task 7과 함께 커밋)

- [x] 9. 통합 테스트

  **What to do**:
  - 모든 모듈 통합 동작 확인
  - `npm run typecheck` 실행
  - `npm run build` 실행
  - `npm test` 실행
  - 크로스 모듈 시나리오 테스트

  **Must NOT do**:
  - 실제 Telegram API 호출
  - E2E 테스트 작성

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 통합 검증, 버그 수정
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (after Wave 2)
  - **Blocks**: Task 10
  - **Blocked By**: Tasks 5, 6, 7, 8

  **References**:
  - All source files

  **Acceptance Criteria**:
  - [ ] `npm run typecheck` → 0 errors
  - [ ] `npm run build` → success
  - [ ] `npm test` → all pass
  - [ ] 모든 QA 시나리오 통과

  **QA Scenarios**:
  ```
  Scenario: 전체 빌드 성공
    Tool: Bash
    Steps:
      1. npm run typecheck
      2. npm run build
      3. npm test
    Expected Result: 모든 명령 exit code 0
    Evidence: .sisyphus/evidence/task-9-build-success.txt

  Scenario: i18n + dedup + filtering 통합
    Tool: Bash (node REPL)
    Steps:
      1. TELEGRAM_LANGUAGE=ko TELEGRAM_DEDUP_ENABLED=true TELEGRAM_NOTIFY_SUBTASK=false
      2. 모든 이벤트 핸들러 호출
      3. 중복 알림 없음, 서브에이전트 알림 없음, 한국어 메시지 확인
    Expected Result: 설정대로 동작
    Evidence: .sisyphus/evidence/task-9-integration.txt
  ```

  **Commit**: NO (이전 커밋들에 포함)

- [x] 10. README 업데이트

  **What to do**:
  - 새로운 환경변수 문서화
  - 다국어 지원 설명
  - 알림 필터링 설정 설명
  - dedup 기능 설명
  - 사용 예시 추가

  **Must NOT do**:
  - 과도한 문서화
  - 불필요한 섹션 추가

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: 문서 작성
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (after Task 9)
  - **Blocks**: Final Verification
  - **Blocked By**: Task 9

  **References**:
  - `README.md` - 기존 문서
  - `src/config.ts` - 설정 옵션

  **Acceptance Criteria**:
  - [ ] 모든 환경변수 설명됨
  - [ ] 다국어 설정 예시 포함
  - [ ] 알림 필터링 설정 예시 포함

  **QA Scenarios**:
  ```
  Scenario: README 완결성
    Tool: Bash
    Steps:
      1. grep "TELEGRAM_LANGUAGE" README.md
      2. grep "TELEGRAM_NOTIFY_" README.md
      3. grep "TELEGRAM_DEDUP_" README.md
    Expected Result: 모든 검색 결과 존재
    Evidence: .sisyphus/evidence/task-10-readme.txt
  ```

  **Commit**: YES
  - Message: `docs: update README with new features and configuration`
  - Files: `README.md`

---

## Final Verification Wave (MANDATORY)

> 4 review agents run in PARALLEL. ALL must APPROVE.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists. For each "Must NOT Have": search codebase for forbidden patterns. Check evidence files exist.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `npm run typecheck` + `npm run build` + `npm test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, unused imports. Check AI slop patterns.
  Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high`
  Execute EVERY QA scenario from EVERY task. Test cross-task integration. Test edge cases.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1 — everything in spec was built, nothing beyond spec. Check "Must NOT do" compliance.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | VERDICT`

---

## Commit Strategy

- **1**: `chore: add vitest configuration and test infrastructure`
- **2**: `feat(i18n): add internationalization module with ko/en support`
- **3**: `feat(dedup): add notification deduplication with file-based storage`
- **4**: `feat(config): add plugin configuration loader`
- **5**: `feat(notifications): integrate i18n, filtering, and rich emojis`
- **6**: `feat(summary): enhance session idle message with file list`

---

## Success Criteria

### Verification Commands
```bash
npm run typecheck  # Expected: 0 errors
npm run build      # Expected: success
npm test           # Expected: all tests pass
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] 중복 알림 해결
- [ ] 다국어 지원 동작
- [ ] 알림 필터링 동작
