# 결정 템플릿

안정적인 검색 품질을 위해 결정 추출은 고정된 형태로 강제 적용됩니다.

## 필수 섹션

모든 결정 메모리 내용은 다음을 포함하도록 정규화됩니다.

- `Summary:`
- `Why:`
- `Alternatives:`
- `Impact:`
- `Evidence:`

## 서식 규칙

- 요약 : 1~2줄
- 이유/대안/영향: 각 총알 1~3개
- 증거: 가능할 때마다 커밋/원시 증거 참조를 포함합니다.

## 집행

- LLM 추출기 프롬프트에서는 엄격한 구조화된 출력을 요청합니다.
- 서버 측 정규화는 누락된 섹션을 자동으로 채웁니다.
- 데이터가 누락되더라도 섹션 헤더는 유지됩니다.

## 예

```text
Summary:
Switch memory search to hybrid ranking with explicit debug scores.

Why:
- Keyword-only ranking missed high-quality decisions.
- Teams needed consistent quality controls.

Alternatives:
- Keep keyword-only retrieval.
- Use semantic-only retrieval.

Impact:
- Recall quality improves for cross-session workflows.
- Debug mode can explain ranking details.

Evidence:
- commit_sha: 8c3f0a12d9
- raw_event_id: 8d53cceb-2aab-4f08-9bf4-b038b5f76f33
```
