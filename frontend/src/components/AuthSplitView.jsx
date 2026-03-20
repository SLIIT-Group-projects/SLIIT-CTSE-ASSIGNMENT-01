import React from 'react';

/**
 * Two-panel auth UI with animated swap:
 * - In `login` mode: left = login image, right = login form
 * - In `register` mode: left = register form, right = register image
 */
export default function AuthSplitView({
  mode,
  onSwitchToLogin,
  onSwitchToRegister,
  renderLogin,
  renderRegister,
  loginImage,
  registerImage,
}) {
  const TRANSITION_MS = 700;

  const loginImageOffset = mode === 'login' ? 0 : -100;
  const loginFormOffset = mode === 'login' ? 100 : 200;
  const registerFormOffset = mode === 'register' ? 0 : -100;
  const registerImageOffset = mode === 'register' ? 100 : 200;

  const panelStyle = (offset, visible) => ({
    transform: `translateX(${offset}%)`,
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? 'auto' : 'none',
    transitionDuration: `${TRANSITION_MS}ms`,
  });

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="relative w-full max-w-6xl min-h-[640px] rounded-3xl overflow-hidden shadow-xl ring-1 ring-slate-200 bg-white">
        {/* Left: Login Image */}
        <div
          className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-br from-blue-50 via-white to-white transition-all duration-700 ease-in-out p-10 flex flex-col justify-center"
          style={panelStyle(loginImageOffset, mode === 'login')}
        >
          <div className="max-w-md">
            <div className="text-xs font-semibold tracking-wider text-blue-700 uppercase">Hospital Portal</div>
            <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Care, confirmed payments, and records.</div>
            <div className="mt-3 text-sm text-slate-600">
              A secure workflow for appointments, billing verification, lab payments, and report uploads.
            </div>
          </div>
          <div className="mt-8">{loginImage}</div>

          <div className="mt-10">
            <button
              type="button"
              className="text-sm font-semibold text-blue-700 hover:text-blue-800 underline"
              onClick={onSwitchToRegister}
            >
              Create an account
            </button>
          </div>
        </div>

        {/* Right: Login Form */}
        <div
          className="absolute top-0 left-0 w-1/2 h-full p-10 bg-white transition-all duration-700 ease-in-out flex items-center justify-center"
          style={panelStyle(loginFormOffset, mode === 'login')}
        >
          <div className="w-full max-w-md">
            {renderLogin({ onSwitchToRegister })}
          </div>
        </div>

        {/* Left: Register Form */}
        <div
          className="absolute top-0 left-0 w-1/2 h-full p-10 bg-white transition-all duration-700 ease-in-out flex items-center justify-center"
          style={panelStyle(registerFormOffset, mode === 'register')}
        >
          <div className="w-full max-w-md">
            {renderRegister({ onSwitchToLogin })}
          </div>
        </div>

        {/* Right: Register Image */}
        <div
          className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-br from-blue-50 via-white to-white transition-all duration-700 ease-in-out p-10 flex flex-col justify-center"
          style={panelStyle(registerImageOffset, mode === 'register')}
        >
          <div className="max-w-md">
            <div className="text-xs font-semibold tracking-wider text-blue-700 uppercase">Join as a role</div>
            <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Patients, Doctors, Lab Tech, Admin.</div>
            <div className="mt-3 text-sm text-slate-600">Your role controls what you can book, upload, verify, and view.</div>
          </div>
          <div className="mt-8">{registerImage}</div>

          <div className="mt-10">
            <button
              type="button"
              className="text-sm font-semibold text-blue-700 hover:text-blue-800 underline"
              onClick={onSwitchToLogin}
            >
              Already have an account?
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

