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

## 방문자 소감 기능 — Supabase 연결 (1회 설정)

운영(Netlify) 환경에서 "방문자 소감" 을 실제로 작동시키려면 무료 클라우드 DB **Supabase** 를 연결합니다.

### 1. Supabase 가입 + 프로젝트 만들기
1. https://supabase.com 가입 (GitHub 계정으로 1초)
2. **New Project** → 이름 `today-poem`, 지역 `Northeast Asia (Seoul)`, DB 비번 아무거나
3. 생성 1~2분 대기

### 2. 테이블 만들기
좌측 메뉴 **SQL Editor** → New query → 아래 붙여넣고 **Run**:

```sql
create table guestbook (
  id uuid default gen_random_uuid() primary key,
  name text not null check (length(name) <= 40),
  body text not null check (length(body) <= 2000),
  created_at timestamptz default now()
);

alter table guestbook enable row level security;

create policy "anyone can insert" on guestbook
  for insert with check (length(name) > 0 and length(body) > 0);

create policy "anyone can read" on guestbook
  for select using (true);
```

### 3. 키 두 가지 복사
좌측 **Settings → API**:
- **Project URL**  (예: `https://xxxxx.supabase.co`)
- **Project API keys → anon public**  (`eyJ...`로 시작하는 긴 문자열)

### 4. `js/config.js` 에 붙여넣기

```javascript
window.SITE_CONFIG = {
  supabase: {
    url:     'https://xxxxx.supabase.co',
    anonKey: 'eyJ...........',
  },
};
```

### 5. 커밋 + push
```bash
git add js/config.js
git commit -m "Supabase 키 연결"
git push
```

→ Netlify 자동 빌드 → `https://geomhalove.netlify.app/#feedback` 에서 누구나 소감 남기고 보실 수 있게 됨.

### 관리
- Supabase 대시보드 **Table editor → guestbook** 에서 모든 글 확인·삭제 가능
- 부적절한 글 1건 삭제: 줄 우측 점 3개 → Delete

> anon key 는 공개되어도 안전합니다 (RLS 정책이 보호).
> 무료 요금제로 매월 500MB 트래픽, 5만 건 API 호출 — 시 사이트엔 충분합니다.
