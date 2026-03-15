import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Dashboard from './components/Dashboard';
import StatsPanel from './components/StatsPanel';
import GoalForm from './components/GoalForm';
import QuickNotes from './components/QuickNotes';
import Login from './components/Login';
import SessionHistory from './components/SessionHistory';
import { generatePlan, getStats, addGoalToPlan, resetAll, logout, isTokenStored, getStoredUser, getQuote } from './services/api';

const motivationalMessages = [
    "Discipline whispers when motivation disappears; listen to it and move anyway.",
    "The mind quits first; train it to stay when everything else wants to run.",
    "Progress is built in quiet, stubborn days no one applauds.",
    "Show up daily; greatness is just consistency wearing work boots.",
    "When quitting feels easiest, that is exactly where growth begins.",
    "Motivation starts the fire, discipline keeps the furnace burning.",
    "Your future respects the version of you that refused to stop today.",
    "Hard days are not barriers; they are the training ground of resilience.",
    "Consistency turns ordinary effort into extraordinary results.",
    "Train your mind to stay longer than your excuses.",
    "One disciplined day repeated endlessly becomes unstoppable progress.",
    "The strongest minds win by refusing to negotiate with quitting.",
    "Small daily battles build the warrior inside you.",
    "The difference between dreams and results is disciplined repetition.",
    "Stay longer, work deeper, push past the first urge to stop.",
    "Excellence is just persistence practiced every single day.",
    "When motivation fades, discipline quietly carries the mission forward.",
    "Mastery belongs to those who keep going after the excitement fades.",
    "Every day you continue, quitting becomes weaker.",
    "Your limits move the moment you refuse to obey them.",
    "Build momentum with daily effort; success hates inconsistency.",
    "The mind grows strongest when it survives the days it wanted to quit.",
    "Discipline builds bridges where motivation builds sparks.",
    "Refuse to stop today; tomorrow will thank you loudly.",
    "Progress belongs to the stubborn ones who keep showing up."
];

// Helper to get a stable daily message for the system banner
const getSystemMessage = () => {
    return motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
};

