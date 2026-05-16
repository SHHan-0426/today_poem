/* ===================================================================
   마음을 여는 시 — 클라이언트 렌더러
   - 단일 페이지(SPA), 해시 라우팅
   - data/poems.json 로 동작
   =================================================================== */

(function () {
  'use strict';

  const state = {
    poems: [],
    byPoet: new Map(),
    bySeason: { 봄: [], 여름: [], 가을: [], 겨울: [] },
    byYear: new Map(),
    byThought: {},   // { keyword: [entries with commentary matching that keyword] }
  };

  // 로컬 서버(=쓰기 가능)인지, 정적 호스팅(=읽기 전용)인지 판별
  const WRITE_ENABLED = ['localhost', '127.0.0.1'].includes(location.hostname);
  const STATIC_NOTE = '<div class="static-note">🌱 방문자 기록 기능은 곧 추가됩니다. 지금은 시와 단상만 둘러보실 수 있습니다.</div>';

  const SEASON_KEY = { 봄: 'spring', 여름: 'summer', 가을: 'autumn', 겨울: 'winter' };
  const SEASON_DESC = {
    봄: '3·4·5월의 시 — 새순과 첫 햇살, 다시 시작하는 마음',
    여름: '6·7·8월의 시 — 짙푸른 녹음과 깊은 대화',
    가을: '9·10·11월의 시 — 갈대와 단풍, 돌아보는 마음',
    겨울: '12·1·2월의 시 — 흰 눈과 침묵, 기다림의 시간',
  };
  const SEASON_ORDER = ['봄', '여름', '가을', '겨울'];

  // ─── 생각의 방 — 키워드 사전 ─────────────────────────
  // 각 방은 (제목, 매칭할 어휘들). 단상에 어휘가 하나라도 포함되면 그 방에 속함.
  const THOUGHTS = [
    { key: '사랑',      icon: '❤️', words: ['사랑'] },
    { key: '그리움',    icon: '🌙', words: ['그립', '그리움', '그리워'] },
    { key: '어머니',    icon: '🌸', words: ['어머니', '어머님', '엄마'] },
    { key: '가족',      icon: '🏡', words: ['가족', '식구', '부부', '아내', '남편', '자식', '아들', '딸'] },
    { key: '세월·시간', icon: '⌛', words: ['세월', '시간', '흐름', '흐르는'] },
    { key: '자연',      icon: '🌿', words: ['자연', '바다', '들녘', '나무', '바람', '하늘', '햇살', '강물', '산'] },
    { key: '꽃',        icon: '🌷', words: ['꽃잎', '꽃봉오리', '꽃밭', '꽃이', '꽃을', '꽃은'] },
    { key: '인생',      icon: '🛤', words: ['인생', '삶'] },
    { key: '친구·벗',   icon: '🍵', words: ['친구', '벗', '동무'] },
    { key: '기다림',    icon: '🕯', words: ['기다림', '기다리', '기다린다'] },
    { key: '감사',      icon: '🌾', words: ['감사', '고맙', '고마움'] },
    { key: '새 봄',     icon: '🌱', words: ['새 봄', '봄날', '새해', '새 아침', '새로운'] },
  ];

  const $ = (sel) => document.querySelector(sel);
  const app = $('#app');

  // ─── data load ────────────────────────────────────────────────
  fetch('data/poems.json')
    .then((r) => r.json())
    .then((data) => {
      // chronological: oldest → newest
      data.sort((a, b) => (a.year - b.year) || (a.month - b.month) || (a.no - b.no));
      // re-number sequentially after sort so #1 = 첫 편
      data.forEach((e, i) => { e.idx = i; });
      state.poems = data;

      // build indexes
      data.forEach((e) => {
        if (e.poet) {
          if (!state.byPoet.has(e.poet)) state.byPoet.set(e.poet, []);
          state.byPoet.get(e.poet).push(e);
        }
        if (e.season && state.bySeason[e.season]) state.bySeason[e.season].push(e);
        if (e.year) {
          if (!state.byYear.has(e.year)) state.byYear.set(e.year, []);
          state.byYear.get(e.year).push(e);
        }
      });

      // 생각의 방 인덱스: 단상에 키워드가 들어 있으면 그 방에 등록
      THOUGHTS.forEach((t) => { state.byThought[t.key] = []; });
      data.forEach((e) => {
        const c = e.commentary || '';
        if (!c) return;
        THOUGHTS.forEach((t) => {
          if (t.words.some((w) => c.includes(w))) state.byThought[t.key].push(e);
        });
      });

      route();
    })
    .catch((err) => {
      app.innerHTML = '<div class="container"><p style="color:#a33">데이터를 불러올 수 없습니다: ' + err.message + '</p></div>';
    });

  // ─── helpers ──────────────────────────────────────────────────
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(e) {
    if (!e.year) return '';
    const m = e.month ? String(e.month).padStart(2, '0') : '';
    return e.month ? `${e.year}.${m}` : `${e.year}`;
  }

  function bodyExcerpt(body, maxLines = 4) {
    if (!body) return '';
    const lines = body.split('\n').filter((l) => l.trim()).slice(0, maxLines);
    return lines.join('\n');
  }

  function poemLink(e) { return `#poem/${e.idx}`; }

  // ─── routing ──────────────────────────────────────────────────
  window.addEventListener('hashchange', route);
  window.addEventListener('load', () => {
    // mobile nav toggle
    const tog = document.getElementById('nav-toggle');
    const nav = document.getElementById('site-nav');
    if (tog && nav) {
      tog.addEventListener('click', () => nav.classList.toggle('open'));
      nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => nav.classList.remove('open')));
    }

    // edit mode toggle (persist via localStorage)
    const editBtn = document.getElementById('edit-toggle');
    if (editBtn) {
      const setEditMode = (on) => {
        document.body.classList.toggle('edit-mode', on);
        editBtn.classList.toggle('on', on);
        editBtn.textContent = on ? '✓ 편집중' : '✎ 편집';
        localStorage.setItem('editMode', on ? '1' : '0');
      };
      setEditMode(localStorage.getItem('editMode') === '1');
      editBtn.addEventListener('click', () => {
        setEditMode(!document.body.classList.contains('edit-mode'));
        // re-render current view so editable attrs apply
        route();
      });
    }
  });

  // ─── edit-mode helpers ────────────────────────────────────────
  function isEditing() { return document.body.classList.contains('edit-mode'); }

  function toast(msg, type='ok') {
    const t = document.getElementById('save-toast');
    if (!t) return;
    t.textContent = msg;
    t.className = `save-toast show ${type}`;
    clearTimeout(t._tid);
    t._tid = setTimeout(() => t.classList.remove('show'), 2200);
  }

  async function saveField(no, field, value) {
    try {
      const r = await fetch(`/api/poem/${no}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      // update local state
      const e = state.poems.find((x) => x.no === no);
      if (e) Object.assign(e, data.entry);
      toast(`저장됨 — ${field}`, 'ok');
      return true;
    } catch (err) {
      toast(`저장 실패: ${err.message}`, 'err');
      return false;
    }
  }

  function attachEditable(scope) {
    if (!isEditing() || !scope) return;
    scope.querySelectorAll('[data-edit]').forEach((el) => {
      el.contentEditable = 'plaintext-only';
      el.spellcheck = false;
      const no = parseInt(el.dataset.no, 10);
      const field = el.dataset.edit;
      let original = el.textContent;
      el.addEventListener('focus', () => { original = el.textContent; });
      el.addEventListener('blur', () => {
        const value = el.textContent.replace(/ /g, ' ').trim();
        if (value === original.trim()) return;
        saveField(no, field, value);
      });
      // press Enter to confirm in single-line fields
      if (field === 'title' || field === 'poet' || field === 'signature') {
        el.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') { ev.preventDefault(); el.blur(); }
        });
      }
    });

    // "검토 완료로 표시" 버튼
    scope.querySelectorAll('[data-action="mark-verified"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const no = parseInt(btn.dataset.no, 10);
        const ok = await saveField(no, 'needs_verification', false);
        if (ok) route();
      });
    });
  }

  function route() {
    const h = (location.hash || '#').slice(1);
    window.scrollTo(0, 0);

    if (!h || h === '/') { renderHome(); }
    else {
      const parts = h.split('/');
      if      (parts[0] === 'season')    renderSeason(decodeURIComponent(parts[1] || '봄'));
      else if (parts[0] === 'archive')   renderArchive();
      else if (parts[0] === 'poets')     renderPoetsIndex();
      else if (parts[0] === 'poet')      renderPoet(decodeURIComponent(parts[1] || ''));
      else if (parts[0] === 'poem')      renderPoem(parseInt(parts[1] || '0', 10));
      else if (parts[0] === 'thoughts')  renderThoughts();
      else if (parts[0] === 'guestbook') renderGuestbook();
      else if (parts[0] === 'letter')    renderLetter();
      else if (parts[0] === 'inbox')     renderInbox();
      else if (parts[0] === 'about')     renderAbout();
      else                               renderHome();
    }
    // After every render, wire up edit-mode behavior if enabled
    attachEditable(app);
  }

  // ─── HOME ─────────────────────────────────────────────────────
  function renderHome() {
    const all = state.poems;
    if (!all.length) return;

    // 대문 = 가장 최근 발송한 시
    const latest = all[all.length - 1];
    // 지난 전시 (그 다음 최근 6편)
    const recent = all.slice(-7, -1).reverse();

    app.innerHTML = `
      <div class="container">
        <section class="hero">
          <div class="hero-eyebrow">2006 ~ 2026 · 총 ${all.length}편</div>
          <h1 class="hero-title">국어선생님이 매달 1일에<br/>보내는 편지</h1>
          <p class="hero-subtitle">강화 동검도 유하재에서 · 겸하 김대권</p>
          <p class="hero-quote">
            "시는 늘 가까이에 두고 소리내어 낭송하고<br/>
            네 음악을 통하여 승화시켜 나가기를 간절히 소망한다."
          </p>
        </section>

        <!-- 🌟 대문 — 가장 최근의 편지 ─────────────────────── -->
        <section class="exhibit-section">
          <div class="exhibit-eyebrow">⛧ 이 달의 편지 (${latest.year}년 ${latest.month}월)</div>
          <article class="exhibit-card">
            <div class="exhibit-meta">${formatDate(latest)} · ${latest.season || ''} · ${latest.ordinal_in_source ? latest.ordinal_in_source + '번째 편지' : ''}</div>
            <h2 class="exhibit-title">${escapeHtml(latest.title)}</h2>
            <p class="exhibit-poet">${escapeHtml(latest.poet || '작자미상')}</p>
            <div class="exhibit-excerpt">${escapeHtml(bodyExcerpt(latest.body, 8))}</div>
            <a class="exhibit-cta" href="${poemLink(latest)}">전문 들어가기 →</a>
          </article>
          <div id="exhibit-comments" class="exhibit-comments" data-no="${latest.no}">
            <div class="exhibit-comments-label">관람객 일기장에서</div>
            <div class="exhibit-comments-list">불러오는 중…</div>
            <a class="exhibit-comments-more" href="${poemLink(latest)}#comments">일기장 전체 보기 →</a>
          </div>
        </section>

        <!-- 🎨 특별 전시실 — 랜덤 2편 + 셔플 ────────────────── -->
        <section class="random-exhibit">
          <div class="random-exhibit-head">
            <div>
              <div class="exhibit-eyebrow">⊛ 특별 전시실</div>
              <p class="random-exhibit-sub">선생님이 보내신 ${all.length}편 중 두 편을 보여드립니다</p>
            </div>
            <button class="shuffle-btn" id="shuffle-btn" type="button">🔀 다른 두 편 보기</button>
          </div>
          <div class="random-pair" id="random-pair"></div>
        </section>

        <!-- 🌸 계절의 방 — 계절마다 랜덤 1편 + 셔플 ──────── -->
        <section class="season-random">
          <div class="section-head">
            <h2>계절의 방</h2>
            <button class="shuffle-btn season-shuffle-btn" id="season-shuffle" type="button">🔀 다른 시 보기</button>
          </div>
          <div class="season-random-grid" id="season-random-grid"></div>
        </section>

        <!-- 🗓 지난 전시 — 카탈로그 형식 ─────────────────── -->
        <section>
          <div class="section-head">
            <h2>지난 전시</h2>
            <a class="more" href="#archive">전체 보기 →</a>
          </div>
          <ul class="recent-catalog">
            ${recent.map((e) => `
              <li><a class="catalog-row" href="${poemLink(e)}">
                <span class="cat-date">${formatDate(e)}</span>
                <span class="cat-season cat-season-${SEASON_KEY[e.season] || ''}">${e.season || ''}</span>
                <span class="cat-title">${escapeHtml(e.title)}</span>
                <span class="cat-poet">${escapeHtml(e.poet || '작자미상')}</span>
                <span class="cat-arrow">→</span>
              </a></li>`).join('')}
          </ul>
        </section>

        <section class="cta-strip">
          <a class="cta-card" href="#guestbook">
            <div class="cta-icon">📖</div>
            <div class="cta-title">방명록에 인사 남기기</div>
            <div class="cta-desc">사이트를 방문한 자취를 남겨 주세요</div>
          </a>
          <a class="cta-card" href="#letter">
            <div class="cta-icon">✉️</div>
            <div class="cta-title">선생님께 편지 쓰기</div>
            <div class="cta-desc">선생님만 보시는 비공개 편지</div>
          </a>
        </section>
      </div>
    `;

    // 대문 시의 일기장 미리보기 로드
    loadCommentsPreview(latest.no);

    // 특별 전시실 — 초기 2편 표시 + 셔플 버튼 연결
    renderRandomPair(latest.no);
    document.getElementById('shuffle-btn').addEventListener('click', () => renderRandomPair(latest.no));

    // 계절의 방 — 계절마다 랜덤 1편 + 셔플 버튼
    renderSeasonRandom();
    document.getElementById('season-shuffle').addEventListener('click', () => fadeSeasonRandom());
  }

  function renderSeasonRandom() {
    const grid = document.getElementById('season-random-grid');
    if (!grid) return;
    grid.innerHTML = SEASON_ORDER.map((s) => {
      const pool = state.bySeason[s] || [];
      if (!pool.length) {
        return `<div class="season-random-card ${SEASON_KEY[s]}"><div class="srn-head"><span class="srn-name">${s}의 방</span></div><div class="empty-note">아직 시 없음</div></div>`;
      }
      const e = pool[Math.floor(Math.random() * pool.length)];
      return `<a class="season-random-card ${SEASON_KEY[s]}" href="${poemLink(e)}" data-season="${s}">
        <div class="srn-head">
          <span class="srn-name">${s}의 방</span>
          <span class="srn-count">총 ${pool.length}편</span>
        </div>
        <div class="srn-title">${escapeHtml(e.title)}</div>
        <div class="srn-poet">— ${escapeHtml(e.poet || '작자미상')} —</div>
        <div class="srn-date">${formatDate(e)}</div>
      </a>`;
    }).join('');
  }

  function fadeSeasonRandom() {
    const cards = document.querySelectorAll('.season-random-card');
    cards.forEach((c) => c.classList.add('fading'));
    setTimeout(() => {
      renderSeasonRandom();
    }, 220);
  }

  function pickRandomPair(excludeNo) {
    const pool = state.poems.filter((e) => e.no !== excludeNo);
    if (pool.length < 2) return pool;
    // Fisher-Yates 처음 2개
    const indices = pool.map((_, i) => i);
    for (let i = indices.length - 1; i > indices.length - 3; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return [pool[indices[indices.length-1]], pool[indices[indices.length-2]]];
  }

  function renderRandomPair(excludeNo) {
    const pair = pickRandomPair(excludeNo);
    const wrap = document.getElementById('random-pair');
    if (!wrap) return;
    wrap.innerHTML = pair.map((e) => `
      <a class="random-card" href="${poemLink(e)}">
        <div class="random-meta">${formatDate(e)} · ${e.season || ''}</div>
        <div class="random-title">${escapeHtml(e.title)}</div>
        <div class="random-poet">— ${escapeHtml(e.poet || '작자미상')}</div>
        <pre class="random-excerpt">${escapeHtml(bodyExcerpt(e.body, 5))}</pre>
        <div class="random-cta">전문 읽기 →</div>
      </a>`).join('');
  }

  async function loadCommentsPreview(poemNo) {
    const wrap = document.querySelector('#exhibit-comments .exhibit-comments-list');
    if (!wrap) return;
    if (!WRITE_ENABLED) {
      const exhibitComments = document.querySelector('#exhibit-comments');
      if (exhibitComments) exhibitComments.style.display = 'none';
      return;
    }
    try {
      const r = await fetch(`/api/comments/${poemNo}`);
      const d = await r.json();
      const items = (d.comments || []).slice(-3).reverse();
      if (!items.length) {
        wrap.innerHTML = '<div class="empty-note">아직 일기장이 비어 있습니다. 첫 한 마디를 남겨 보세요.</div>';
        return;
      }
      wrap.innerHTML = items.map((c) => `
        <div class="comment-mini">
          <span class="cm-name">${escapeHtml(c.name)}</span>
          <span class="cm-body">${escapeHtml(c.body).slice(0, 80)}${c.body.length > 80 ? '…' : ''}</span>
        </div>`).join('');
    } catch (e) {
      wrap.innerHTML = '<div class="empty-note">일기장을 불러올 수 없습니다.</div>';
    }
  }

  // ─── SEASON ───────────────────────────────────────────────────
  function renderSeason(name) {
    if (!state.bySeason[name]) name = '봄';
    const poems = state.bySeason[name].slice().sort((a, b) => (a.year - b.year) || (a.month - b.month));
    const key = SEASON_KEY[name];

    app.innerHTML = `
      <div class="container season-page">
        <div class="season-tabs">
          ${SEASON_ORDER.map((s) => `
            <a class="season-tab ${s === name ? 'active' : ''}" href="#season/${encodeURIComponent(s)}">${s}</a>`).join('')}
        </div>

        <div class="season-banner ${key}">
          <h2>${name}의 방</h2>
          <p class="desc">${SEASON_DESC[name]}</p>
          <p class="desc">총 ${poems.length}편</p>
        </div>

        <div class="poem-grid">
          ${poems.map((e) => `
            <a class="poem-card" href="${poemLink(e)}">
              <div class="meta">${formatDate(e)}</div>
              <div class="title">${escapeHtml(e.title)}</div>
              <div class="poet">— ${escapeHtml(e.poet || '작자미상')}</div>
            </a>`).join('')}
        </div>
      </div>
    `;
  }

  // ─── ARCHIVE (year-based) ─────────────────────────────────────
  function renderArchive() {
    const years = Array.from(state.byYear.keys()).sort((a, b) => b - a); // 최신 → 옛날

    app.innerHTML = `
      <div class="container archive-page">
        <h1>연도별 아카이브</h1>
        <p class="archive-intro">2006년 9월 첫 편부터 ${years.length}년에 걸친 ${state.poems.length}편의 시. 최신 연도부터 거슬러 보실 수 있습니다.</p>

        ${years.map((y) => {
          const list = state.byYear.get(y).slice().sort((a, b) => a.month - b.month);
          return `
            <section class="year-block">
              <h2>${y} <span class="count">${list.length}편</span></h2>
              <ul class="year-list">
                ${list.map((e) => `
                  <li><a href="${poemLink(e)}">
                    <span class="month">${e.month}월</span>
                    <span class="title">${escapeHtml(e.title)}</span>
                    <span class="poet">${escapeHtml(e.poet || '—')}</span>
                  </a></li>`).join('')}
              </ul>
            </section>
          `;
        }).join('')}
      </div>
    `;
  }

  // ─── POETS INDEX ──────────────────────────────────────────────
  // 분류: 0 = 한국, 1 = 외국, 2 = 미상
  // 자동 분류로 잡지 못하는 예외는 수동 매핑으로 보정
  const KOREAN_OVERRIDE  = new Set(['가람이병기', '위당정인보']);  // 호+이름 합쳐진 한국 시인
  const FOREIGN_OVERRIDE = new Set(['장루슬로']);                   // 한글로만 적힌 외국 시인
  const UNKNOWN_OVERRIDE = new Set(['수우족']);                     // 부족/집단 (작자 미상)

  function poetCategory(name) {
    if (!name) return 2;
    if (KOREAN_OVERRIDE.has(name))  return 0;
    if (UNKNOWN_OVERRIDE.has(name)) return 2;
    if (FOREIGN_OVERRIDE.has(name)) return 1;
    if (/미상|불명|작자|anonymous/i.test(name)) return 2;
    if (/[A-Za-z]/.test(name)) return 1;
    const trimmed = name.trim();
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1 && trimmed.length <= 4) return 0;
    if (parts.length >= 2) return 1;
    if (trimmed.length > 4) return 1;
    return 0;
  }
  const POET_CAT_LABEL = { 0: '한국 시인', 1: '외국 시인', 2: '작자 미상' };

  function renderPoetsIndex() {
    // localStorage 에 정렬 선택을 기억
    const sortMode = localStorage.getItem('poetSort') || 'count';   // 'count' | 'name'

    const all = Array.from(state.byPoet.entries())
      .map(([name, list]) => ({ name, count: list.length, cat: poetCategory(name) }));

    const groups = {0: [], 1: [], 2: []};
    all.forEach((p) => groups[p.cat].push(p));
    Object.values(groups).forEach((arr) => {
      arr.sort((a, b) => {
        if (sortMode === 'count') {
          return b.count - a.count || a.name.localeCompare(b.name, 'ko');
        }
        return a.name.localeCompare(b.name, 'ko');
      });
    });

    app.innerHTML = `
      <div class="container poets-page">
        <div class="poets-head">
          <div>
            <h1>시인 인덱스</h1>
            <p class="poets-intro">총 ${all.length}명 — 한국 시인 → 외국 시인 → 작자 미상 순.</p>
          </div>
          <div class="sort-toggle" role="tablist">
            <button class="sort-opt ${sortMode==='count'?'on':''}" data-sort="count" type="button">수록편수</button>
            <button class="sort-opt ${sortMode==='name'?'on':''}"  data-sort="name"  type="button">가나다순</button>
          </div>
        </div>

        ${[0,1,2].filter((c) => groups[c].length).map((c) => `
          <section class="poet-group">
            <h2 class="poet-group-title">${POET_CAT_LABEL[c]} <span class="poet-group-count">${groups[c].length}명</span></h2>
            <div class="poets-grid">
              ${groups[c].map((p) => `
                <a href="#poet/${encodeURIComponent(p.name)}">
                  <span class="name">${escapeHtml(p.name)}</span>
                  <span class="count">${p.count}</span>
                </a>`).join('')}
            </div>
          </section>
        `).join('')}
      </div>
    `;

    document.querySelectorAll('.sort-opt').forEach((b) => {
      b.addEventListener('click', () => {
        localStorage.setItem('poetSort', b.dataset.sort);
        renderPoetsIndex();
      });
    });
  }

  function renderPoet(name) {
    const poems = state.byPoet.get(name);
    if (!poems) {
      app.innerHTML = `<div class="container"><p>시인을 찾을 수 없습니다: ${escapeHtml(name)}</p></div>`;
      return;
    }
    const sorted = poems.slice().sort((a, b) => (a.year - b.year) || (a.month - b.month));

    app.innerHTML = `
      <div class="container poet-page">
        <a class="poem-back" href="#poets">← 시인 인덱스</a>
        <h1>${escapeHtml(name)}</h1>
        <p class="poet-meta">수록 ${sorted.length}편 · ${sorted[0].year}.${sorted[0].month} ~ ${sorted[sorted.length-1].year}.${sorted[sorted.length-1].month}</p>
        <ul class="poet-list">
          ${sorted.map((e) => `
            <li><a href="${poemLink(e)}">
              <span class="date">${formatDate(e)}</span>
              <span class="title">${escapeHtml(e.title)}</span>
              <span class="season">${e.season || ''}</span>
            </a></li>`).join('')}
        </ul>
      </div>
    `;
  }

  // ─── POEM DETAIL ──────────────────────────────────────────────
  function renderPoem(idx) {
    const e = state.poems[idx];
    if (!e) {
      app.innerHTML = `<div class="container"><p>해당 시를 찾을 수 없습니다.</p></div>`;
      return;
    }
    const prev = state.poems[idx - 1];
    const next = state.poems[idx + 1];
    const seasonKey = SEASON_KEY[e.season];

    const ordinalText = e.ordinal_in_source ? `${e.ordinal_in_source}번째 편 · ` : '';
    app.innerHTML = `
      <div class="container">
        <div class="poem-page">
          <a class="poem-back" href="#archive">← 아카이브</a>

          <div class="poem-meta-bar">
            ${ordinalText}${formatDate(e)}
            ${e.season ? `<span class="season-chip ${seasonKey}">${e.season}</span>` : ''}
          </div>

          <h1 class="poem-title" data-edit="title" data-no="${e.no}">${escapeHtml(e.title)}</h1>
          <p class="poem-poet" data-edit="poet" data-no="${e.no}">${escapeHtml(e.poet || '시인 미상')}</p>

          ${e.needs_verification ? `
            <div class="verify-notice">
              ⚠️ 본문은 사진에서 옮긴 내용으로, 정확한 텍스트 확인이 필요합니다.
              <button class="mark-verified" data-action="mark-verified" data-no="${e.no}">검토 완료로 표시</button>
            </div>` : ''}

          <div class="poem-body" data-edit="body" data-no="${e.no}">${escapeHtml(e.body)}</div>

          <div class="poem-commentary-wrap">
            <div class="poem-commentary-label">선생님의 생각</div>
            <div class="poem-commentary" data-edit="commentary" data-no="${e.no}">${escapeHtml(e.commentary || '')}</div>
          </div>

          <p class="poem-signature" data-edit="signature" data-no="${e.no}">${escapeHtml(e.signature || '')}</p>

          <!-- 💬 관람객 일기장 -->
          <section class="comments-section" id="comments" data-poem-no="${e.no}">
            <h2 class="comments-title">💬 관람객 일기장</h2>
            ${WRITE_ENABLED ? `
              <p class="comments-sub">이 시를 읽고 떠오른 한 마디를 남겨 주세요.</p>
              <form class="comment-form" data-comment-form>
                <input type="text" name="name" placeholder="이름 (또는 별명)" maxlength="40" required />
                <textarea name="body" placeholder="시에 대한 생각, 떠오르는 기억, 인사 한 마디…" maxlength="2000" required rows="3"></textarea>
                <div class="form-row">
                  <button type="submit" class="btn-primary">남기기</button>
                  <span class="form-status"></span>
                </div>
              </form>
              <div class="comment-list" data-comment-list>불러오는 중…</div>
            ` : STATIC_NOTE}
          </section>

          <nav class="poem-nav" data-poem-nav>
            ${prev ? `
              <a class="nav-prev" href="${poemLink(prev)}">
                <span class="label">← 이전 편</span>
                <span class="title-mini">${escapeHtml(prev.title)}</span>
              </a>` : '<span></span>'}
            ${next ? `
              <a class="nav-next" href="${poemLink(next)}">
                <span class="label">다음 편 →</span>
                <span class="title-mini">${escapeHtml(next.title)}</span>
              </a>` : '<span></span>'}
          </nav>
        </div>
      </div>
    `;
    // 댓글 (로컬 서버일 때만)
    if (WRITE_ENABLED) {
      loadComments(e.no);
      bindCommentForm(e.no);
    }
  }

  // ─── COMMENTS (관람객 일기장) ────────────────────────────────
  function tsFormat(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    const yy = d.getFullYear(), mm = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0');
    const h = String(d.getHours()).padStart(2,'0'), m = String(d.getMinutes()).padStart(2,'0');
    return `${yy}.${mm}.${dd} ${h}:${m}`;
  }

  async function loadComments(poemNo) {
    const wrap = document.querySelector('[data-comment-list]');
    if (!wrap) return;
    try {
      const r = await fetch(`/api/comments/${poemNo}`);
      const d = await r.json();
      // 시간순(오래된 → 새로운). 답글 구조 없이 평면 리스트.
      const all = (d.comments || []).slice().sort((a,b) => (a.ts < b.ts ? -1 : 1));
      if (!all.length) {
        wrap.innerHTML = '<div class="empty-note">아직 일기장이 비어 있습니다. 첫 한 마디를 남겨 보세요.</div>';
        return;
      }
      wrap.innerHTML = all.map((c) => `
        <article class="comment">
          <div class="comment-head">
            <span class="comment-name">${escapeHtml(c.name)}</span>
            <span class="comment-time">${tsFormat(c.ts)}</span>
          </div>
          <div class="comment-body">${escapeHtml(c.body)}</div>
        </article>`).join('');
    } catch (err) {
      wrap.innerHTML = `<div class="empty-note err">불러올 수 없습니다: ${err.message}</div>`;
    }
  }

  function bindCommentForm(poemNo) {
    const form = document.querySelector('[data-comment-form]');
    if (!form) return;
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const status = form.querySelector('.form-status');
      status.textContent = '저장 중…'; status.className = 'form-status';
      try {
        const r = await fetch(`/api/comments/${poemNo}`, {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ name: fd.get('name'), body: fd.get('body') })
        });
        if (!r.ok) throw new Error('서버 오류');
        form.reset();
        status.textContent = '남겼습니다.'; status.className = 'form-status ok';
        setTimeout(() => { status.textContent = ''; }, 2000);
        loadComments(poemNo);
      } catch (e) {
        status.textContent = '실패: ' + e.message; status.className = 'form-status err';
      }
    });
  }

  // ─── 생각의 방 (선생님 단상을 키워드별로) ─────────────────
  function renderThoughts() {
    const rooms = THOUGHTS.filter((t) => state.byThought[t.key]?.length > 0);

    app.innerHTML = `
      <div class="container thoughts-page">
        <div class="thoughts-head">
          <div>
            <h1>생각의 방</h1>
            <p class="page-intro">
              선생님께서 시 옆에 덧붙이신 단상을, 일상의 화두별로 묶어 작은 방들로 만들었습니다.
              각 방마다 한 편의 단상이 머물러 있고, 셔플하시면 다른 생각이 찾아옵니다.
            </p>
          </div>
          <button class="shuffle-btn" id="thoughts-shuffle" type="button">🔀 모두 새로 보기</button>
        </div>

        <div class="thoughts-grid" id="thoughts-grid">
          ${rooms.map((t) => `
            <article class="thought-card" data-key="${t.key}">
              <div class="thought-head">
                <span class="thought-icon">${t.icon}</span>
                <span class="thought-key">${t.key}</span>
                <span class="thought-count">${state.byThought[t.key].length}편</span>
              </div>
              <div class="thought-body-wrap">
                <div class="thought-body"></div>
              </div>
              <div class="thought-source">
                <a class="thought-source-link" href="#"></a>
              </div>
              <button class="thought-shuffle-mini" data-key="${t.key}" title="이 방만 새로 보기">↻</button>
            </article>
          `).join('')}
        </div>

        <p class="thoughts-note">
          ※ 키워드는 단상 안의 단어들을 자동으로 묶은 것입니다. 한 단상이 여러 방에 동시에 머무를 수 있습니다.
        </p>
      </div>
    `;

    // 초기 채우기
    rooms.forEach((t) => fillThoughtCard(t.key));

    // 전체 셔플
    document.getElementById('thoughts-shuffle').addEventListener('click', () => {
      shuffleAllThoughts();
    });
    // 방별 셔플
    document.querySelectorAll('.thought-shuffle-mini').forEach((btn) => {
      btn.addEventListener('click', () => fadeAndFill(btn.dataset.key));
    });
  }

  function fillThoughtCard(key, animate = false) {
    const card = document.querySelector(`.thought-card[data-key="${CSS.escape(key)}"]`);
    if (!card) return;
    const pool = state.byThought[key] || [];
    if (!pool.length) return;
    const e = pool[Math.floor(Math.random() * pool.length)];

    // 단상에서 키워드 첫 등장 부근을 발췌 (있는 그대로)
    const thought = THOUGHTS.find((t) => t.key === key);
    const excerpt = commentaryExcerpt(e.commentary, thought?.words || [], 180);

    const bodyEl = card.querySelector('.thought-body');
    const linkEl = card.querySelector('.thought-source-link');

    const apply = () => {
      bodyEl.textContent = excerpt;
      linkEl.textContent = `${e.year}.${e.month} 「${e.title}」 / ${e.poet || '작자미상'}`;
      linkEl.setAttribute('href', poemLink(e));
    };

    if (animate) {
      card.classList.add('fading');
      setTimeout(() => {
        apply();
        card.classList.remove('fading');
      }, 220);
    } else {
      apply();
    }
  }

  function fadeAndFill(key) { fillThoughtCard(key, true); }

  function shuffleAllThoughts() {
    const cards = document.querySelectorAll('.thought-card');
    cards.forEach((c) => c.classList.add('fading'));
    setTimeout(() => {
      cards.forEach((c) => {
        const key = c.dataset.key;
        const pool = state.byThought[key] || [];
        if (!pool.length) return;
        const e = pool[Math.floor(Math.random() * pool.length)];
        const thought = THOUGHTS.find((t) => t.key === key);
        const excerpt = commentaryExcerpt(e.commentary, thought?.words || [], 180);
        c.querySelector('.thought-body').textContent = excerpt;
        const link = c.querySelector('.thought-source-link');
        link.textContent = `${e.year}.${e.month} 「${e.title}」 / ${e.poet || '작자미상'}`;
        link.setAttribute('href', poemLink(e));
        c.classList.remove('fading');
      });
    }, 220);
  }

  // 키워드가 처음 등장하는 문장 주변에서 단상을 한 토막 떼어냄
  function commentaryExcerpt(text, words, maxlen) {
    if (!text) return '';
    const lines = text.split('\n').map((s) => s.trim()).filter(Boolean);
    // 키워드가 있는 줄을 찾고, 그 줄을 중심으로 출력
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (words.some((w) => lines[i].includes(w))) { idx = i; break; }
    }
    if (idx < 0) idx = 0;
    const piece = lines[idx];
    if (piece.length <= maxlen) return piece;
    // 키워드를 가운데 두고 잘라내기
    const word = words.find((w) => piece.includes(w)) || '';
    const wpos = word ? piece.indexOf(word) : 0;
    const start = Math.max(0, wpos - Math.floor(maxlen / 3));
    const end = Math.min(piece.length, start + maxlen);
    return (start > 0 ? '…' : '') + piece.slice(start, end) + (end < piece.length ? '…' : '');
  }

  // ─── GUESTBOOK (방명록) ──────────────────────────────────────
  function renderGuestbook() {
    if (!WRITE_ENABLED) {
      app.innerHTML = `
        <div class="container guestbook-page">
          <h1>방명록</h1>
          ${STATIC_NOTE}
        </div>`;
      return;
    }
    app.innerHTML = `
      <div class="container guestbook-page">
        <h1>방명록</h1>
        <p class="page-intro">사이트를 방문하신 자취를 남겨 주세요. 짧은 인사도, 긴 회상도 좋습니다.</p>

        <form class="guestbook-form" id="gb-form">
          <input type="text" name="name" placeholder="이름" maxlength="40" required />
          <textarea name="body" placeholder="한 마디 남겨 주세요…" maxlength="2000" rows="4" required></textarea>
          <div class="form-row">
            <button type="submit" class="btn-primary">남기기</button>
            <span class="form-status"></span>
          </div>
        </form>

        <div id="gb-list" class="guestbook-list">불러오는 중…</div>
      </div>
    `;
    loadGuestbook();
    document.getElementById('gb-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const form = ev.target;
      const fd = new FormData(form);
      const status = form.querySelector('.form-status');
      status.textContent = '저장 중…'; status.className = 'form-status';
      try {
        const r = await fetch('/api/guestbook', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ name: fd.get('name'), body: fd.get('body') })
        });
        if (!r.ok) throw new Error('서버 오류');
        form.reset();
        status.textContent = '인사 잘 받았습니다.'; status.className = 'form-status ok';
        setTimeout(() => { status.textContent = ''; }, 2000);
        loadGuestbook();
      } catch (e) {
        status.textContent = '실패: ' + e.message; status.className = 'form-status err';
      }
    });
  }

  async function loadGuestbook() {
    const wrap = document.getElementById('gb-list');
    if (!wrap) return;
    const r = await fetch('/api/guestbook');
    const d = await r.json();
    const entries = (d.entries || []).slice().reverse();
    if (!entries.length) {
      wrap.innerHTML = '<div class="empty-note">아직 방명록이 비어 있습니다. 첫 인사를 남겨 보세요.</div>';
      return;
    }
    wrap.innerHTML = entries.map((g) => `
      <article class="gb-entry" data-id="${g.id}">
        <div class="gb-head">
          <span class="gb-name">${escapeHtml(g.name)}</span>
          <span class="gb-time">${tsFormat(g.ts)}</span>
        </div>
        <div class="gb-body">${escapeHtml(g.body)}</div>
      </article>`).join('');
  }

  // ─── LETTER (선생님께 보내는 비공개 편지) ─────────────────────
  function renderLetter() {
    if (!WRITE_ENABLED) {
      app.innerHTML = `
        <div class="container letter-page">
          <h1>선생님께 편지 쓰기</h1>
          ${STATIC_NOTE}
        </div>`;
      return;
    }
    app.innerHTML = `
      <div class="container letter-page">
        <h1>선생님께 편지 쓰기</h1>
        <p class="page-intro">
          여기에 남기시는 편지는 <strong>선생님만 보십니다.</strong>
          사이트의 다른 사람에게는 공개되지 않습니다.
        </p>
        <form id="letter-form" class="letter-form">
          <label>이름 (별명)
            <input type="text" name="name" maxlength="40" required />
          </label>
          <label>이메일 (선택 — 선생님이 답장 보내실 수 있는 곳)
            <input type="email" name="email" maxlength="80" />
          </label>
          <label>편지 내용
            <textarea name="body" rows="8" maxlength="2000" required placeholder="안부, 시 한 편에 대한 깊은 생각, 만나뵙고 싶은 마음 …"></textarea>
          </label>
          <div class="form-row">
            <button type="submit" class="btn-primary">편지 보내기</button>
            <span class="form-status"></span>
          </div>
        </form>
      </div>
    `;
    document.getElementById('letter-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const form = ev.target;
      const fd = new FormData(form);
      const status = form.querySelector('.form-status');
      status.textContent = '보내는 중…'; status.className='form-status';
      try {
        const r = await fetch('/api/message', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            name: fd.get('name'), email: fd.get('email'), body: fd.get('body')
          })
        });
        if (!r.ok) throw new Error('서버 오류');
        form.reset();
        status.textContent = '편지가 선생님께 전달되었습니다.'; status.className='form-status ok';
      } catch (e) {
        status.textContent = '실패: ' + e.message; status.className='form-status err';
      }
    });
  }

  async function renderInbox() {
    app.innerHTML = `
      <div class="container letter-page">
        <h1>받은 편지함 ${isEditing() ? '' : '<span style="font-size:13px;color:#a33">(편집 모드일 때만 열림)</span>'}</h1>
        <div id="inbox-list">불러오는 중…</div>
      </div>
    `;
    if (!isEditing()) return;
    const r = await fetch('/api/messages');
    const d = await r.json();
    const wrap = document.getElementById('inbox-list');
    const items = (d.messages || []).slice().reverse();
    if (!items.length) {
      wrap.innerHTML = '<div class="empty-note">아직 받은 편지가 없습니다.</div>';
      return;
    }
    wrap.innerHTML = items.map((m) => `
      <article class="inbox-item">
        <div class="gb-head">
          <span class="gb-name">${escapeHtml(m.name)}</span>
          ${m.email ? `<span class="gb-email">${escapeHtml(m.email)}</span>` : ''}
          <span class="gb-time">${tsFormat(m.ts)}</span>
        </div>
        <div class="gb-body">${escapeHtml(m.body)}</div>
      </article>`).join('');
  }

  // ─── ABOUT ────────────────────────────────────────────────────
  function renderAbout() {
    const total = state.poems.length;
    const yearsSpan = (() => {
      const years = Array.from(state.byYear.keys()).sort((a, b) => a - b);
      return `${years[0]}–${years[years.length - 1]}`;
    })();
    const poetsCount = state.byPoet.size;
    const monthsCount = (() => {
      const set = new Set();
      state.poems.forEach((e) => e.year && e.month && set.add(`${e.year}-${e.month}`));
      return set.size;
    })();

    app.innerHTML = `
      <div class="container about-page">
        <h1>이 사이트에 대하여</h1>

        <p>
          <strong>「국어선생님이 매달 1일에 보내는 편지」</strong> 는 고등학교 국어 선생님이셨던 <strong>겸하 김대권 선생님</strong>께서
          정년 퇴임 이후에도 매달 1일, 한 달도 거르지 않고 제자들에게 보내오신
          한 편의 시와 단상의 기록입니다.
        </p>

        <p>
          첫 편은 2006년 9월 정현종 시인의 「모든 순간이 꽃봉오리인 것을」이며,
          가장 최근의 편은 2026년 5월 이정록 시인의 「의자」 입니다.
          시는 시인의 목소리이지만, 그 끝에 덧붙은 단상은 강화 동검도 <strong>유하재(柳下齋)</strong>에서
          제자들을 향해 띄우신 선생님의 마음입니다.
        </p>

        <div class="stats">
          <div class="stat"><div class="num">${total}</div><div class="label">편의 시</div></div>
          <div class="stat"><div class="num">${monthsCount}</div><div class="label">달의 기록</div></div>
          <div class="stat"><div class="num">${poetsCount}</div><div class="label">명의 시인</div></div>
          <div class="stat"><div class="num">${yearsSpan}</div><div class="label">수록 기간</div></div>
        </div>

        <p>
          이 아카이브는 그 20년의 편지를 한자리에 모아, 누구나 계절·시인·연도별로
          다시 읽을 수 있도록 만든 디지털 정원입니다.
          한 달에 한 편씩, 천천히 소리 내어 낭송해 주시기를 권합니다.
        </p>

        <p style="font-family: var(--sans); font-size: 13px; color: var(--ink-fade); margin-top: 48px;">
          저작권 안내 — 수록된 시의 저작권은 각 시인에게 있으며, 단상은 김대권 선생님께 있습니다.
          본 사이트는 비영리 교육·기념 목적으로 운영됩니다.
        </p>
      </div>
    `;
  }
})();
