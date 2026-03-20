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
    <div className="max-w-md mx-auto bg-white border border-gray-200 rounded-lg p-6">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Register</h1>
      <p className="text-sm text-gray-600 mb-5">Create your account for the hospital system.</p>

      {error ? <div className="mb-4 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="mb-4 text-sm text-green-700">{success}</div> : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="text-sm text-gray-700">Name</label>
          <input className="mt-1 w-full border border-gray-300 rounded px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
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
          <label className="text-sm text-gray-700">Role</label>
          <select className="mt-1 w-full border border-gray-300 rounded px-3 py-2" value={role} onChange={(e) => setRole(e.target.value)} required>
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-700">Password</label>
          <input
            className="mt-1 w-full border border-gray-300 rounded px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            required
          />
        </div>
        <button className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700" type="submit">
          Create account
        </button>
      </form>
    </div>
  );
}

