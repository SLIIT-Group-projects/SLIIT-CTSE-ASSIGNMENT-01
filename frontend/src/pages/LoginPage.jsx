import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const resp = await authApi.post('/auth/login', { email, password });
      login(resp.data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err?.response?.data?.message || 'Login failed');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-sky-50 via-white to-white">
      <div className="w-full max-w-md bg-white shadow-lg ring-1 ring-slate-900/5 rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-11 w-11 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">H</div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Login</h1>
            <p className="text-sm text-slate-600">Access your hospital account.</p>
          </div>
        </div>

        {error ? <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">{error}</div> : null}

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="text-sm font-medium text-slate-700">Email</label>
            <input
              className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Password</label>
            <input
              className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

        <div className="mt-5 text-center text-sm text-slate-600">
          New here?{" "}
          <a className="text-blue-700 hover:text-blue-800 font-medium" href="/register">
            Create account
          </a>
        </div>
      </div>
    </div>
  );
}

