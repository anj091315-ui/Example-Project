# 원장님 MVP 수용 기준 체크리스트

`docs/PRD.md`의 10장에 정의된 원장님 MVP 수용 기준을 추적합니다. 체크 항목은 실제 구현과 검증을 확인한 뒤 갱신합니다.

## 10.1 완료 판정 원칙

- [ ] 모든 P0 수용 테스트가 통과해야 한다.
- [ ] P1 실패는 알려진 이슈로 기록하고 제품 책임자가 출시 허용 여부를 결정한다.
- [ ] UI에서 버튼을 숨긴 것만으로 권한 테스트를 통과한 것으로 보지 않는다. 직접 API 호출과 RLS 검사까지 포함한다.
- [ ] 정상 흐름뿐 아니라 동시성, 중복 제출, 상태 충돌, 권한 우회 시도를 검증한다.
- [ ] 테스트 DB는 운영 DB와 분리하고 매 테스트가 독립적으로 재실행 가능해야 한다.

## 10.2 표준 테스트 계정·데이터

검증 시 사용할 표준 계정과 데이터입니다.

| 코드 | 데이터 |
|---|---|
| U-A | 교습소 회원, 프로필 완료 |
| U-B | 공부방 회원, 프로필 완료 |
| U-C | 교습소 회원, 프로필 완료 |
| U-D | 공부방 회원, 프로필 미완료 |
| ADM-1 | 관리자 |
| ADM-2 | 관리자 |
| R-S1 | U-A 소유 단일 정원 1 open 요청 |
| R-M2 | U-A 소유 복수 정원 2 open 요청 |
| R-M3 | U-B 소유 복수 정원 3 open 요청 |

## 10.3 인증·프로필

- [ ] **AC-AUTH-01** Given 가입되지 않은 이메일; When 유효한 비밀번호로 가입; Then Auth 사용자와 member 역할이 생성되고 관리자 역할은 없다
- [ ] **AC-AUTH-02** Given 일반 회원 U-A; When role=admin을 포함한 클라이언트 요청; Then 관리자 역할이 생성·변경되지 않고 403/정책 거부
- [ ] **AC-AUTH-03** Given 로그아웃한 사용자; When /me/requests 직접 접근; Then 로그인으로 이동하고 업무 데이터는 반환되지 않는다
- [ ] **AC-AUTH-04** Given 프로필 미완료 U-D; When 요청 게시 RPC 호출; Then PROFILE_REQUIRED이고 요청이 생성·게시되지 않는다
- [ ] **AC-PRO-01** Given 프로필 완료 U-A; When 자신의 프로필 수정; Then 허용 필드만 변경되고 updated_at이 갱신된다
- [ ] **AC-PRO-02** Given U-A; When U-B 프로필 UPDATE 직접 호출; Then 0행 또는 403이며 U-B 데이터는 변하지 않는다
- [ ] **AC-PRO-03** Given 회원 프로필; When 공개 카드 조회; Then 인증 이메일과 상세 연락처가 응답에 없다

## 10.4 요청 생성·게시·마감

