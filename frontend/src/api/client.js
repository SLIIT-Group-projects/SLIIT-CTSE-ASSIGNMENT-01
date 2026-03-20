import axios from 'axios';

function authHeader() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function withAuth(instance) {
  instance.interceptors.request.use((config) => {
    const hdrs = authHeader();
    config.headers = { ...(config.headers || {}), ...hdrs };
    return config;
  });
  return instance;
}

export const authApi = axios.create({
  baseURL: process.env.REACT_APP_AUTH_URL,
});

export const appointmentApi = withAuth(
  axios.create({
    baseURL: process.env.REACT_APP_APPOINTMENT_URL,
  })
);

export const doctorApi = withAuth(
  axios.create({
    baseURL: process.env.REACT_APP_DOCTOR_URL,
  })
);

export const labApi = withAuth(
  axios.create({
    baseURL: process.env.REACT_APP_LAB_URL,
  })
);

export const billingApi = withAuth(
  axios.create({
    baseURL: process.env.REACT_APP_BILLING_URL,
  })
);

