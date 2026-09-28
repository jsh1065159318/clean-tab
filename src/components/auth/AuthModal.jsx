import { useEffect, useRef, useState } from 'react';
import { useToastStore } from 'features/toast/toastStore';
import { authService, getAuthErrorMessage } from 'services/authService';
import { useDialogFocus } from 'features/hooks/useDialogFocus';

const MIN_PASSWORD_LENGTH = 8;

export function AuthModal({ isDark, onClose }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const displayNameRef = useRef(null);
  const emailRef = useRef(null);
  const showToast = useToastStore(state => state.showToast);
  const dialogRef = useDialogFocus(onClose);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      (mode === 'signup' ? displayNameRef.current : emailRef.current)?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mode]);

  const colors = {
    text: isDark ? '#e2e8f0' : '#18244a',
    muted: isDark ? '#94a3b8' : '#64748b',
    surface: isDark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.94)',
    input: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(248,250,252,0.92)',
    border: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.12)',
  };

  const submit = async event => {
    event.preventDefault();
    setError('');

    const normalizedEmail = email.trim();
    const normalizedDisplayName = displayName.trim();
    if (mode === 'signup') {
      if (!normalizedDisplayName) {
        setError('请输入昵称。');
        return;
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(`密码至少需要 ${MIN_PASSWORD_LENGTH} 位字符。`);
        return;
      }
      if (password !== confirmPassword) {
        setError('两次输入的密码不一致。');
        return;
      }
    }

    setBusy(true);

    try {
      if (mode === 'login') {
        await authService.login({ email: normalizedEmail, password });
        showToast('登录成功，正在后台同步数据');
        onClose();
      } else {
        const result = await authService.signUp({
          email: normalizedEmail,
          password,
          displayName: normalizedDisplayName,
        });
        if (!result.session) {
          throw new Error('注册成功但未获得登录会话，请尝试直接登录。');
        }
        showToast('注册成功，已自动登录');
        onClose();
      }
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError, mode === 'login' ? '登录失败，请稍后重试。' : '注册失败，请稍后重试。'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="workspace-settings-overlay" style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <button
        type="button"
        aria-label="关闭登录弹窗"
        style={{ position: 'absolute', inset: 0, padding: 0, border: 0, background: 'rgba(15,23,42,0.42)', backdropFilter: 'blur(10px)' }}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        aria-labelledby="auth-modal-title"
        aria-modal="true"
        role="dialog"
        tabIndex={-1}
        style={{
          position: 'relative',
          zIndex: 1,
          width: 'min(420px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
          borderRadius: '24px',
          padding: '28px',
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          boxShadow: '0 24px 80px rgba(15,23,42,0.28)',
          color: colors.text,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '22px' }}>
          <div>
            <div id="auth-modal-title" style={{ fontSize: '21px', fontWeight: 800, marginBottom: '6px' }}>{mode === 'login' ? '登录同页' : '创建同页账号'}</div>
            <div style={{ fontSize: '13px', color: colors.muted, lineHeight: 1.6 }}>本地功能始终可用，登录后会在后台同步数据。</div>
          </div>
          <button type="button" onClick={onClose} title="关闭" style={{ width: '32px', height: '32px', border: 'none', borderRadius: '10px', background: colors.input, color: colors.muted, fontSize: '18px', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: '6px', padding: '4px', borderRadius: '12px', background: colors.input, marginBottom: '20px' }}>
          {[
            ['login', '登录'],
            ['signup', '注册'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => { setMode(value); setConfirmPassword(''); setError(''); }}
              style={{ flex: 1, border: 'none', borderRadius: '9px', padding: '9px', background: mode === value ? '#6366f1' : 'transparent', color: mode === value ? 'white' : colors.muted, cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {mode === 'signup' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: '7px', fontSize: '12px', color: colors.muted, fontWeight: 700 }}>
              昵称
            <input ref={displayNameRef} required autoComplete="nickname" maxLength={24} value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="例如：小明" style={inputStyle(colors)} />
            </label>
          )}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '7px', fontSize: '12px', color: colors.muted, fontWeight: 700 }}>
            邮箱
            <input ref={emailRef} required autoComplete="email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" style={inputStyle(colors)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '7px', fontSize: '12px', color: colors.muted, fontWeight: 700 }}>
            密码
            <input required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'signup' ? MIN_PASSWORD_LENGTH : undefined} type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder={mode === 'login' ? '请输入密码' : `至少 ${MIN_PASSWORD_LENGTH} 位字符`} style={inputStyle(colors)} />
          </label>
          {mode === 'signup' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: '7px', fontSize: '12px', color: colors.muted, fontWeight: 700 }}>
              确认密码
              <input required autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder="再次输入密码" style={inputStyle(colors)} />
            </label>
          )}

          {error && <div aria-live="polite" role="alert" style={{ padding: '10px 12px', borderRadius: '10px', color: '#be123c', background: 'rgba(244,63,94,0.1)', fontSize: '12px', lineHeight: 1.5 }}>{error}</div>}

          <button disabled={busy} type="submit" style={{ height: '44px', border: 'none', borderRadius: '12px', background: busy ? '#a5b4fc' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', fontSize: '14px', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>
            {busy ? '处理中...' : mode === 'login' ? '登录' : '注册并继续'}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle = colors => ({
  width: '100%',
  height: '42px',
  borderRadius: '11px',
  border: `1px solid ${colors.border}`,
  background: colors.input,
  color: colors.text,
  padding: '0 12px',
  fontSize: '13px',
});
