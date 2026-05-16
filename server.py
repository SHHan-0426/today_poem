#!/usr/bin/env python3
"""
국어선생님이 매달 1일에 보내는 편지 — 편집·소통 가능 서버

엔드포인트
  GET  /                            정적 파일
  PUT  /api/poem/<no>               시 한 편 부분 수정 (제목/시인/본문/단상/서명/검토상태)
  GET  /api/comments/<poem_no>      그 시의 관람객 일기장
  POST /api/comments/<poem_no>      일기 추가  body: {name, body, is_teacher, parent_id?}
  DELETE /api/comments/<poem_no>/<id>   일기 삭제 (선생님 전용 클라이언트만 호출)
  GET  /api/guestbook               방명록 전체
  POST /api/guestbook               방명록 추가
  DELETE /api/guestbook/<id>        방명록 삭제
  POST /api/message                 선생님께 보내는 편지 (비공개)
  GET  /api/messages                받은 편지 목록 (선생님 전용)
  GET  /api/featured                이 달의 특별 전시실 = 가장 최근 발송 시
  PUT  /api/featured/<no>           특별 전시실 수동 지정 (선생님)
"""
import http.server
import json
import os
import re
import shutil
import socketserver
import threading
import time
import uuid
from pathlib import Path

ROOT     = Path('/Users/a1/Desktop/선생님시/site')
DATA     = ROOT / 'data' / 'poems.json'
COMMENTS = ROOT / 'data' / 'comments.json'
GUEST    = ROOT / 'data' / 'guestbook.json'
MESSAGES = ROOT / 'data' / 'messages.json'
META     = ROOT / 'data' / 'meta.json'      # featured override etc.
BACKUPS  = ROOT / 'data' / 'backups'
BACKUPS.mkdir(exist_ok=True)
LOCK = threading.Lock()
PORT = 8765

os.chdir(ROOT)

EDITABLE_POEM_FIELDS = {'title', 'poet', 'body', 'commentary', 'signature', 'needs_verification'}
MAX_BODY_LEN  = 2000   # 한 글의 최대 길이
MAX_NAME_LEN  = 40

