import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/client';

const roles = ['PATIENT', 'DOCTOR', 'LAB_TECH', 'ADMIN'];

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('PATIENT');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await authApi.post('/auth/register', { name, email, password, role });
      setSuccess('Account created. Please login.');
      setTimeout(() => navigate('/login'), 700);
    } catch (err) {
      setError(err?.response?.data?.message || 'Registration failed');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-sky-50 via-white to-white">
      <div className="w-full max-w-md bg-white shadow-lg ring-1 ring-slate-900/5 rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-11 w-11 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">H</div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Register</h1>
            <p className="text-sm text-slate-600">Create your account for the hospital system.</p>
          </div>
        </div>

        {error ? <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">{error}</div> : null}
        {success ? <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded">{success}</div> : null}

        <form onSubmit={onSubmit} className="space-y-5">
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

        <div className="mt-5 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <a className="text-blue-700 hover:text-blue-800 font-medium" href="/login">
            Sign in
          </a>
        </div>
      </div>
    </div>
  );
}

