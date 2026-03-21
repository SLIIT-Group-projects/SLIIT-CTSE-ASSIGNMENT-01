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
  const isLogin = mode === 'login';

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#c9f2ea] via-[#e8f6ff] to-[#f7fefe] px-4 py-8 md:py-12">
      <div className="pointer-events-none absolute -left-16 -top-24 h-80 w-80 rounded-full bg-[#14967F]/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-10 h-72 w-72 rounded-full bg-blue-300/30 blur-3xl" />

      <div className="relative mx-auto flex min-h-[82vh] w-full max-w-6xl items-center">
        <div className="grid w-full grid-cols-1 overflow-hidden rounded-3xl bg-white/80 shadow-2xl shadow-[#14967F]/10 ring-1 ring-white/70 backdrop-blur lg:grid-cols-2">
          <div className="bg-gradient-to-br from-white to-[#ecfaf6] p-8 lg:p-12">
            <div className="max-w-md">
              <div className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#14967F] ring-1 ring-[#14967F]/20">
                Healthcare SaaS
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                {isLogin ? 'Connected care starts here.' : 'Create your secure access.'}
              </h1>
              <p className="mt-3 text-sm text-slate-600 md:text-base">
                Unified access for appointments, billing, clinical workflows, and lab operations.
              </p>
            </div>
            <div className="mt-8">{isLogin ? loginImage : registerImage}</div>
          </div>

          <div className="p-6 md:p-10 lg:p-12">
            <div className="card-glass">
              {isLogin ? renderLogin({ onSwitchToRegister }) : renderRegister({ onSwitchToLogin })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

