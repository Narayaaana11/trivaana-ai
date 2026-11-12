import React, { useState } from 'react';
import { trivaanaApi } from '@/lib/trivaana-api';
import { Lock, Mail, User, Building, X, AlertCircle, LogIn, UserPlus, CheckCircle2, KeyRound } from 'lucide-react';
import { TrivaanaLogo } from '@/components/brand/TrivaanaLogo';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>(initialMode);
  const [prevOpen, setPrevOpen] = useState(isOpen);
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      setMode(initialMode);
    }
  }
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await trivaanaApi.login({ email, password });
        onSuccess();
        onClose();
      } else if (mode === 'register') {
        await trivaanaApi.register({
          email,
          password,
          full_name: fullName,
          organization_name: orgName || undefined,
        });
        onSuccess();
        onClose();
      } else if (mode === 'forgot') {
        const res = await trivaanaApi.requestPasswordReset(email);
        const tok = res?.dev_reset_token || res?.reset_token;
        if (tok) {
          setResetToken(tok);
        }
        setNotice(res?.message || 'If your email exists, a reset token has been issued.');
        setMode('reset');
      } else if (mode === 'reset') {
        await trivaanaApi.confirmPasswordReset(resetToken, password);
        setPassword('');
        setResetToken('');
        setNotice('Password updated. You can now sign in with your new password.');
        setMode('login');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <TrivaanaLogo size={32} showText={false} />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {mode === 'login'
                  ? 'Sign In to Trivaana AI'
                  : mode === 'register'
                  ? 'Create Workspace Account'
                  : mode === 'forgot'
                  ? 'Reset Your Password'
                  : 'Enter Reset Token & New Password'}
              </h2>
              <p className="text-xs text-slate-500">
                {mode === 'login'
                  ? 'Access your voice AI campaigns & calling logs'
                  : mode === 'register'
                  ? 'Setup your isolated multi-tenant enterprise workspace'
                  : 'Recover access to your Trivaana AI workspace'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-emerald-800 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{notice}</span>
            </div>
          )}

          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Venkata Krishna"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Organization / Workspace Name</label>
                <div className="relative">
                  <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Sri Sai Real Estate & Infra"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition"
                  />
                </div>
              </div>
            </>
          )}

          {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="founder@company.in"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition"
                />
              </div>
            </div>
          )}

          {mode === 'reset' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reset Token</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="Paste reset token"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition"
                />
              </div>
            </div>
          )}

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  {mode === 'reset' ? 'New Password' : 'Password'}
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setNotice(null);
                      setMode('forgot');
                    }}
                    className="text-[11px] text-orange-600 hover:underline font-semibold cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm rounded-xl transition shadow-md shadow-orange-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-block animate-spin mr-1">⏳</span>
            ) : mode === 'login' ? (
              <LogIn className="w-4 h-4" />
            ) : mode === 'register' ? (
              <UserPlus className="w-4 h-4" />
            ) : (
              <KeyRound className="w-4 h-4" />
            )}
            <span>
              {mode === 'login'
                ? 'Sign In'
                : mode === 'register'
                ? 'Create Account'
                : mode === 'forgot'
                ? 'Send Reset Token'
                : 'Confirm Password Reset'}
            </span>
          </button>

          <div className="text-center pt-2 space-x-3">
            {mode === 'forgot' || mode === 'reset' ? (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setNotice(null);
                  setMode('login');
                }}
                className="text-xs text-slate-600 hover:text-orange-600 font-medium transition cursor-pointer"
              >
                Back to Sign In
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setNotice(null);
                  setMode(mode === 'login' ? 'register' : 'login');
                }}
                className="text-xs text-slate-600 hover:text-orange-600 font-medium transition cursor-pointer"
              >
                {mode === 'login'
                  ? "Don't have an account? Create new workspace"
                  : 'Already have an account? Sign in'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