- [ ] **AC-REQ-01** Given 프로필 완료 U-A; When single, capacity=1 요청 게시; Then status=open, accepted_slots=0, published_at 기록
- [ ] **AC-REQ-02** Given 프로필 완료 U-A; When single, capacity=2 게시 시도; Then INVALID_CAPACITY, 게시되지 않음
- [ ] **AC-REQ-03** Given 프로필 완료 U-A; When multi, capacity=1 또는 4 게시 시도; Then INVALID_CAPACITY, 게시되지 않음
- [ ] **AC-REQ-04** Given 프로필 완료 U-A; When multi, capacity=2와 3을 각각 게시; Then 둘 다 성공
- [ ] **AC-REQ-05** Given 초안 요청; When 필수값 일부 누락 상태로 초안 저장; Then 공개 목록에는 없고 소유자 내 초안에만 표시
- [ ] **AC-REQ-06** Given 지원 0건 open 요청; When 소유자가 설명 수정; Then 성공하고 수정 내용 표시
- [ ] **AC-REQ-07** Given 지원 1건 이상 open 요청; When 소유자가 capacity 또는 핵심 조건 수정; Then INVALID_STATE_TRANSITION이며 기존 값 유지
- [ ] **AC-REQ-08** Given open 요청과 미결정 지원; When 소유자가 수동 마감; Then 요청 closed_manual, 미결정 지원 closed_by_owner, 새 지원 차단
- [ ] **AC-REQ-09** Given closed_manual 요청; When 소유자가 재오픈 API 시도; Then INVALID_STATE_TRANSITION
- [ ] **AC-REQ-10** Given 마감 요청; When 복제; Then 새 draft ID, accepted_slots=0, 원 요청 상태 불변

## 10.5 지원·관리자 검토

- [ ] **AC-APP-01** Given U-B와 U-A의 R-S1; When U-B가 유효한 메시지로 지원; Then submitted 지원 1개와 상태 이력 생성
- [ ] **AC-APP-02** Given U-A의 R-S1; When U-A가 자기 요청에 지원; Then SELF_APPLICATION_NOT_ALLOWED
- [ ] **AC-APP-03** Given U-B가 R-S1에 이미 지원; When 다시 지원; Then DUPLICATE_APPLICATION이며 행은 1개
- [ ] **AC-APP-04** Given closed_full 요청; When U-C가 지원; Then REQUEST_NOT_OPEN
- [ ] **AC-APP-05** Given 30자 미만 또는 1500자 초과 메시지; When 지원 제출; Then 422와 필드 오류
- [ ] **AC-APP-06** Given submitted 지원; When 요청 원장 U-A가 지원 목록 조회; Then 해당 지원은 반환되지 않는다
- [ ] **AC-ADM-01** Given submitted 지원과 ADM-1; When 승인 + 내부 사유; Then admin_approved, admin_id와 reviewed_at 기록
- [ ] **AC-ADM-02** Given submitted 지원과 ADM-1; When 거절 + 내부 사유; Then admin_rejected, 요청 원장에게 노출되지 않음
- [ ] **AC-ADM-03** Given submitted 지원; When 내부 사유 없이 관리자 결정; Then 422, 상태 유지
- [ ] **AC-ADM-04** Given admin_approved 지원; When ADM-2가 다시 결정; Then APPLICATION_NOT_REVIEWABLE, 최초 감사 기록 유지
- [ ] **AC-ADM-05** Given 일반 회원 U-C; When 관리자 검토 RPC 직접 호출; Then FORBIDDEN
- [ ] **AC-APP-07** Given submitted 지원; When 지원자가 철회; Then withdrawn, 관리자 대기열에서 제거
- [ ] **AC-APP-08** Given admin_approved 지원; When 지원자가 철회; Then withdrawn, 원장 결정 대기열에서 제거
- [ ] **AC-APP-09** Given owner_accepted 지원; When 지원자가 철회; Then INVALID_STATE_TRANSITION

## 10.6 요청 원장 결정과 정원