# ── helpers ─────────────────────────────────────────────
def load_json(path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return default

def save_json(path, data, backup_tag=None):
    if backup_tag and path.exists():
        ts = time.strftime('%Y%m%d-%H%M%S')
        shutil.copy2(path, BACKUPS / f'{path.stem}-{ts}-{backup_tag}.json')
        # keep last 30 backups per file
        for old in sorted(BACKUPS.glob(f'{path.stem}-*.json'))[:-30]:
            old.unlink(missing_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    tmp.replace(path)

def sanitize_text(s, maxlen):
    if not isinstance(s, str): return ''
    s = s.replace('\r\n', '\n').replace('\r', '\n').strip()
    # collapse 3+ blank lines
    s = re.sub(r'\n{3,}', '\n\n', s)
    return s[:maxlen]

def now_iso():
    return time.strftime('%Y-%m-%dT%H:%M:%S')


class Handler(http.server.SimpleHTTPRequestHandler):

    # ── headers / CORS ─────────────────────────────────
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204); self.end_headers()

    # ── helpers ────────────────────────────────────────
    def _read_json(self):
        n = int(self.headers.get('Content-Length', 0))
        raw = self.rfile.read(n).decode('utf-8') if n else '{}'
        try:
            return json.loads(raw)
        except json.JSONDecodeError as e:
            self.send_error(400, f'Bad JSON: {e}'); return None

    def _json(self, obj, status=200):
        data = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    # ── dispatch ───────────────────────────────────────
    def do_PUT(self):
        m = re.match(r'^/api/poem/(\d+)$', self.path)
        if m: return self._put_poem(int(m.group(1)))
        m = re.match(r'^/api/featured/(\d+)$', self.path)
        if m: return self._put_featured(int(m.group(1)))
        self.send_error(404)

    def do_POST(self):
        m = re.match(r'^/api/comments/(\d+)$', self.path)
        if m: return self._post_comment(int(m.group(1)))
        if self.path == '/api/guestbook':   return self._post_guestbook()
        if self.path == '/api/message':     return self._post_message()
        self.send_error(404)

    def do_DELETE(self):
        m = re.match(r'^/api/comments/(\d+)/([\w-]+)$', self.path)
        if m: return self._delete_comment(int(m.group(1)), m.group(2))
        # 방문자 본인 글 삭제: visitor_id 쿼리스트링 일치 확인
        m = re.match(r'^/api/guestbook/([\w-]+)(?:\?.*)?$', self.path)
        if m: return self._delete_guestbook_owned(m.group(1))
        self.send_error(404)

    def do_PATCH(self):
        m = re.match(r'^/api/guestbook/([\w-]+)$', self.path)
        if m: return self._patch_guestbook_owned(m.group(1))
        self.send_error(404)

    def do_GET(self):
        m = re.match(r'^/api/comments/(\d+)$', self.path)
        if m: return self._get_comments(int(m.group(1)))
        if self.path == '/api/guestbook':  return self._get_guestbook()
        if self.path == '/api/messages':   return self._get_messages()
        if self.path == '/api/featured':   return self._get_featured()
        return super().do_GET()

    # ── poem edit (기존) ───────────────────────────────
    def _put_poem(self, no):
        patch = self._read_json()
        if patch is None: return
        if not isinstance(patch, dict):
            return self.send_error(400, 'JSON object required')
        with LOCK:
            data = load_json(DATA, [])
            target = next((e for e in data if e.get('no') == no), None)
            if target is None: return self.send_error(404, f'no={no} not found')
            applied = {}
            for k, v in patch.items():
                if k not in EDITABLE_POEM_FIELDS: continue
                if isinstance(v, str):
                    v = v.replace('\r\n','\n').replace('\r','\n')
                target[k] = v; applied[k] = v
            save_json(DATA, data, backup_tag='edit')
        self._json({'ok': True, 'no': no, 'applied': applied, 'entry': target})

    # ── 댓글 (관람객 일기장) ────────────────────────────
    def _post_comment(self, poem_no):
        d = self._read_json()
        if d is None: return
        name = sanitize_text(d.get('name',''), MAX_NAME_LEN) or '익명'
        body = sanitize_text(d.get('body',''), MAX_BODY_LEN)
        if not body: return self.send_error(400, 'body required')
        is_teacher = bool(d.get('is_teacher'))
        parent_id  = d.get('parent_id') or None
        entry = {
            'id': uuid.uuid4().hex[:10],
            'poem_no': poem_no,
            'name': name,
            'body': body,
            'ts': now_iso(),
            'is_teacher': is_teacher,
            'parent_id': parent_id,
        }
        with LOCK:
            all_c = load_json(COMMENTS, {})
            key = str(poem_no)
            all_c.setdefault(key, []).append(entry)
            save_json(COMMENTS, all_c, backup_tag='comment')
        self._json({'ok': True, 'comment': entry})

    def _get_comments(self, poem_no):
        all_c = load_json(COMMENTS, {})
        self._json({'comments': all_c.get(str(poem_no), [])})

    def _delete_comment(self, poem_no, cid):
        with LOCK:
            all_c = load_json(COMMENTS, {})
            key = str(poem_no)
            arr = all_c.get(key, [])
            before = len(arr)
            arr = [c for c in arr if c.get('id') != cid and c.get('parent_id') != cid]
            all_c[key] = arr
            removed = before - len(arr)
            save_json(COMMENTS, all_c, backup_tag='comment-del')
        self._json({'ok': True, 'removed': removed})

    # ── 방명록 ──────────────────────────────────────────
    def _post_guestbook(self):
        d = self._read_json()
        if d is None: return
        name = sanitize_text(d.get('name',''), MAX_NAME_LEN) or '익명'
        body = sanitize_text(d.get('body',''), MAX_BODY_LEN)
        if not body: return self.send_error(400, 'body required')
        is_teacher = bool(d.get('is_teacher'))
        vid = d.get('visitor_id', '')
        entry = {
            'id': uuid.uuid4().hex[:10],
            'name': name, 'body': body, 'ts': now_iso(),
            'is_teacher': is_teacher,
            'visitor_id': vid,
        }
        with LOCK:
            arr = load_json(GUEST, [])
            arr.append(entry)
            save_json(GUEST, arr, backup_tag='guest')
        self._json({'ok': True, 'entry': entry})

    def _get_guestbook(self):
        self._json({'entries': load_json(GUEST, [])})

    def _delete_guestbook(self, gid):
        with LOCK:
            arr = load_json(GUEST, [])
            before = len(arr)
            arr = [g for g in arr if g.get('id') != gid]
            save_json(GUEST, arr, backup_tag='guest-del')
        self._json({'ok': True, 'removed': before - len(arr)})

    def _delete_guestbook_owned(self, gid):
        # 쿼리스트링에서 visitor_id 추출
        from urllib.parse import urlparse, parse_qs
        q = parse_qs(urlparse(self.path).query)
        vid = (q.get('visitor_id') or [''])[0]
        if not vid: return self.send_error(403, 'visitor_id required')
        with LOCK:
            arr = load_json(GUEST, [])
            target = next((g for g in arr if g.get('id') == gid), None)
            if target is None: return self.send_error(404, 'not found')
            if target.get('visitor_id') != vid: return self.send_error(403, 'not the author')
            arr = [g for g in arr if g.get('id') != gid]
            save_json(GUEST, arr, backup_tag='guest-del-own')
        self._json({'ok': True})

    def _patch_guestbook_owned(self, gid):
        d = self._read_json()
        if d is None: return
        vid = d.get('visitor_id', '')
        new_body = sanitize_text(d.get('body',''), MAX_BODY_LEN)
        if not vid or not new_body:
            return self.send_error(400, 'visitor_id and body required')
        with LOCK:
            arr = load_json(GUEST, [])
            target = next((g for g in arr if g.get('id') == gid), None)
            if target is None: return self.send_error(404, 'not found')
            if target.get('visitor_id') != vid: return self.send_error(403, 'not the author')
            target['body'] = new_body
            target['edited_at'] = now_iso()
            save_json(GUEST, arr, backup_tag='guest-edit')
        self._json({'ok': True, 'entry': target})

    # ── 선생님께 보내는 편지 (비공개) ──────────────────
    def _post_message(self):
        d = self._read_json()
        if d is None: return
        name = sanitize_text(d.get('name',''), MAX_NAME_LEN) or '익명'
        email = sanitize_text(d.get('email',''), 80)
        body = sanitize_text(d.get('body',''), MAX_BODY_LEN)
        if not body: return self.send_error(400, 'body required')
        entry = {
            'id': uuid.uuid4().hex[:10],
            'name': name, 'email': email, 'body': body, 'ts': now_iso(),
            'read': False,
        }
        with LOCK:
            arr = load_json(MESSAGES, [])
            arr.append(entry)
            save_json(MESSAGES, arr, backup_tag='msg')
        self._json({'ok': True})  # 발신자에겐 내용 메아리 안 함 (사생활)

    def _get_messages(self):
        # 받은 편지 목록 — 클라이언트는 편집 모드일 때만 호출하도록 약속
        self._json({'messages': load_json(MESSAGES, [])})

    # ── 이 달의 특별 전시실 ────────────────────────────
    def _get_featured(self):
        meta = load_json(META, {})
        data = load_json(DATA, [])
        if not data: return self._json({'no': None})
        # 1) 수동 지정이 있으면 그것을 우선
        override = meta.get('featured_no')
        if override:
            e = next((x for x in data if x.get('no') == override), None)
            if e: return self._json({'no': e['no'], 'manual': True, 'entry': e})
        # 2) 기본: 가장 최근 발송 (year, month, source_line)
        data_sorted = sorted(data, key=lambda x: (x.get('year',0), x.get('month',0), x.get('source_line') or 0))
        latest = data_sorted[-1]
        self._json({'no': latest['no'], 'manual': False, 'entry': latest})

    def _put_featured(self, no):
        with LOCK:
            meta = load_json(META, {})
            meta['featured_no'] = no
            save_json(META, meta)
        self._json({'ok': True, 'featured_no': no})


class ReusableTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    with ReusableTCPServer(('127.0.0.1', PORT), Handler) as srv:
        print(f'serving {ROOT} at http://127.0.0.1:{PORT}', flush=True)
        srv.serve_forever()


if __name__ == '__main__':
    main()
