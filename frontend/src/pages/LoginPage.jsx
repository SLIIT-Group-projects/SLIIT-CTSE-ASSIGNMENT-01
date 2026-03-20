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
    <div className="max-w-md mx-auto bg-white border border-gray-200 rounded-lg p-6">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Login</h1>
      <p className="text-sm text-gray-600 mb-5">Access your hospital account.</p>

      {error ? <div className="mb-4 text-sm text-red-700">{error}</div> : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="text-sm text-gray-700">Email</label>
          <input
            className="mt-1 w-full border border-gray-300 rounded px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label className="text-sm text-gray-700">Password</label>
          <input
            className="mt-1 w-full border border-gray-300 rounded px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <button
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          type="submit"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}