- [ ] **AC-DEC-01** Given U-A 요청의 admin_approved 지원; When U-A가 수락; Then owner_accepted, accepted_slots +1, match·followup 각 1개
- [ ] **AC-DEC-02** Given U-A 요청의 submitted 지원; When U-A가 수락 RPC 호출; Then APPLICATION_NOT_DECIDABLE
- [ ] **AC-DEC-03** Given U-A 요청의 admin_approved 지원; When 다른 회원 U-C가 수락; Then FORBIDDEN
- [ ] **AC-DEC-04** Given admin_approved 지원; When U-A가 거절; Then owner_rejected, accepted_slots 변화 없음
- [ ] **AC-DEC-05** Given 같은 수락 요청과 같은 client_request_id; When 네트워크 재시도로 2회 전송; Then 지원·매칭·후속 건은 각각 1개
- [ ] **AC-CAP-01** Given R-S1 accepted_slots=0; When 승인 지원 1명 수락; Then accepted_slots=1, closed_full
- [ ] **AC-CAP-02** Given R-M3 accepted_slots=0; When 승인 지원 1명 수락; Then accepted_slots=1, open
- [ ] **AC-CAP-03** Given R-M3 accepted_slots=2 및 승인 지원 1명과 대기 지원 2명; When 마지막 1명 수락; Then accepted_slots=3, closed_full, 다른 2명 closed_capacity
- [ ] **AC-CAP-04** Given R-M2 accepted_slots=1, 승인 지원 B·C; When B와 C를 병렬 수락; Then 정확히 1건만 성공, accepted_slots=2, match 총 2개 이하
- [ ] **AC-CAP-05** Given closed_full 요청; When 이전 admin_approved 지원 수락 재시도; Then MATCH_CAPACITY_REACHED 또는 종료 상태, 새 match 없음
- [ ] **AC-CAP-06** Given closed_full 요청의 active match; When match canceled 처리; Then 요청은 closed_full, accepted_slots 불변
- [ ] **AC-CAP-07** Given closed_full 요청; When 신규 지원 UI·RPC 확인; Then 버튼 없음, RPC는 REQUEST_NOT_OPEN

## 10.7 매칭·후속 업무

- [ ] **AC-MAT-01** Given owner_accepted application; When DB 조회; Then application당 match 1개, match당 followup_case 1개
- [ ] **AC-MAT-02** Given 같은 요청에서 B·C 수락; When B 매칭에 메모 추가; Then C 매칭의 followup·timeline은 변하지 않는다
- [ ] **AC-MAT-03** Given U-A–U-B 매칭; When 무관한 U-C가 상세 조회; Then 데이터 0행 또는 FORBIDDEN
- [ ] **AC-FUP-01** Given active 매칭과 요청 원장; When 단계를 in_progress로 변경; Then case 상태와 상태 변경 이벤트 기록
- [ ] **AC-FUP-02** Given active 매칭과 지원자; When 단계 변경 직접 호출; Then MVP 기본 권한에서 FORBIDDEN
- [ ] **AC-FUP-03** Given active 매칭 참여자; When 활동 메모 추가; Then 해당 case 타임라인에 1회 표시
- [ ] **AC-FUP-04** Given 동일 메모 client_request_id 재전송; When 두 번 호출; Then 메모 1개만 저장
- [ ] **AC-MAT-04** Given active 매칭; When 요청 원장이 completed 확정; Then match completed, ended_at 기록, 요청 상태 불변
- [ ] **AC-MAT-05** Given completed 매칭; When 다시 active로 변경 시도; Then INVALID_STATE_TRANSITION
- [ ] **AC-CON-01** Given active 매칭의 U-B; When messenger 연락 수단 공유; Then U-A와 U-B만 조회 가능
- [ ] **AC-CON-02** Given 무관한 U-C; When 연락 수단 테이블 SELECT; Then 0행
- [ ] **AC-CON-03** Given U-B가 공유 철회; When U-A가 새로 조회; Then 철회된 값이 표시되지 않음
- [ ] **AC-CON-04** Given 로그인 응답과 공개 프로필; When 데이터 검사; Then Auth 이메일이 상대 연락처로 자동 복제되지 않음

## 10.8 권한·보안

