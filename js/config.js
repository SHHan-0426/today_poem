/* ───────────────────────────────────────────────────────
   사이트 설정 — 외부 서비스 연결 정보
   "방문자 소감" 기능을 인터넷에서 작동시키려면
   아래 supabase 값을 채워 주세요. (자세한 방법은 README)
   ─────────────────────────────────────────────────────── */
window.SITE_CONFIG = {
  supabase: {
    url:     'https://dmxotyhlbbvqntyqkzlc.supabase.co',
    anonKey: 'sb_publishable_U5ctWVomH1eBfLNEvLd94Q_sYzzLHCN',
  },
  /* 관리자(선생님) 답글 권한
     비밀번호의 SHA-256 해시 (원문은 코드에 두지 않음).
     현재 비밀번호: 유하재2026  (#admin 에서 입력해 활성화)
     비밀번호 바꾸려면: 새 비밀번호의 SHA-256 해시를 아래에 붙여넣기 */
  adminPasswordHash: '797b3f4ff05fc016227b82be2fd0f601151721907cc9a4ba7b2cda1eb5167662',
};
