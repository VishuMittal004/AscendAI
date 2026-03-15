import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { login, register } from '../services/api';

const Login = ({ onLogin }) => {
    const [mode, setMode] = useState('login'); // 'login' | 'register' | 'verify-sent'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!email.trim() || !password.trim()) return;
        setError('');
        setLoading(true);
        try {
            const data = await login(email, password);
            onLogin(data);
        } catch (err) {
            const msg = err.response?.data?.detail || 'Login failed. Please try again.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        if (!username.trim() || !email.trim() || !password.trim()) return;
        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            await register(username, email, password);
            setSuccessMsg('Account created! Try logging in again.');
            setPassword(''); // Clear password field for safety
            setMode('login');
        } catch (err) {
            const detail = err.response?.data?.detail;
            const msg = Array.isArray(detail)
                ? detail.map(d => d.msg || d).join(', ')
                : (detail || 'Registration failed. Please try again.');
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const switchMode = (newMode) => {
        setMode(newMode);
        setError('');
        setSuccessMsg('');
        setEmail('');
        setPassword('');
        setUsername('');
    };

    return (
        <div className="min-h-screen flex items-center justify-center animated-bg px-6">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full max-w-md glass-card p-10 gradient-border shadow-2xl relative overflow-hidden"
            >
                {/* Decorative blobs */}
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>

                {/* Logo */}
                <div className="text-center mb-8 relative z-10">
                    <motion.img
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        src="/assets/images/AscenAI logo.png"
                        alt="AscendAI Logo"
                        className="w-16 h-16 mx-auto mb-4 object-contain drop-shadow-xl"
                    />
                    <motion.h1
                        initial={{ y: -10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="text-3xl font-bold tracking-tight text-white mb-1"
                    >
                        AscendAI
                    </motion.h1>
                    <motion.p
                        initial={{ y: -10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="text-sm text-gray-400"
                    >
                        {mode === 'register' ? 'Create your account' : 'Sign in to your account'}
                    </motion.p>
                </div>

                <AnimatePresence mode="wait">
                    {/* Login Form */}
                    {mode === 'login' && (
                        <motion.form
                            key="login"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            onSubmit={handleLogin}
                            className="space-y-5 relative z-10"
                        >
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="px-4 py-3 rounded-xl text-sm text-red-400 border border-red-500/30"
                                    style={{ background: 'rgba(239,68,68,0.08)' }}
                                >
                                    {error}
                                </motion.div>
                            )}
                            {successMsg && !error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="px-4 py-3 rounded-xl text-sm text-green-400 border border-green-500/30 mb-4"
                                    style={{ background: 'rgba(34,197,94,0.08)' }}
                                >
                                    {successMsg}
                                </motion.div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Email</label>
                                <input
                                    type="email"
                                    className="w-full px-4 py-4 rounded-xl border transition-all duration-300 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-base"
                                    style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'var(--border)' }}
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Password</label>
                                <input
                                    type="password"
                                    className="w-full px-4 py-4 rounded-xl border transition-all duration-300 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-base"
                                    style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'var(--border)' }}
                                    placeholder="Your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                type="submit"
                                disabled={loading || !email.trim() || !password.trim()}
                                className="w-full btn-primary py-4 text-base font-semibold tracking-wide rounded-xl shadow-lg mt-2 flex justify-center items-center gap-2"
                            >
                                {loading ? (
                                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : 'Sign In'}
                            </motion.button>
                            <p className="text-center text-sm text-gray-500 pt-1">
                                Don't have an account?{' '}
                                <button type="button" onClick={() => switchMode('register')} className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                                    Create one
                                </button>
                            </p>
                        </motion.form>
                    )}

                    {/* Register Form */}
                    {mode === 'register' && (
                        <motion.form
                            key="register"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            onSubmit={handleRegister}
                            className="space-y-4 relative z-10"
                        >
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="px-4 py-3 rounded-xl text-sm text-red-400 border border-red-500/30"
                                    style={{ background: 'rgba(239,68,68,0.08)' }}
                                >
                                    {error}
                                </motion.div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Username</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-3.5 rounded-xl border transition-all duration-300 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                    style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'var(--border)' }}
                                    placeholder="e.g. john_doe"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Email</label>
                                <input
                                    type="email"
                                    className="w-full px-4 py-3.5 rounded-xl border transition-all duration-300 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                    style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'var(--border)' }}
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Password</label>
                                <input
                                    type="password"
                                    className="w-full px-4 py-3.5 rounded-xl border transition-all duration-300 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                    style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'var(--border)' }}
                                    placeholder="Min. 6 characters"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                type="submit"
                                disabled={loading || !username.trim() || !email.trim() || !password.trim()}
                                className="w-full btn-primary py-4 text-base font-semibold tracking-wide rounded-xl shadow-lg mt-2 flex justify-center items-center gap-2"
                            >
                                {loading ? (
                                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : 'Create Account'}
                            </motion.button>
                            <p className="text-center text-sm text-gray-500 pt-1">
                                Already have an account?{' '}
                                <button type="button" onClick={() => switchMode('login')} className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                                    Sign in
                                </button>
                            </p>
                        </motion.form>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default Login;
