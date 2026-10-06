import { useToast } from '../../context/Toast';
import { ApiError, ERROR_CODES, errorToast } from '../../lib/errors';
import { MapMsg } from '../../components/ui';

const SERVER_MESSAGES = { VALIDATION_ERROR: '입력한 값을 다시 확인해 주세요.' };
const sample = (code) => new ApiError({ code, message: SERVER_MESSAGES[code] ?? null, requestId: 'req_7f3a9c1e2b' });

const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: '1px solid var(--line)' };
const box = { position: 'relative', height: 200, borderRadius: 12, overflow: 'hidden' };

export default function ErrorPreview() {
  const toast = useToast();
  const fire = (code) => toast.error(sample(code), { onRetry: () => toast.show({ message: '다시 시도를 눌렀어요' }) });

  return (
    <main className="page" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720, margin: '0 auto', padding: '24px 16px 120px' }}>
      <h1 style={{ fontSize: 20 }}>오류 상태 미리보기</h1>

      <section className="card" style={{ padding: 16 }}>
        <h2 style={{ fontSize: 15, marginBottom: 10 }}>오류 코드별 토스트</h2>
        {ERROR_CODES.map((code) => {
          const t = errorToast(sample(code));
          return (
            <div key={code} style={row}>
              <span style={{ fontSize: 13, lineHeight: 1.5 }}>
                <b>{code}</b><br />
                <span style={{ color: 'var(--muted)' }}>{t ? `${t.message}${t.retry ? ' · [다시 시도]' : ''}` : '토스트 없음'}</span>
              </span>
              <button type="button" className="btn-ghost" style={{ height: 38, flex: 'none' }} disabled={!t} onClick={() => fire(code)}>띄우기</button>
            </div>
          );
        })}
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h2 style={{ fontSize: 15, marginBottom: 10 }}>그 밖의 토스트</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn-ghost" onClick={() => toast.error('DB_UNAVAILABLE', { message: '용산구 지원 사업 정보를 아직 불러오지 못했어요. 잠시 후 다시 시도해 주세요' })}>2단계 다시 시도 실패</button>
        </div>
      </section>

      <section className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 style={{ fontSize: 15 }}>지도 로딩 · 실패</h2>
        <div style={box}><MapMsg /></div>
        <div style={box}><MapMsg error="network" onRetry={() => {}} /></div>
        <div style={box}><MapMsg error="server" onRetry={() => {}} /></div>
      </section>
    </main>
  );
}