- [ ] **AC-SEC-01** Given 비회원 anon 키; When applications SELECT; Then 데이터 0행
- [ ] **AC-SEC-02** Given U-A; When 다른 원장의 submitted 지원 ID 직접 조회; Then 데이터 0행
- [ ] **AC-SEC-03** Given U-A; When 다른 원장의 요청 UPDATE; Then 0행 또는 FORBIDDEN
- [ ] **AC-SEC-04** Given U-B; When 자신의 application status를 owner_accepted로 직접 UPDATE; Then 정책 거부
- [ ] **AC-SEC-05** Given ADM-1; When request owner를 대신해 owner accept 직접 시도; Then FORBIDDEN
- [ ] **AC-SEC-06** Given U-A; When accepted_slots 직접 UPDATE; Then 정책 거부
- [ ] **AC-SEC-07** Given API 오류 발생; When 클라이언트 응답 검사; Then SQL, 스택, service key, 내부 사유 없음
- [ ] **AC-SEC-08** Given 관리자 내부 사유가 있는 지원; When 지원자·요청 원장 API 조회; Then 내부 사유 필드가 응답에 없음
- [ ] **AC-SEC-09** Given 브라우저 빌드 산출물; When 문자열·환경변수 검사; Then service_role secret 없음
- [ ] **AC-SEC-10** Given SECURITY DEFINER 함수; When 정의 검사; Then 고정 search_path와 최소 GRANT 적용

## 10.9 UI·반응형·접근성

- [ ] **AC-UI-01** 360px 너비에서 요청 탐색, 상세, 지원, 내 지원, 매칭 상세의 주요 행동이 가로 스크롤 없이 가능하다.
- [ ] **AC-UI-02** 768px와 1280px에서 레이아웃이 깨지지 않고 정보 계층이 유지된다.
- [ ] **AC-UI-03** 키보드만으로 로그인, 요청 작성, 지원, 관리자 결정 모달을 완료할 수 있다.
- [ ] **AC-UI-04** 모달 열기 시 포커스가 내부로 이동하고 닫을 때 트리거로 돌아간다.
- [ ] **AC-UI-05** 입력 오류는 색상만이 아니라 텍스트와 aria-describedby로 연결된다.
- [ ] **AC-UI-06** 제출 중 버튼은 비활성화되고 진행 상태가 스크린리더에 전달된다.
- [ ] **AC-UI-07** 상태 배지는 텍스트 라벨을 포함하고 색상만으로 구분하지 않는다.
- [ ] **AC-UI-08** 200% 확대에서 핵심 콘텐츠와 행동이 손실되지 않는다.

## 10.10 분석·수요 검증 데이터

- [ ] **AC-ANA-01** Given 요청 게시 성공; When 이벤트 조회; Then request_published 1건
- [ ] **AC-ANA-02** Given 트랜잭션 롤백된 수락; When 이벤트 조회; Then application_owner_decided와 match_created 없음
- [ ] **AC-ANA-03** Given 수락 성공; When 이벤트 조회; Then 결정·매칭 이벤트가 각각 1건이고 동일 request/application 연결
- [ ] **AC-ANA-04** Given 모든 분석 이벤트; When 속성 검사; Then 자유 입력 전문, 이메일, 연락처가 없음
- [ ] **AC-ANA-05** Given 동일 client_request_id 재시도; When 이벤트 조회; Then 각 논리 이벤트 1건
- [ ] **AC-ANA-06** Given 관리자 승인과 원장 수락; When 타임스탬프 계산; Then 처리 시간 산출 가능, 임의 성공/실패 판정 없음

## 10.11 회귀 테스트 최소 세트

매 배포 전 다음 여섯 흐름을 자동 또는 반자동으로 실행한다.

- [ ] 단일 요청 게시 → 지원 → 관리자 승인 → 원장 수락 → 정원 마감
- [ ] 복수 정원 3명 요청 → 세 명 수락 → 세 매칭·세 후속 건 생성
- [ ] 마지막 자리 동시 수락 → 한 건만 성공
- [ ] 관리자 거절·원장 거절·지원자 철회 각각의 권한과 표시
- [ ] 정원 마감 후 매칭 중단 → 요청 비재오픈
- [ ] 무관한 회원의 요청·지원·매칭·연락처 직접 접근 차단
