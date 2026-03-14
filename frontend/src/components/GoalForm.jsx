import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const GoalForm = ({ onGenerate, generating, onAddGoal, onReset, hasActivePlan }) => {
    const [goal, setGoal] = useState('');
    const [days, setDays] = useState(14);
    const [hours, setHours] = useState(2);
    const [difficulty, setDifficulty] = useState("Intermediate");
    const [includeResources, setIncludeResources] = useState(false);
    const [file, setFile] = useState(null);
    const [fileName, setFileName] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);


    const handleSubmit = (e) => {
        e.preventDefault();
        if (!goal.trim() && !file) return;

        // Ensure standard submit behavior defaults to generating a fresh plan
        // This keeps the HTML5 form behavior intact if the user hits Enter.
        if (hasActivePlan) {
            onAddGoal(goal, days, hours, difficulty, includeResources, file); 
        } else {
            onGenerate(goal, days, hours, false, difficulty, includeResources, file);
        }
        setGoal('');
        setFile(null);
        setFileName('');
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setFileName(selectedFile.name);
        }
    };

    const presets = [
        { label: "SSC CGL" },
        { label: "Data Structures & Algorithms" },
        { label: "Machine Learning" },
        { label: "React & Next.js" },
        { label: "System Design" },
        { label: "Python Programming" },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="glass-card p-8 gradient-border"
        >
            <div className="mb-6">
                <h2 className="text-xl font-bold text-white mb-1">Create Your Learning Plan</h2>
                <p className="text-sm text-gray-500">Tell me what you want to master, and I will architect your path.</p>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-2 mb-6">
                {presets.map((p) => (
                    <button
                        key={p.label}
                        type="button"
                        onClick={() => setGoal(p.label)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-all duration-200 ${goal === p.label
                            ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                            : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300'
                            }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">What do you want to master?</label>
                    <input
                        type="text"
                        className="w-full p-4 rounded-xl border transition-all duration-300 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-base"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
                        placeholder="e.g., Master Data Structures in Python"
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Timeline</label>
                        <div className="relative">
                            <input
                                type="number"
                                className="w-full p-4 pr-14 rounded-xl border transition-all duration-300 text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
                                value={days}
                                onChange={(e) => setDays(e.target.value)}
                                min="1"
                                max="365"
                                required
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">days</span>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Daily Commitment</label>
                        <div className="relative">
                            <input
                                type="number"
                                className="w-full p-4 pr-14 rounded-xl border transition-all duration-300 text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
                                value={hours}
                                onChange={(e) => setHours(e.target.value)}
                                min="1"
                                max="16"
                                required
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">hrs/day</span>
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Difficulty Base</label>
                        <select
                            className="w-full p-4 rounded-xl border transition-all duration-300 text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer"
                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
                            value={difficulty}
                            onChange={(e) => setDifficulty(e.target.value)}
                        >
                            <option value="Beginner">Beginner</option>
                            <option value="Intermediate">Intermediate</option>
                            <option value="Advanced">Advanced</option>
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Include Resources?</label>
                        <div 
                            className="w-full p-4 rounded-xl border transition-all duration-300 text-white flex items-center gap-3 cursor-pointer select-none h-[58px]"
                            style={{ 
                                background: includeResources ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-secondary)', 
                                borderColor: includeResources ? '#6366f1' : 'var(--border)'
                            }}
                            onClick={() => setIncludeResources(!includeResources)}
                        >
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${includeResources ? 'bg-indigo-500 border-indigo-500' : 'border-gray-500'}`}>
                                {includeResources && (
                                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </div>
                            <span className="text-sm">Yes, please</span>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Custom Syllabus (Optional PDF/Txt/Image)</label>
                    <label 
                        className="w-full p-4 rounded-xl border border-dashed transition-all duration-300 flex flex-col items-center justify-center cursor-pointer min-h-[100px] hover:bg-white/5"
                        style={{ borderColor: file ? '#6366f1' : 'var(--border)' }}
                    >
                        <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.txt,.png,.jpg,.jpeg"
                            onChange={handleFileChange}
                        />
                        {file ? (
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-indigo-400 font-medium break-all text-center">{fileName}</span>
                                <span className="text-xs text-gray-500 hover:text-red-400" onClick={(e) => { e.preventDefault(); setFile(null); setFileName(''); }}>Remove file</span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2 text-gray-500">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                                <span className="text-sm text-center">Click to upload syllabus or curriculum</span>
                            </div>
                        )}
                    </label>
                </div>

                {hasActivePlan ? (
                    <div className="grid grid-cols-1 gap-3">
                        <motion.button
                            type="button"
                            onClick={() => {
                                if (goal.trim() || file) onAddGoal(goal, days, hours, difficulty, includeResources, file);
                                setGoal('');
                                setFile(null);
                                setFileName('');
                            }}
                            disabled={generating || (!goal.trim() && !file)}
                            whileTap={{ scale: 0.98 }}
                            className="w-full btn-primary py-4 text-base flex items-center justify-center gap-3"
                        >
                            {generating ? 'Updating Plan...' : 'Add to Current Plan'}
                        </motion.button>

                        <motion.button
                            type="button"
                            onClick={() => setShowConfirm(true)}
                            disabled={generating}
                            whileTap={{ scale: 0.98 }}
                            className="w-full py-3 text-sm flex items-center justify-center gap-3 text-red-400 hover:text-red-300 transition-colors border border-red-500/20 rounded-xl hover:bg-red-500/10"
                        >
                            ⚠️ Overwrite Plan & Start Fresh
                        </motion.button>
                    </div>
                ) : (
                    <motion.button
                        type="submit"
                        disabled={generating || (!goal.trim() && !file)}
                        whileTap={{ scale: 0.98 }}
                        className="w-full btn-primary py-4 text-base flex items-center justify-center gap-3"
                    >
                        {generating ? (
                            <>
                                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                AI is architecting your plan...
                            </>
                        ) : (
                            <>
                                Architect My Goal
                            </>
                        )}
                    </motion.button>
                )}
            </form>

            <AnimatePresence>
                {showConfirm && (
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
                            className="p-6 max-w-sm w-full mx-4 rounded-2xl border border-red-500/30 shadow-2xl"
                            style={{ background: 'var(--bg-card)' }}
                        >
                            <h3 className="text-xl font-bold text-white mb-2">Start Fresh?</h3>
                            <p className="text-gray-400 text-sm mb-6">This will permanently delete all your current goals, tasks, and streaks. This action cannot be undone.</p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowConfirm(false)}
                                    className="flex-1 py-2 rounded-xl text-gray-300 transition-colors hover:bg-white/5 border border-white/10"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        setShowConfirm(false);
                                        onReset();
                                    }}
                                    className="flex-1 py-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 transition-colors font-semibold"
                                >
                                    Delete All
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default GoalForm;
