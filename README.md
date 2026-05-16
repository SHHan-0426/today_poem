# 국어선생님이 매달 1일에 보내는 편지

2006년 9월부터 한 달도 거르지 않고 제자들에게 보내신
한 편의 시와 단상의 기록.
강화 동검도 유하재에서 — **겸하 김대권 선생님**.

## 구성

- **시 234편** — 2006.9 ~ 2026.5
- **선생님의 생각** (단상)
- **이 달의 편지** · **계절의 방** · **특별 전시실** · **생각의 방**
- **시인 인덱스** (한국 · 외국 · 미상)

## 로컬 보기

```bash
python3 server.py
# → http://127.0.0.1:8765/
```

또는 데스크탑의 `사이트 열기.command` 더블클릭.

## 폴더

```
├─ index.html
├─ css/main.css
├─ js/app.js
├─ data/
│   ├─ poems.json          # 시 234편
│   ├─ comments.json       # 방문객 일기장
│   └─ guestbook.json      # 방명록
├─ server.py               # 로컬 편집·기록용
├─ netlify.toml            # Netlify 설정
└─ _redirects              # SPA 라우팅
```

## 배포

`main` 브랜치에 push 하면 [Netlify](https://www.netlify.com/) 가 자동으로 사이트를 갱신합니다.
