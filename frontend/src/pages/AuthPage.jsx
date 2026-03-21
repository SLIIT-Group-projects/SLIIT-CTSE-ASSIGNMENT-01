import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import AuthSplitView from '../components/AuthSplitView';
import { useToast } from '../components/ToastProvider';
import { PrimaryButton, SecondaryButton } from '../components/ui';

import loginIllustration from '../assets/hospital-login-illustration.svg';
import registerIllustration from '../assets/hospital-register-illustration.svg';

const roles = ['PATIENT', 'DOCTOR', 'LAB_TECH', 'ADMIN'];

export default function AuthPage({ initialMode }) {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { notify } = useToast();

  const [mode, setMode] = useState(initialMode);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Register state
  const [name, setName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [role, setRole] = useState('PATIENT');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState('');
  const [registerFieldErrors, setRegisterFieldErrors] = useState({});

  const loginImage = useMemo(
    () => <img src={loginIllustration} alt="Hospital login illustration" className="w-full max-w-md mx-auto" />,
    []
  );

  const registerImage = useMemo(
    () => (
      <img
        src={registerIllustration}
        alt="Hospital register illustration"
        className="w-full max-w-md mx-auto"
      />
    ),
    []
  );

  // UI-only toggle (no route navigation) so refresh keeps the original URL view.
  function onSwitchToRegister() {
    setMode('register');
  }

  function onSwitchToLogin() {
    setMode('login');
  }

  async function onLoginSubmit(e) {
    e.preventDefault();
    setLoginError('');
    try {
      const resp = await authApi.post('/auth/login', { email: loginEmail, password: loginPassword });
      login(resp.data.token);
      notify('Login successful', 'success');
      navigate('/dashboard');
    } catch (err) {
      setLoginError(err?.response?.data?.message || 'Login failed');
      notify('Login failed', 'error');
    }
  }

  async function onRegisterSubmit(e) {
    e.preventDefault();
    setRegisterError('');
    setRegisterSuccess('');
    setRegisterFieldErrors({});

    const fieldErrors = {};
    if (!name || name.trim().length < 2) fieldErrors.name = 'Name must be at least 2 characters.';
    if (!registerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registerEmail)) {
      fieldErrors.email = 'Enter a valid email address.';
    }
    if (!registerPassword || registerPassword.length < 8) {
      fieldErrors.password = 'Password must be at least 8 characters.';
    }
    if (!roles.includes(role)) fieldErrors.role = 'Invalid role selected.';
    if (Object.keys(fieldErrors).length > 0) {
      setRegisterFieldErrors(fieldErrors);
      setRegisterError('Please correct the highlighted fields.');
      return;
    }

    try {
      const payload = { name, email: registerEmail, password: registerPassword, role };
      await authApi.post('/auth/register', payload);
      setRegisterSuccess('Account created. Please login.');
      notify('Account created successfully', 'success');
      window.setTimeout(() => onSwitchToLogin(), 500);
    } catch (err) {
      const apiData = err?.response?.data;
      if (apiData?.errors?.fieldErrors) {
        const be = apiData.errors.fieldErrors;
        setRegisterFieldErrors({
          ...(be.name?.[0] ? { name: be.name[0] } : {}),
          ...(be.email?.[0] ? { email: be.email[0] } : {}),
          ...(be.password?.[0] ? { password: be.password[0] } : {}),
          ...(be.role?.[0] ? { role: be.role[0] } : {}),
        });
      }
      setRegisterError(apiData?.message || 'Registration failed');
      notify('Registration failed', 'error');
    }
  }

  return (
    <AuthSplitView
      mode={mode}
      onSwitchToLogin={onSwitchToLogin}
      onSwitchToRegister={onSwitchToRegister}
      loginImage={loginImage}
      registerImage={registerImage}
      renderLogin={({ onSwitchToRegister: sw }) => (
        <div className="animate-fade-in">
          <div className="mb-4">
            <div className="text-xs font-semibold tracking-wider text-blue-700 uppercase">Login</div>
            <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Welcome back</div>
            <div className="mt-1 text-sm text-slate-600">Sign in to access your hospital account.</div>
          </div>

          {loginError ? (
            <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">
              {loginError}
            </div>
          ) : null}

          <form onSubmit={onLoginSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input
                className="input-modern"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                type="email"
                autoComplete="email"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Password</label>
              <input
                className="input-modern"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                required
              />
            </div>

            <PrimaryButton className="w-full" type="submit">
              Sign in
            </PrimaryButton>
          </form>

          <div className="mt-6">
            <SecondaryButton
              type="button"
              className="w-full"
              onClick={() => sw()}
            >
              Create an account
            </SecondaryButton>
          </div>
        </div>
      )}
      renderRegister={({ onSwitchToLogin: sw }) => (
        <div className="animate-fade-in">
          <div className="mb-4">
            <div className="text-xs font-semibold tracking-wider text-blue-700 uppercase">Register</div>
            <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Create your role</div>
            <div className="mt-1 text-sm text-slate-600">Choose PATIENT, DOCTOR, LAB_TECH, or ADMIN.</div>
          </div>

          {registerError ? (
            <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">
              {registerError}
            </div>
          ) : null}
          {registerSuccess ? (
            <div className="mb-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 px-3 py-2 rounded">
              {registerSuccess}
            </div>
          ) : null}

          <form onSubmit={onRegisterSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Name</label>
              <input
                className="input-modern"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              {registerFieldErrors.name ? (
                <div className="mt-1 text-xs text-red-600">{registerFieldErrors.name}</div>
              ) : null}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input
                className="input-modern"
                value={registerEmail}
                onChange={(e) => setRegisterEmail(e.target.value)}
                type="email"
                autoComplete="email"
                required
              />
              {registerFieldErrors.email ? (
                <div className="mt-1 text-xs text-red-600">{registerFieldErrors.email}</div>
              ) : null}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Role</label>
              <select
                className="input-modern"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {registerFieldErrors.role ? (
                <div className="mt-1 text-xs text-red-600">{registerFieldErrors.role}</div>
              ) : null}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Password</label>
              <input
                className="input-modern"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
                required
              />
              {registerFieldErrors.password ? (
                <div className="mt-1 text-xs text-red-600">{registerFieldErrors.password}</div>
              ) : (
                <div className="mt-1 text-xs text-slate-500">Use at least 8 characters.</div>
              )}
            </div>

            <PrimaryButton className="w-full" type="submit">
              Create account
            </PrimaryButton>
          </form>

          <div className="mt-6">
            <SecondaryButton
              type="button"
              className="w-full"
              onClick={() => sw()}
            >
              Back to login
            </SecondaryButton>
          </div>
        </div>
      )}
    />
  );
}

