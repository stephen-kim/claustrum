# 종속성 관리(pnpm 표준)

## 정책

Claustrum은 공식 패키지 관리자로 **pnpm**을 사용합니다.

규칙:
- 설치/실행/업데이트에는 `pnpm`을 사용하세요.
- `pnpm-lock.yaml`을 커밋합니다.
- `package-lock.json` 또는 `yarn.lock`을 저지르지 마세요.
- CI는 `pnpm install --frozen-lockfile`을 사용해야 합니다.
- 이 저장소에서는 `npm install`을 실행하지 마세요.

## 왜 pnpm인가?

- 결정적 작업 공간은 단일 잠금 파일을 통해 설치됩니다.
- 빠르고 디스크 효율적인 종속성 스토리지입니다.
- 재귀 명령을 사용하여 더 나은 모노레포 워크플로우를 제공합니다.

## 잠금 파일 정책

필수:
- `pnpm-lock.yaml`은 소스 제어됩니다.

금지:
- `package-lock.json`
- `yarn.lock`

npm 잠금 파일이 실수로 나타나면 제거하고 pnpm으로 다시 설치하세요.

## 작업공간 레이아웃

`pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```
## 루트 명령

- `pnpm dev` → `pnpm -r dev`
- `pnpm build` → `pnpm -r build`
- `pnpm lint` → `pnpm -r lint`
- `pnpm test` → `pnpm -r test`

## CI 규칙

CI를 실행해야 합니다.

1. pnpm + 노드 설정
2. `pnpm install --frozen-lockfile`
3. `pnpm lint`
4. `pnpm build`
5. `pnpm test`

## 지역 개발

```shell
pnpm install
pnpm dev
```
필요한 경우 패키지 필터를 사용하세요.

```shell
pnpm --filter @claustrum/memory-core dev
pnpm --filter @claustrum/admin-ui build
```
## 가드레일

`.npmrc`은 다음을 시행합니다.

```ini
engine-strict=true
auto-install-peers=true
```

