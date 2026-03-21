import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import RequireRole from './components/RequireRole';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import AppointmentsPage from './pages/AppointmentsPage';
import DoctorPage from './pages/DoctorPage';
import DoctorDetailsPage from './pages/DoctorDetailsPage';
import LabPage from './pages/LabPage';
import BillingPage from './pages/BillingPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/dashboard"
        element={
          <RequireRole roles={['PATIENT', 'DOCTOR', 'LAB_TECH', 'ADMIN']}>
            <Layout>
              <DashboardPage />
            </Layout>
          </RequireRole>
        }
      />
      <Route
        path="/appointments"
        element={
          <RequireRole roles={['PATIENT']}>
            <Layout>
              <AppointmentsPage />
            </Layout>
          </RequireRole>
        }
      />
      <Route
        path="/doctor"
        element={
          <RequireRole roles={['DOCTOR']}>
            <Layout>
              <DoctorPage />
            </Layout>
          </RequireRole>
        }
      />
      <Route
        path="/doctor/details"
        element={
          <RequireRole roles={['DOCTOR']}>
            <Layout>
              <DoctorDetailsPage />
            </Layout>
          </RequireRole>
        }
      />
      <Route
        path="/lab"
        element={
          <RequireRole roles={['LAB_TECH', 'PATIENT']}>
            <Layout>
              <LabPage />
            </Layout>
          </RequireRole>
        }
      />
      <Route
        path="/billing"
        element={
          <RequireRole roles={['PATIENT']}>
            <Layout>
              <BillingPage />
            </Layout>
          </RequireRole>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireRole roles={['ADMIN']}>
            <Layout>
              <AdminPage />
            </Layout>
          </RequireRole>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