function App() {
    // ─── Auth state ──────────────────────────────────────────────────────────
    const [isAuthenticated, setIsAuthenticated] = useState(() => isTokenStored());
    const [currentUser, setCurrentUser] = useState(() => getStoredUser());

    // ─── AI Toggle state ─────────────────────────────────────────────────────
    const [isLocalAI, setIsLocalAI] = useState(() => {
        const saved = localStorage.getItem('ascendai_local_ai');
        return saved === null ? true : saved === 'true';
    });
    const [aiStatusMessage, setAiStatusMessage] = useState("");
    const [showAIConfirm, setShowAIConfirm] = useState(false);
    const [pendingGen, setPendingGen] = useState(null);

    useEffect(() => {
        localStorage.setItem('ascendai_local_ai', isLocalAI);
    }, [isLocalAI]);

    // ─── UI State ─────────────────────────────────────────────────────────────
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [headerQuote, setHeaderQuote] = useState("");

    // ─── Fetch dynamic AI quote ───────────────────
    useEffect(() => {
        if (!isAuthenticated) return;
        const fetchHeaderQuote = async () => {
            try {
                const data = await getQuote(isLocalAI);
                setHeaderQuote(data.quote);
            } catch (error) {
                console.error("Failed to fetch quote:", error);
            }
        };
        fetchHeaderQuote();
    }, [isAuthenticated, isLocalAI]);

    // ─── Email verification route ───────────────
    const [verifyMessage, setVerifyMessage] = useState('');
    useEffect(() => {
        const path = window.location.pathname;
        const match = path.match(/^\/verify\/(.+)$/);
        if (match) {
            const token = match[1];
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            fetch(`${apiUrl}/auth/verify/${token}`)
                .then(r => r.json())
                .then(data => {
                    setVerifyMessage(data.message || 'Email verified! You can now log in.');
                    window.history.replaceState({}, '', '/');
                })
                .catch(() => setVerifyMessage('Verification failed. The link may have expired.'));
        }
    }, []);

    const [stats, setStats] = useState({
        current_streak: 0,
        longest_streak: 0,
        total_tasks: 0,
        completed_tasks: 0,
        progress_percent: 0,
        total_minutes: 0,
        completed_minutes: 0,
    });

    // Feature: System notification message in main body
    const [message, setMessage] = useState(getSystemMessage());
    const [activeGoal, setActiveGoal] = useState('');

    const authFailCount = React.useRef(0);

    const fetchStats = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const data = await getStats();
            authFailCount.current = 0; // reset on success
            setStats(data);
        } catch (e) {
            if (e.response?.status === 401) {
                authFailCount.current += 1;
                if (authFailCount.current >= 3) {
                    handleLogout();
                }
            }
        }
    }, [isAuthenticated]);

    useEffect(() => {
        fetchStats();
    }, [refreshTrigger, fetchStats]);

    useEffect(() => {
        if (!isAuthenticated) return;
        const interval = setInterval(fetchStats, 2000);
        return () => clearInterval(interval);
    }, [fetchStats, isAuthenticated]);

    // ─── Handlers ──────────────────────────────────────────────────────────────

    const handleLogin = (userData) => {
        setIsAuthenticated(true);
        setCurrentUser({ username: userData.username, email: userData.email });
        setShowProfileMenu(false);
        setRefreshTrigger(prev => prev + 1);
    };

    const handleLogout = () => {
        logout();
        setIsAuthenticated(false);
        setCurrentUser(null);
        setShowProfileMenu(false);
        setStats({
            current_streak: 0, longest_streak: 0, total_tasks: 0,
            completed_tasks: 0, progress_percent: 0,
            total_minutes: 0, completed_minutes: 0,
        });
    };

    // ─── AI Selection Logic ─────────────────────────────────────────────────
    // Priority: 1) File uploaded → Cloud AI  2) Toggle preference  3) If Local + >5 days → confirm

    const resolveAI = (days, file) => {
        // Step 1: File uploaded → always cloud
        if (file) return { useLocal: false, reason: 'file' };
        // Step 2: Toggle set to Cloud → always cloud
        if (!isLocalAI) return { useLocal: false, reason: 'toggle' };
        // Step 3: Toggle is Local but days > 5 → needs confirmation
        if (parseInt(days) > 5) return { useLocal: null, reason: 'confirm' };
        // Step 4: Local AI, short plan
        return { useLocal: true, reason: 'local' };
    };

    const setStatusForAI = (useLocal, file) => {
        if (file) {
            setAiStatusMessage("📎 File uploaded — using CLOUD AI.");
        } else if (!useLocal) {
            setAiStatusMessage("☁️ Using CLOUD AI (OpenRouter).");
        } else {
            setAiStatusMessage("Using MISTRAL 7B for this generation.");
        }
    };

    const executeGenerate = async (goal, days, hours, forceRegenerate, difficulty, includeResources, file, useLocal) => {
        try {
            setGenerating(true);
            setActiveGoal(goal);
            setStatusForAI(useLocal, file);
            setMessage("AI is crafting your personalized learning roadmap...");
            await generatePlan(goal, days, hours, forceRegenerate, difficulty, includeResources, file, useLocal);
            setMessage(`Plan ready! Time to master ${goal}.`);
            setRefreshTrigger(prev => prev + 1);
        } catch (err) {
            const errMsg = err.response?.data?.detail || "Generation failed. Please try again.";
            setMessage(errMsg);
            console.error(err);
        } finally {
            setGenerating(false);
        }
    };

    const executeAddGoal = async (newGoal, days, hours, difficulty, includeResources, file, useLocal) => {
        try {
            setGenerating(true);
            setStatusForAI(useLocal, file);
            setMessage(`Architecting a path to merge ${newGoal} into your current plan...`);
            await addGoalToPlan(newGoal, days, hours, difficulty, includeResources, file, useLocal);
            setActiveGoal(prev => `${prev} & ${newGoal}`);
            setMessage(`Plan updated! Time to master ${newGoal} alongside your ongoing goals.`);
            setRefreshTrigger(prev => prev + 1);
        } catch (err) {
            setMessage("Failed to add goal to plan. Please try again.");
            console.error(err);
        } finally {
            setGenerating(false);
        }
    };

    const handleGenerate = (goal, days, hours, forceRegenerate = false, difficulty = "Intermediate", includeResources = false, file = null) => {
        const { useLocal, reason } = resolveAI(days, file);
        if (reason === 'confirm') {
            setPendingGen({ type: 'generate', args: [goal, days, hours, forceRegenerate, difficulty, includeResources, file] });
            setShowAIConfirm(true);
            return;
        }
        executeGenerate(goal, days, hours, forceRegenerate, difficulty, includeResources, file, useLocal);
    };

    const handleImprovePlan = () => {
        if (activeGoal) handleGenerate(activeGoal, 5, 2, true);
    };

    const handleAddGoal = (newGoal, days, hours, difficulty = "Intermediate", includeResources = false, file = null) => {
        const { useLocal, reason } = resolveAI(days, file);
        if (reason === 'confirm') {
            setPendingGen({ type: 'addGoal', args: [newGoal, days, hours, difficulty, includeResources, file] });
            setShowAIConfirm(true);
            return;
        }
        executeAddGoal(newGoal, days, hours, difficulty, includeResources, file, useLocal);
    };

    const handleAIConfirm = (switchToCloud) => {
        setShowAIConfirm(false);
        if (!pendingGen) return;
        const useLocal = !switchToCloud;
        if (pendingGen.type === 'generate') {
            executeGenerate(...pendingGen.args, useLocal);
        } else {
            executeAddGoal(...pendingGen.args, useLocal);
        }
        setPendingGen(null);
    };

    const handleReset = async () => {
        try {
            setGenerating(true);
            setMessage("Starting a new session...");
            await resetAll();
            setActiveGoal('');
            setRefreshTrigger(prev => prev + 1);
            setMessage("New session started! Your past plan is saved in History.");
        } catch (err) {
            setMessage("Failed to start new session. Please try again.");
            console.error(err);
        } finally {
            setGenerating(false);
        }
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    if (!isAuthenticated) {
        return (
            <AnimatePresence mode="wait">
                {verifyMessage && (
                    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl text-sm font-medium text-green-300 border border-green-500/30"
                        style={{ background: 'rgba(34,197,94,0.1)' }}>
                        {verifyMessage}
                    </div>
                )}
                <Login onLogin={handleLogin} />
            </AnimatePresence>
        );
    }

    return (
        <div className="min-h-screen animated-bg">
            <AnimatePresence>
                {showHistory && <SessionHistory onClose={() => setShowHistory(false)} onRestore={() => setRefreshTrigger(prev => prev + 1)} />}
            </AnimatePresence>

            {/* ─── Header ─── */}
            <header className="border-b sticky top-0 z-40 backdrop-blur-md bg-black/50" style={{ borderColor: 'var(--border)' }}>
                <div className="max-w-[90rem] mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-[200px]">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}>
                            <img src="/assets/images/AscenAI logo.png" alt="AscendAI Logo" className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-white tracking-tight leading-none">AscendAI</h1>
                            <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider font-semibold">AI-Powered Goal Architect</p>
                        </div>
                    </div>

                    {/* AI Toggle & Status Message */}
                    <div className="hidden lg:flex flex-1 flex-col items-center justify-center px-4 gap-1">
                        <div className="flex items-center gap-3 bg-white/5 rounded-full px-4 py-1.5 border border-white/10 shadow-inner">
                            <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${!isLocalAI ? 'text-indigo-400' : 'text-gray-500'}`}>Cloud AI</span>
                            <button onClick={() => setIsLocalAI(!isLocalAI)} className="w-10 h-5 bg-white/10 rounded-full relative transition-colors focus:outline-none focus:ring-1 focus:ring-white/20">
                                <motion.div animate={{ x: isLocalAI ? 20 : 0 }} className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full shadow-lg" style={{ background: isLocalAI ? 'var(--accent)' : '#fff' }} />
                            </button>
                            <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${isLocalAI ? 'text-indigo-400' : 'text-gray-500'}`}>Local AI</span>
                        </div>
                        <AnimatePresence mode="wait">
                            {aiStatusMessage && (
                                <motion.p key={aiStatusMessage} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="text-[10px] font-medium text-gray-400 italic tracking-wide">
                                    {aiStatusMessage}
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="flex items-center gap-4 min-w-[200px] justify-end">
                        {stats.current_streak > 0 && (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ background: 'rgba(249, 115, 22, 0.1)', color: '#fb923c' }}>
                                {stats.current_streak} day streak
                            </motion.div>
                        )}
                        {currentUser && (
                            <span className="text-xs text-gray-500 hidden sm:block">Hi, <span className="text-gray-300 font-medium">{currentUser.username}</span></span>
                        )}
                        <div className="relative">
                            <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" style={{ background: 'linear-gradient(135deg, var(--accent), #7c3aed)', border: '1px solid var(--border-active)' }}>
                                {currentUser?.username?.[0]?.toUpperCase() || 'U'}
                            </button>
                            <AnimatePresence>
                                {showProfileMenu && (
                                    <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} transition={{ duration: 0.2 }} className="absolute right-0 mt-3 w-52 rounded-xl shadow-2xl overflow-hidden py-1 z-50 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                                        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                                            <p className="text-sm font-semibold text-white">{currentUser?.username}</p>
                                            <p className="text-xs text-gray-500 truncate">{currentUser?.email}</p>
                                        </div>
                                        <button onClick={() => { setShowProfileMenu(false); setShowHistory(true); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors flex items-center gap-2">Plan History</button>
                                        <div className="h-px w-full my-1 bg-white/10"></div>
                                        <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2 font-medium">Logout</button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </header>

            {/* ─── Main Content ─── */}
            <main className="max-w-[90rem] mx-auto px-4 py-8 space-y-8">
                <motion.div key={message} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                    <p className="text-sm text-gray-400 italic">"{message}"</p>
                </motion.div>
                <StatsPanel stats={stats} />
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-4 space-y-6">
                        <GoalForm onGenerate={handleGenerate} generating={generating} onAddGoal={handleAddGoal} onReset={handleReset} hasActivePlan={stats.total_tasks > 0} isLocalAI={isLocalAI} />
                        <div className="lg:sticky lg:top-8"><QuickNotes forceRefresh={refreshTrigger} /></div>
                    </div>
                    <div className="lg:col-span-8">
                        <Dashboard forceRefresh={refreshTrigger} generating={generating} onImprovePlan={handleImprovePlan} />
                    </div>
                </div>
            </main>
            <footer className="border-t py-8 mt-12" style={{ borderColor: 'var(--border)' }}>
                <div className="max-w-6xl mx-auto px-6 text-center text-xs text-gray-600">
                    <p>© {new Date().getFullYear()} AscendAI. All rights reserved.</p>
                </div>
            </footer>

            {/* ─── AI Confirmation Modal ─── */}
            <AnimatePresence>
                {showAIConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="p-6 max-w-sm w-full mx-4 rounded-2xl border shadow-2xl"
                            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'rgba(251, 146, 60, 0.15)', border: '1px solid rgba(251, 146, 60, 0.3)' }}>⚠️</div>
                                <h3 className="text-lg font-bold text-white">Long Plan Detected</h3>
                            </div>
                            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                                Your plan is over <span className="text-white font-medium">5 days</span>. Local AI (Mistral 7B) may <span className="text-amber-400 font-medium">timeout</span> on longer plans. We recommend switching to Cloud AI for this generation.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleAIConfirm(false)}
                                    className="flex-1 py-2.5 rounded-xl text-gray-300 transition-colors hover:bg-white/5 border border-white/10 text-sm"
                                >
                                    Keep Local AI
                                </button>
                                <button
                                    onClick={() => handleAIConfirm(true)}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                                    style={{ background: 'linear-gradient(135deg, var(--accent), #7c3aed)', color: 'white' }}
                                >
                                    Switch to Cloud AI
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default App;
