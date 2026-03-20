import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import AuthSplitView from '../components/AuthSplitView';

import loginIllustration from '../assets/hospital-login-illustration.svg';
import registerIllustration from '../assets/hospital-register-illustration.svg';

const roles = ['PATIENT', 'DOCTOR', 'LAB_TECH', 'ADMIN'];

export default function AuthPage({ initialMode }) {
  const navigate = useNavigate();
  const { login } = useAuth();

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
      navigate('/dashboard');
    } catch (err) {
      setLoginError(err?.response?.data?.message || 'Login failed');
    }
  }

  async function onRegisterSubmit(e) {
    e.preventDefault();
    setRegisterError('');
    setRegisterSuccess('');
    try {
      await authApi.post('/auth/register', { name, email: registerEmail, password: registerPassword, role });
      setRegisterSuccess('Account created. Please login.');
      window.setTimeout(() => onSwitchToLogin(), 500);
    } catch (err) {
      setRegisterError(err?.response?.data?.message || 'Registration failed');
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
        <div>
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
                className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                required
              />
            </div>

            <button
              className="w-full bg-blue-600 text-white py-2.5 rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              type="submit"
            >
              Sign in
            </button>
          </form>

          <div className="mt-6">
            <button
              type="button"
              className="w-full text-sm font-semibold text-blue-700 hover:text-blue-800 underline"
              onClick={() => sw()}
            >
              Create an account
            </button>
          </div>
        </div>
      )}
      renderRegister={({ onSwitchToLogin: sw }) => (
        <div>
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
                className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input
                className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={registerEmail}
                onChange={(e) => setRegisterEmail(e.target.value)}
                type="email"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Role</label>
              <select
                className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Password</label>
              <input
                className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
                required
              />
            </div>

            <button
              className="w-full bg-blue-600 text-white py-2.5 rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              type="submit"
            >
              Create account
            </button>
          </form>

          <div className="mt-6">
            <button
              type="button"
              className="w-full text-sm font-semibold text-blue-700 hover:text-blue-800 underline"
              onClick={() => sw()}
            >
              Back to login
            </button>
          </div>
        </div>
      )}
    />
  );
}

