# 부트스트랩 컨텍스트

부트스트랩 컨텍스트는 프로젝트 생성 직후 최소 내구성 메모리를 생성합니다.

## 트리거 포인트

- 자동: 프로젝트 생성 흐름(최선의 노력)
- 매뉴얼 : `POST /v1/projects/:key/bootstrap`
- 관리 UI: 프로젝트 설정 `Bootstrap context` 버튼

## 소스

부트스트랩 수집기는 사용 가능한 경우 다음 로컬 신호를 샘플링합니다.

- `README.md`
- `package.json`
- `docker-compose.yml` / `docker-compose.yaml`
- `infra/docker-compose.yml` / `infra/docker-compose.yaml`
- 최근 Git 원시 이벤트(`post_commit`, `post_merge`, `post_checkout`)

## 출력 메모리

- `type`: `summary`
- `status`: `confirmed`
- `source`: `auto`
- `metadata.source`: `bootstrap`
- `metadata.files`: 감지된 파일 신호 목록

## 실패 모델

- 부트스트랩은 비차단입니다.
- 소스 파일이 없거나 읽을 수 없는 경우에도 프로젝트는 계속 작동합니다.
- 부트스트랩을 수동으로 다시 시도할 수 있습니다.

최종 업데이트 날짜: 2026-02-17