import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function RequireRole({ roles, children }) {
  const { token, user, loading } = useAuth();

  if (!token) return <Navigate to="/login" replace />;
  if (loading || !user) return <div className="p-6 text-sm text-gray-600">Loading...</div>;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;

  return children;
}

