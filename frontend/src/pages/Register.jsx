import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';

const STEPS = ['Account', 'Profile'];

const INITIAL = {
  role: 'student',
  email: '', password: '', confirmPassword: '',
  name: '', gender: 'male',
  grade: '', section: '', academic_year: '2024/25', semester: 'Semester 1',
  department: '',
};

export default function Register() {
  const { user, setSession }   = useAuth();
  const navigate              = useNavigate();
  const [step, setStep]       = useState(0);
  const [form, setForm]       = useState(INITIAL);
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState({});

  if (user) return <Navigate to={`/${user.role}/dashboard`} replace />;

  const set = (field, value) => {
    setForm((p) => ({ ...p, [field]: value }));
    setErrors((p) => ({ ...p, [field]: '' }));
  };

  // ── Validation per step ──────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (step === 0) {
      if (!form.email)                         e.email    = 'Email is required';
      else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email';
      if (!form.password)                      e.password = 'Password is required';
      else if (form.password.length < 6)       e.password = 'Minimum 6 characters';
      if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    }
    if (step === 1) {
      if (form.role === 'student' || form.role === 'teacher') {
        if (!form.name)    e.name    = 'Full name is required';
      }
      if (form.role === 'student') {
        if (!form.grade)   e.grade   = 'Grade is required';
        if (!form.section) e.section = 'Section is required';
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validate()) setStep((s) => s + 1); };
  const back = () => setStep((s) => s - 1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const payload = {
        email:    form.email,
        password: form.password,
        role:     form.role,
        ...(form.role !== 'admin' ? { name: form.name } : {}),
        ...(form.role === 'student'
          ? {
              gender: form.gender,
              grade: form.grade,
              section: form.section,
              academic_year: form.academic_year,
              semester: form.semester,
            }
          : {}),
        ...(form.role === 'teacher' ? { department: form.department } : {}),
      };

      const { data } = await api.post('/auth/register', payload);

      // Populate auth state directly from the register response.
      setSession(data.token, data.user);

      toast.success(`Welcome, ${data.user.name}! Account created.`);
      navigate(`/${data.user.role}/dashboard`, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700
                    flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl
                          bg-white/20 backdrop-blur-sm mb-3">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={2}>
              <path d="M12 14l9-5-9-5-9 5 9 5z" />
              <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">SARMS</h1>
          <p className="text-blue-200 text-xs mt-0.5">Create your account</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">

          {/* Step indicator */}
          <div className="flex items-center mb-8">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center
                                  text-sm font-bold transition-colors ${
                    i < step  ? 'bg-green-500 text-white' :
                    i === step ? 'bg-blue-600 text-white' :
                                 'bg-gray-100 text-gray-400'
                  }`}>
                    {i < step ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                           stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : i + 1}
                  </div>
                  <span className={`text-xs mt-1 font-medium ${
                    i === step ? 'text-blue-600' : 'text-gray-400'
                  }`}>{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 mb-4 transition-colors ${
                    i < step ? 'bg-green-400' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>

          <form onSubmit={step === 1 ? handleSubmit : (e) => { e.preventDefault(); next(); }}>

            {/* ── Step 0: Account ──────────────────────────────────── */}
            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Account details</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Your login credentials</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Register as</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'student', label: 'Student' },
                      { value: 'teacher', label: 'Teacher' },
                      { value: 'admin', label: 'Admin' },
                    ].map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => set('role', r.value)}
                        className={`py-2 rounded-lg border text-sm font-medium capitalize
                                    transition-colors ${
                          form.role === r.value
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                  <input
                    type="email" className={`input ${errors.email ? 'border-red-400' : ''}`}
                    placeholder="you@example.com" autoFocus
                    value={form.email} onChange={(e) => set('email', e.target.value)}
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      className={`input pr-10 ${errors.password ? 'border-red-400' : ''}`}
                      placeholder="Min. 6 characters"
                      value={form.password} onChange={(e) => set('password', e.target.value)}
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPw ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
                  <input
                    type="password"
                    className={`input ${errors.confirmPassword ? 'border-red-400' : ''}`}
                    placeholder="Repeat your password"
                    value={form.confirmPassword} onChange={(e) => set('confirmPassword', e.target.value)}
                  />
                  {errors.confirmPassword && (
                    <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
                  )}
                </div>
              </div>
            )}

            {/* ── Step 1: Profile ──────────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">
                    {form.role === 'student' ? 'Student profile' :
                     form.role === 'teacher' ? 'Teacher profile' :
                     'Administrator'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {form.role === 'admin'
                      ? 'No additional profile details are required.'
                      : 'Tell us about yourself'}
                  </p>
                </div>

                {(form.role === 'student' || form.role === 'teacher') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                    <input
                      className={`input ${errors.name ? 'border-red-400' : ''}`}
                      placeholder="e.g. Kaleb Tesfaye" autoFocus
                      value={form.name} onChange={(e) => set('name', e.target.value)}
                    />
                    {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                  </div>
                )}

                {form.role === 'teacher' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                    <input
                      className="input"
                      placeholder="e.g. Mathematics"
                      value={form.department} onChange={(e) => set('department', e.target.value)}
                    />
                  </div>
                )}

                {form.role === 'student' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['male', 'female', 'other'].map((g) => (
                          <button key={g} type="button"
                            onClick={() => set('gender', g)}
                            className={`py-2 rounded-lg border text-sm font-medium capitalize
                                        transition-colors ${
                              form.gender === g
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}>
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
                        <input
                          className={`input ${errors.grade ? 'border-red-400' : ''}`}
                          placeholder="e.g. 10"
                          value={form.grade} onChange={(e) => set('grade', e.target.value)}
                        />
                        {errors.grade && <p className="text-red-500 text-xs mt-1">{errors.grade}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                        <input
                          className={`input ${errors.section ? 'border-red-400' : ''}`}
                          placeholder="e.g. A"
                          value={form.section} onChange={(e) => set('section', e.target.value)}
                        />
                        {errors.section && <p className="text-red-500 text-xs mt-1">{errors.section}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
                        <input
                          className="input" placeholder="e.g. 2024/25"
                          value={form.academic_year}
                          onChange={(e) => set('academic_year', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                        <select className="input" value={form.semester}
                          onChange={(e) => set('semester', e.target.value)}>
                          <option>Semester 1</option>
                          <option>Semester 2</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Navigation buttons ───────────────────────────────── */}
            <div className={`flex gap-3 mt-8 ${step > 0 ? 'justify-between' : ''}`}>
              {step > 0 && (
                <button type="button" onClick={back} className="btn-secondary px-6">
                  ← Back
                </button>
              )}

              {step < 1 ? (
                <button type="submit" className="btn-primary px-6 w-full">
                  Continue →
                </button>
              ) : (
                <button type="submit" disabled={loading} className="btn-primary flex-1 py-2.5">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10"
                          stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Creating account…
                    </span>
                  ) : 'Create Account'}
                </button>
              )}
            </div>
          </form>

          {/* Login link */}
          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
