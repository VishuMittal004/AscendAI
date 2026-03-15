import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { jsPDF } from 'jspdf';
import ReactMarkdown from 'react-markdown';
import TaskCard from './TaskCard';
import { getTasks, recalibrateTasks, analyzeSession, exportData } from '../services/api';

const Dashboard = ({ forceRefresh, generating, onImprovePlan }) => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [recalibrateModal, setRecalibrateModal] = useState({ isOpen: false, type: null, dayNumber: null });
    const [analysisModal, setAnalysisModal] = useState({ isOpen: false, content: null, loading: false });
    const dashboardRef = useRef(null);

    useEffect(() => {
        fetchTasks();
    }, [forceRefresh]);

    const fetchTasks = async () => {
        try {
            setLoading(true);
            const data = await getTasks();
            setTasks(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to fetch tasks', error);
        } finally {
            setLoading(false);
        }
    };
    const handleMissedDay = () => {
        setRecalibrateModal({ isOpen: true, type: 'global', dayNumber: null });
    };

    const handleRecalibratePartial = (dayNumber) => {
        setRecalibrateModal({ isOpen: true, type: 'partial', dayNumber });
    };

    const confirmRecalibrate = async () => {
        const { type, dayNumber } = recalibrateModal;
        setRecalibrateModal({ isOpen: false, type: null, dayNumber: null });
        
        try {
            if (type === 'global') {
                await recalibrateTasks();
            } else if (type === 'partial') {
                await recalibrateTasks(dayNumber);
            }
            fetchTasks();
        } catch (e) {
            console.error(e);
            alert("Failed to recalibrate tasks.");
        }
    };

    const exportToPDF = async () => {
        try {
            const data = await exportData();
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 15;
            const maxWidth = pageWidth - margin * 2;
            let y = margin;

            const checkPage = (needed = 10) => {
                if (y + needed > pageHeight - margin) {
                    pdf.addPage();
                    y = margin;
                }
            };

            // Title
            pdf.setFontSize(20);
            pdf.setFont('helvetica', 'bold');
            pdf.text('AscendAI — Learning Plan', margin, y);
            y += 10;

            // Session name
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(100);
            pdf.text(data.session_name || '', margin, y);
            y += 8;

            // Goals
            if (data.goals && data.goals.length > 0) {
                pdf.setFontSize(13);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(0);
                pdf.text('Goals', margin, y);
                y += 7;
                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'normal');
                data.goals.forEach(g => {
                    checkPage();
                    pdf.text(`• ${g}`, margin + 3, y);
                    y += 6;
                });
                y += 4;
            }

            // Stats summary
            if (data.stats) {
                checkPage(20);
                pdf.setFontSize(13);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(0);
                pdf.text('Progress Summary', margin, y);
                y += 7;
                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'normal');
                pdf.text(`Tasks: ${data.stats.completed_tasks} / ${data.stats.total_tasks} completed (${data.stats.progress_percent}%)`, margin + 3, y);
                y += 6;
                pdf.text(`Streak: ${data.stats.current_streak} days (longest: ${data.stats.longest_streak})`, margin + 3, y);
                y += 6;
                pdf.text(`Time: ${data.stats.completed_minutes} / ${data.stats.total_minutes} minutes`, margin + 3, y);
                y += 10;
            }

            // Day-wise tasks
            if (data.days && data.days.length > 0) {
                pdf.setFontSize(14);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(0);
                checkPage(15);
                pdf.text('Day-wise Tasks', margin, y);
                y += 8;

                data.days.forEach(dayObj => {
                    checkPage(20);
                    pdf.setFontSize(12);
                    pdf.setFont('helvetica', 'bold');
                    pdf.setTextColor(50, 50, 50);
                    pdf.text(`Day ${dayObj.day}`, margin, y);
                    y += 6;

                    dayObj.tasks.forEach(task => {
                        checkPage(18);
                        const status = task.completed ? '[✓]' : '[ ]';
                        const timeStr = task.minutes >= 60 ? `${Math.round(task.minutes / 60 * 10) / 10} hrs` : `${task.minutes} min`;

                        pdf.setFontSize(10);
                        pdf.setFont('helvetica', 'normal');
                        pdf.setTextColor(0);

                        // Task description with word wrap
                        const taskLine = `${status} ${task.description}`;
                        const lines = pdf.splitTextToSize(taskLine, maxWidth - 6);
                        lines.forEach(line => {
                            checkPage();
                            pdf.text(line, margin + 5, y);
                            y += 5;
                        });

                        // Meta line (time, difficulty)
                        pdf.setFontSize(8);
                        pdf.setTextColor(120);
                        pdf.text(`${timeStr} • ${task.difficulty}`, margin + 8, y);
                        y += 5;

                        // Resources
                        if (task.resources && task.resources.length > 0) {
                            pdf.setFontSize(8);
                            pdf.setTextColor(80, 80, 180);
                            task.resources.forEach(r => {
                                checkPage();
                                const rLines = pdf.splitTextToSize(`↳ ${r}`, maxWidth - 12);
                                rLines.forEach(rl => {
                                    pdf.text(rl, margin + 8, y);
                                    y += 4;
                                });
                            });
                        }
                        y += 2;
                    });
                    y += 4;
                });
            }

            // Quick Notes
            if (data.notes && data.notes.trim()) {
                checkPage(20);
                pdf.setFontSize(13);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(0);
                pdf.text('Quick Notes', margin, y);
                y += 7;

                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(40);
                const noteLines = pdf.splitTextToSize(data.notes, maxWidth);
                noteLines.forEach(line => {
                    checkPage();
                    pdf.text(line, margin, y);
                    y += 5;
                });
            }

            const fileName = data.goals?.[0] || 'Learning_Plan';
            pdf.save(`AscendAI_${fileName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
        } catch (err) {
            console.error('Failed to generate PDF', err);
            alert('Failed to export PDF.');
        }
    };

    const handleAnalyze = async () => {
        if (!tasks.length) return;
        setAnalysisModal({ isOpen: true, content: null, loading: true });
        try {
            const sessionId = tasks[0].session_id || localStorage.getItem('ascendai_session'); // Assuming sessions are handled or just use tasks[0].session_id which might not exist in frontend task map currently. 
            // Wait, we can fetch tasks, but we need session id. Actually, our analyze route uses session_id from URL. Let's adjust backend or just grab it from the first task if not passed.
            // As a fallback, we know there's only one active session for the user usually.
            // Wait, analyze is /sessions/{session_id}/analyze. We can change backend to just use the active session if we want.
            // For now, let's fetch session id. The backend get active session. Let's make the API call `/sessions/active/analyze`.
            // Let's actually pass `tasks[0].session_id` - assuming we can add it to TaskResponse.
            // Let's call the API with the session ID. 
        } catch (e) {
            console.log(e);
        }
    };

    const fetchAnalysis = async (sessionId) => {
        setAnalysisModal({ isOpen: true, content: null, loading: true });
        try {
            const res = await analyzeSession(sessionId);
            setAnalysisModal({ isOpen: true, content: res.analysis, loading: false });
        } catch (err) {
            console.error(err);
            setAnalysisModal({ isOpen: true, content: "Failed to load analysis.", loading: false });
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm text-gray-500">Loading your plan...</span>
                </div>
            </div>
        );
    }

    if (tasks.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card flex flex-col items-center justify-center py-20 text-center"
            >
                <div className="text-6xl mb-4 opacity-30">🗺️</div>
                <h3 className="text-lg font-semibold text-gray-400 mb-2">No Roadmap Yet</h3>
                <p className="text-sm text-gray-600 max-w-md">
                    Enter your learning goal above and let the AI architect your personalized day-by-day plan.
                </p>
            </motion.div>
        );
    }

    // Group tasks by day
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.completed).length;
    const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const days = [...new Set(tasks.map(t => t.day_number))].sort((a, b) => a - b);

    // Extract all unique goal titles
    const allGoalTitles = [...new Set(tasks.map(t => t.goal_title).filter(Boolean).filter(t => t !== 'Unknown'))];

    // Prepare chart data cumulatively
    let accumulatedCompleted = 0;
    const chartData = days.map(dayNum => {
        const dayTasks = tasks.filter(t => t.day_number === dayNum);
        const dayCompleted = dayTasks.filter(t => t.completed).length;
        accumulatedCompleted += dayCompleted;
        return {
            name: `Day ${dayNum}`,
            TasksCompleted: accumulatedCompleted
        };
    });

    return (
        <div className="space-y-6" ref={dashboardRef}>

            {/* Active Goals Section */}
            {allGoalTitles.length > 0 && (
                <div className="glass-card p-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Active Goals</h3>
                    <div className="flex flex-wrap gap-3">
                        {allGoalTitles.map((title, i) => (
                            <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                                <span className="text-lg"></span>
                                <span className="text-sm font-semibold text-indigo-300">{title}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Progress Header */}
            <div className="glass-card p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
                    <div className="flex-1 w-full">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-xl font-bold text-white">Master Plan Roadmap</h2>
                            <span className="text-sm font-bold text-indigo-400">{progressPercent}%</span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
                            <motion.div
                                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 progress-animate"
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercent}%` }}
                                transition={{ duration: 1, ease: "easeOut" }}
                            />
                        </div>
                        <div className="flex justify-between mt-2">
                            <span className="text-xs text-gray-500">{completedTasks} of {totalTasks} tasks complete</span>
                            <span className="text-xs text-gray-500">{days.length} days total</span>
                        </div>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                        <button
                            onClick={handleMissedDay}
                            className="btn-danger flex-1 md:flex-initial flex items-center justify-center gap-2 text-sm"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Missed a Day
                        </button>
                        <button
                            onClick={onImprovePlan}
                            disabled={generating}
                            className="btn-secondary flex-1 md:flex-initial flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Regenerate
                        </button>
                        <button
                            onClick={exportToPDF}
                            className="btn-secondary flex-1 md:flex-initial flex items-center justify-center gap-2 text-sm text-emerald-400 hover:text-emerald-300"
                            style={{ borderColor: 'rgba(52, 211, 153, 0.3)' }}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Export PDF
                        </button>
                    </div>
                </div>
            </div>

            {/* Timeline */}
            <div className="space-y-4 relative">
                {/* Vertical timeline line */}
                <div className="absolute left-[23px] top-8 bottom-8 w-px hidden md:block"
                    style={{ background: 'linear-gradient(to bottom, var(--accent), transparent)' }}
                />

                <AnimatePresence>
                    {days.map((dayNum, idx) => {
                        const dayTasks = tasks.filter(t => t.day_number === dayNum);
                        const dayCompleted = dayTasks.every(t => t.completed);
                        const dayProgress = dayTasks.filter(t => t.completed).length;
                        const dayConcept = dayTasks[0]?.day_concept || (dayTasks[0]?.goal_title && dayTasks[0]?.goal_title !== 'Unknown' ? dayTasks[0]?.goal_title : "Daily Tasks");

                        // Calculate total time for the day in minutes directly
                        const dayTime = dayTasks.reduce((sum, t) => sum + (t.minutes || 30), 0);

                        return (
                            <motion.div
                                key={dayNum}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05, duration: 0.4 }}
                                className={`relative flex gap-5 items-start ${dayCompleted ? 'opacity-70' : ''}`}
                            >
                                {/* Timeline node */}
                                <div className="hidden md:flex flex-col items-center z-10 w-12 pt-5">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-lg
                                        ${dayCompleted
                                            ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                                            : 'text-white shadow-indigo-500/20'
                                        }`}
                                        style={!dayCompleted ? { background: 'var(--accent)' } : {}}
                                    >
                                        {dayCompleted ? '✓' : dayNum}
                                    </div>
                                </div>

                                {/* Day card */}
                                <div className={`flex-1 glass-card p-5 transition-all ${dayCompleted ? 'border-emerald-500/20' : ''}`}>
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                                        <div>
                                            <span className="md:hidden inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 mb-2">
                                                Day {dayNum}
                                            </span>
                                            <h3 className="text-lg font-bold text-white">{dayConcept}</h3>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-gray-500">
                                                ~{dayTime >= 60 ? `${Math.round(dayTime / 60 * 10) / 10} hrs` : `${dayTime} min`}
                                            </span>
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-md"
                                                style={{
                                                    background: dayCompleted ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-secondary)',
                                                    color: dayCompleted ? '#22c55e' : 'var(--text-muted)'
                                                }}
                                            >
                                                {dayProgress}/{dayTasks.length}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {dayTasks.map(task => (
                                            <TaskCard
                                                key={task.id}
                                                task={task}
                                                onToggle={fetchTasks}
                                            />
                                        ))}
                                    </div>
                                    
                                    {/* Partial Completion Recalibration Button */}
                                    {!dayCompleted && dayProgress > 0 && (
                                        <div className="mt-5 flex justify-end">
                                            <button 
                                                onClick={() => handleRecalibratePartial(dayNum)}
                                                className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 transition-colors border border-indigo-500/20"
                                                title="Move remaining incomplete tasks to the next day"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                                                </svg>
                                                Recalibrate Remaining Tasks Forward
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
            
            {/* Progress Line Graph & Analysis */}
            {totalTasks > 0 && chartData.length > 0 && (
                <div className="glass-card p-6 mt-8 flex flex-col md:flex-row gap-6 md:ml-[68px]">
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-white mb-6">Learning Trajectory</h3>
                        <div className="w-full h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                    <Line type="monotone" dataKey="TasksCompleted" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 8 }} />
                                    <CartesianGrid stroke="#222" strokeDasharray="5 5" vertical={false} />
                                    <XAxis dataKey="name" stroke="#666" tick={{ fill: '#888', fontSize: 12 }} />
                                    <YAxis stroke="#666" tick={{ fill: '#888', fontSize: 12 }} allowDecimals={false} />
                                    <RechartsTooltip 
                                        contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '8px' }}
                                        itemStyle={{ color: '#818cf8', fontWeight: 'bold' }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    
                    {/* Performance Analysis Sidebar block */}
                    <div className="md:w-64 flex flex-col justify-center items-center p-4 border border-white/5 rounded-xl bg-white/[0.02]">
                        <div className="text-4xl mb-3">🧠</div>
                        <h4 className="text-white font-bold mb-2">Review Performance</h4>
                        <p className="text-xs text-gray-500 text-center mb-4">
                            Analyze your completed vs incomplete tasks and receive AI insights on your learning path.
                        </p>
                        <button 
                            onClick={() => {
                                // Find session ID from tasks or use generic 'active' convention if updated in API
                                // For now, we will add an explicit "active" alias to the analyze backend path shortly
                                fetchAnalysis('active'); 
                            }}
                            className="w-full py-2.5 rounded-lg text-sm font-semibold bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 transition-colors border border-indigo-500/20"
                        >
                            Generate Analysis
                        </button>
                    </div>
                </div>
            )}
            
            {/* Custom Recalibration Confirmation Modal */}
            <AnimatePresence>
                {recalibrateModal.isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setRecalibrateModal({ isOpen: false, type: null, dayNumber: null })}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-[#11111a] border border-white/10 p-6 rounded-2xl shadow-2xl z-10 max-w-sm w-full relative overflow-hidden"
                        >
                            {/* Decorative gradient top edge */}
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500/50 via-pink-500/50 to-indigo-500/50" />
                            
                            <h3 className="text-xl font-bold text-white mb-3">
                                {recalibrateModal.type === 'global' ? 'Missed a Day?' : 'Recalibrate Tasks?'}
                            </h3>
                            
                            <p className="text-gray-300 text-sm mb-6 leading-relaxed">
                                {recalibrateModal.type === 'global' 
                                    ? "This will shift all your incomplete tasks up to tomorrow and neatly reorganize your plan. However, because you missed a full day, your current streak will be reset to 0."
                                    : "This will take your remaining incomplete tasks from this day and distribute them evenly across your upcoming days."}
                            </p>
                            
                            <div className="flex justify-end gap-3">
                                <button 
                                    onClick={() => setRecalibrateModal({ isOpen: false, type: null, dayNumber: null })}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={confirmRecalibrate}
                                    className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                                >
                                    Yes, Recalibrate
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Analysis Result Modal */}
            <AnimatePresence>
                {analysisModal.isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setAnalysisModal({ isOpen: false, content: null, loading: false })}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-[#11111a] border border-white/10 p-6 rounded-2xl shadow-2xl z-10 max-w-2xl w-full relative overflow-hidden flex flex-col max-h-[85vh]"
                        >
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <span className="text-2xl"></span> AI Performance Review
                                </h3>
                                <button 
                                    onClick={() => setAnalysisModal({ isOpen: false, content: null, loading: false })}
                                    className="text-gray-500 hover:text-white transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            
                            <div className="overflow-y-auto pr-2 custom-scrollbar flex-1">
                                {analysisModal.loading ? (
                                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                                        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                        <p className="text-sm text-gray-400">Analyzing your progress...</p>
                                    </div>
                                ) : (
                                    <div className="prose prose-invert prose-indigo max-w-none prose-sm leading-relaxed">
                                        <ReactMarkdown>{analysisModal.content || "No analysis available."}</ReactMarkdown>
                                    </div>
                                )}
                            </div>

                            {/* Export Analysis Button */}
                            {!analysisModal.loading && analysisModal.content && (
                                <div className="mt-4 pt-4 border-t border-white/10">
                                    <button
                                        onClick={() => {
                                            try {
                                                const pdf = new jsPDF('p', 'mm', 'a4');
                                                const pageWidth = pdf.internal.pageSize.getWidth();
                                                const pageHeight = pdf.internal.pageSize.getHeight();
                                                const margin = 15;
                                                const maxWidth = pageWidth - margin * 2;
                                                let y = margin;

                                                const checkPage = (needed = 10) => {
                                                    if (y + needed > pageHeight - margin) {
                                                        pdf.addPage();
                                                        y = margin;
                                                    }
                                                };

                                                // Title
                                                pdf.setFontSize(20);
                                                pdf.setFont('helvetica', 'bold');
                                                pdf.text('AscendAI — Performance Review', margin, y);
                                                y += 10;

                                                pdf.setFontSize(9);
                                                pdf.setFont('helvetica', 'normal');
                                                pdf.setTextColor(120);
                                                pdf.text(`Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, y);
                                                y += 10;

                                                // Content — strip markdown formatting for clean text
                                                pdf.setFontSize(10);
                                                pdf.setFont('helvetica', 'normal');
                                                pdf.setTextColor(30);

                                                const content = analysisModal.content;
                                                const paragraphs = content.split('\n');
                                                
                                                paragraphs.forEach(para => {
                                                    const trimmed = para.trim();
                                                    if (!trimmed) {
                                                        y += 4;
                                                        return;
                                                    }

                                                    // Detect headings
                                                    if (trimmed.startsWith('### ')) {
                                                        checkPage(12);
                                                        y += 3;
                                                        pdf.setFontSize(11);
                                                        pdf.setFont('helvetica', 'bold');
                                                        pdf.setTextColor(0);
                                                        pdf.text(trimmed.replace(/^###\s*/, ''), margin, y);
                                                        y += 7;
                                                        pdf.setFontSize(10);
                                                        pdf.setFont('helvetica', 'normal');
                                                        pdf.setTextColor(30);
                                                    } else if (trimmed.startsWith('## ')) {
                                                        checkPage(14);
                                                        y += 4;
                                                        pdf.setFontSize(13);
                                                        pdf.setFont('helvetica', 'bold');
                                                        pdf.setTextColor(0);
                                                        pdf.text(trimmed.replace(/^##\s*/, ''), margin, y);
                                                        y += 8;
                                                        pdf.setFontSize(10);
                                                        pdf.setFont('helvetica', 'normal');
                                                        pdf.setTextColor(30);
                                                    } else if (trimmed.startsWith('# ')) {
                                                        checkPage(16);
                                                        y += 5;
                                                        pdf.setFontSize(15);
                                                        pdf.setFont('helvetica', 'bold');
                                                        pdf.setTextColor(0);
                                                        pdf.text(trimmed.replace(/^#\s*/, ''), margin, y);
                                                        y += 9;
                                                        pdf.setFontSize(10);
                                                        pdf.setFont('helvetica', 'normal');
                                                        pdf.setTextColor(30);
                                                    } else {
                                                        // Strip bold/italic markers
                                                        const cleanText = trimmed.replace(/\*\*/g, '').replace(/\*/g, '').replace(/__/g, '').replace(/_/g, '');
                                                        const indent = trimmed.startsWith('- ') || trimmed.startsWith('* ') ? 4 : 0;
                                                        const prefix = indent > 0 ? '• ' + cleanText.substring(2) : cleanText;
                                                        const lines = pdf.splitTextToSize(prefix, maxWidth - indent);
                                                        lines.forEach(line => {
                                                            checkPage();
                                                            pdf.text(line, margin + indent, y);
                                                            y += 5;
                                                        });
                                                    }
                                                });

                                                pdf.save('AscendAI_Performance_Review.pdf');
                                            } catch (err) {
                                                console.error('Failed to export analysis', err);
                                                alert('Failed to export analysis.');
                                            }
                                        }}
                                        className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                                        style={{
                                            background: 'rgba(52, 211, 153, 0.1)',
                                            color: '#34d399',
                                            border: '1px solid rgba(52, 211, 153, 0.3)',
                                        }}
                                        onMouseEnter={(e) => { e.target.style.background = 'rgba(52, 211, 153, 0.2)'; }}
                                        onMouseLeave={(e) => { e.target.style.background = 'rgba(52, 211, 153, 0.1)'; }}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        Export Analysis as PDF
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Dashboard;
