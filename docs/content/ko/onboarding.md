# 온보딩

Claustrum 온보딩은 최소한의 수동 단계로 팀 온보딩을 위해 설계되었습니다.

## 엔드투엔드 흐름

1. 관리자가 워크스페이스 멤버에서 멤버를 초대합니다.
2. 관리자는 생성된 초대 링크를 공유합니다.
3. 회원은 초대 링크를 열고 비밀번호를 설정합니다.
4. 회원이 로그인합니다.
5. 환영 설정은 회원에게 다음을 요청합니다.
   - API 키 생성(필수)
   - Git 자동 캡처 설치(선택 사항, 권장)

## 초대 API 흐름

- `POST /v1/workspaces/:key/invite`(워크스페이스 관리자+)
  - 입력: `email`, `role`, 선택 `project_roles`
  - 출력: `invite_url`, `expires_at`
- `GET /v1/invite/:token`
  - 토큰의 유효성을 검사하고 초대 메타데이터를 반환합니다.
- `POST /v1/invite/:token/accept`
  - 사용자 비밀번호 프로필 생성/업데이트
  - 작업 공간 역할 + 선택적 프로젝트 역할 할당
  - 토큰을 사용된 것으로 표시합니다.

## 환영 설정

처음 로그인한 후 활성 API 키가 없는 사용자는 시작 설정으로 리디렉션됩니다.

1단계:
- API 키 생성(UI에서 일회성 보기)

2단계(선택사항):
- Git 자동 캡처 설치 명령 복사
- 표시 설치됨(감사 기록 작성)

## 감사 이벤트

- `invite.created`
- `invite.accepted`
- `api_key.created`
- `api_key.revoked`
- `git_capture.installed`

## 온보딩 중 역할

- 워크스페이스 역할: `OWNER`, `ADMIN`, `MEMBER`
- 프로젝트 역할: `OWNER`, `MAINTAINER`, `WRITER`, `READER`
- 초대를 통해 워크스페이스 역할과 선택적인 프로젝트별 역할 맵(`project_roles`)을 설정할 수 있습니다.

## 보안 참고사항

- 초대 토큰은 해시된 DB에 저장됩니다.
- 토큰은 일회성이며 24시간 후에 만료됩니다.
- API 키는 해시로만 저장됩니다.
- 관리자는 기존 일반 텍스트 API 키를 검색할 수 없습니다.