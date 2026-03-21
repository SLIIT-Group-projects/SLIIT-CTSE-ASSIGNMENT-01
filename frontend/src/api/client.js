import axios from "axios";

const gatewayBase =
  process.env.REACT_APP_API_GATEWAY_URL || "http://localhost:4000";

function serviceBase(envUrl, gatewayPrefix) {
  return envUrl || `${gatewayBase}/${gatewayPrefix}`;
}

function authHeader() {
  const token = localStorage.getItem("token");
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
  baseURL: serviceBase(process.env.REACT_APP_AUTH_URL, "auth-service"),
});

export const appointmentApi = withAuth(
  axios.create({
    baseURL: serviceBase(
      process.env.REACT_APP_APPOINTMENT_URL,
      "appointment-service",
    ),
  }),
);

export const doctorApi = withAuth(
  axios.create({
    baseURL: serviceBase(process.env.REACT_APP_DOCTOR_URL, "doctor-service"),
  }),
);

export const labApi = withAuth(
  axios.create({
    baseURL: serviceBase(process.env.REACT_APP_LAB_URL, "lab-service"),
  }),
);

export const billingApi = withAuth(
  axios.create({
    baseURL: serviceBase(process.env.REACT_APP_BILLING_URL, "billing-service"),
  }),
);
