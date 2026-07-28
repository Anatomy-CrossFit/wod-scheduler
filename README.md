# WOD 캘린더

한 달 운동(WOD) 스케줄을 생성하고 PNG/JPG 이미지로 내보내는 정적 웹앱.
GitHub Pages에 그대로 올릴 수 있는 단일 `index.html` 구성.

## 기능

- 월 이동(◀ ▶), 난이도/휴식일 패턴 선택
- ⚡ 스케줄 생성 — **현재는 더미 데이터** (`index.html`의 `DUMMY_POOL`이 실제 생성 로직으로 교체할 자리)
- 날짜 클릭 → 상세 모달 (다시 뽑기 / 휴식일 전환)
- 📥 PNG/JPG 저장 — html2canvas(CDN)로 캘린더 영역을 1080px 폭 이미지로 렌더 후 다운로드

## GitHub Pages 배포

1. 이 폴더를 GitHub 저장소로 push
2. 저장소 Settings → Pages → Branch: `main`, 폴더 `/ (root)` 선택
3. `https://<계정명>.github.io/<저장소명>/` 에서 접속

## 로컬 확인

아무 정적 서버로 열면 됨 (html2canvas CDN 로드를 위해 인터넷 연결 필요).
