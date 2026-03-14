import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSessions, getSessionTasks } from '../services/api';

const SessionHistory = ({ onClose }) => {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedSession, setExpandedSession] = useState(null);
    const [sessionTasks, setSessionTasks] = useState([]);
    const [loadingTasks, setLoadingTasks] = useState(false);

    useEffect(() => {
        const fetchSessions = async () => {
            try {
                const data = await getSessions();
                setSessions(data);
            } catch (e) {
                console.error('Failed to load sessions', e);
            } finally {
                setLoading(false);
            }
        };
        fetchSessions();
    }, []);

    const handleExpand = async (session) => {
        if (expandedSession?.id === session.id) {
            setExpandedSession(null);
            setSessionTasks([]);
            return;
        }
        setExpandedSession(session);
        setLoadingTasks(true);
        try {
            const tasks = await getSessionTasks(session.id);
            setSessionTasks(tasks);
        } catch (e) {
            console.error('Failed to load tasks', e);
        } finally {
            setLoadingTasks(false);
        }
    };

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: 'spring', damping: 25 }}
                className="w-full max-w-2xl glass-card p-6 max-h-[80vh] flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-white">Plan History</h2>
                        <p className="text-xs text-gray-500 mt-0.5">All your past study sessions</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-colors text-lg"
                    >
                        ×
                    </button>
                </div>

                {/* Sessions List */}
                <div className="overflow-y-auto flex-1 space-y-3 pr-1">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <svg className="animate-spin h-6 w-6 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                            </svg>
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <p className="text-4xl mb-3">📋</p>
                            <p className="text-sm">No past sessions yet. Start building your first plan!</p>
                        </div>
                    ) : (
                        sessions.map((session, i) => {
                            const isExpanded = expandedSession?.id === session.id;
                            const progress = session.task_count
                                ? Math.round((session.completed_task_count / session.task_count) * 100)
                                : 0;
                            const isActive = i === 0; // newest is active

                            return (
                                <div key={session.id} className="rounded-xl border overflow-hidden transition-all"
                                    style={{ borderColor: isActive ? 'var(--border-active)' : 'var(--border)', background: 'var(--bg-card)' }}>
                                    {/* Session Header */}
                                    <button
                                        onClick={() => handleExpand(session)}
                                        className="w-full text-left p-4 hover:bg-white/3 transition-colors"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                {isActive && (
                                                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                                        style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                                                        Active
                                                    </span>
                                                )}
                                                <span className="text-sm font-semibold text-white">{session.name}</span>
                                            </div>
                                            <span className="text-gray-500 text-sm">{isExpanded ? '▲' : '▼'}</span>
                                        </div>
                                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                                            <span>{formatDate(session.created_at)}</span>
                                            <span>{session.goal_count} goal{session.goal_count !== 1 ? 's' : ''}</span>
                                            <span>{session.completed_task_count}/{session.task_count} tasks done</span>
                                        </div>
                                        {/* Progress bar */}
                                        {session.task_count > 0 && (
                                            <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                        )}
                                    </button>

                                    {/* Expanded Tasks */}
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.25 }}
                                                className="overflow-hidden border-t"
                                                style={{ borderColor: 'var(--border)' }}
                                            >
                                                <div className="p-4 space-y-2 max-h-60 overflow-y-auto">
                                                    {loadingTasks ? (
                                                        <p className="text-xs text-gray-500 text-center py-4">Loading tasks...</p>
                                                    ) : sessionTasks.length === 0 ? (
                                                        <p className="text-xs text-gray-500 text-center py-4">No tasks in this session.</p>
                                                    ) : (
                                                        sessionTasks.map((task) => (
                                                            <div key={task.id} className="flex items-start gap-3 py-1.5">
                                                                <div className={`w-4 h-4 mt-0.5 rounded-full border flex-shrink-0 flex items-center justify-center ${task.completed
                                                                    ? 'bg-indigo-500 border-indigo-500'
                                                                    : 'border-gray-600'
                                                                    }`}>
                                                                    {task.completed && (
                                                                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                        </svg>
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className={`text-xs leading-relaxed ${task.completed ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
                                                                        {task.description}
                                                                    </p>
                                                                    <p className="text-xs text-gray-600 mt-0.5">Day {task.day_number} · {task.goal_title}</p>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};

export default SessionHistory;
