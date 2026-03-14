import React from 'react';
import { motion } from 'framer-motion';
import { toggleTask } from '../services/api';

const diffConfig = {
    easy: { label: 'Easy', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
    medium: { label: 'Medium', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
    hard: { label: 'Hard', color: 'text-red-400 bg-red-400/10 border-red-400/20' },
};

const TaskCard = ({ task, onToggle }) => {
    const diff = diffConfig[task.difficulty] || diffConfig.medium;

    const handleToggle = async () => {
        try {
            await toggleTask(task.id);
            if (onToggle) onToggle();
        } catch (err) {
            console.error('Failed to toggle task:', err);
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={handleToggle}
            className={`relative overflow-hidden rounded-xl p-4 transition-all duration-300 cursor-pointer group border
                ${task.completed
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : 'border-gray-800 hover:border-indigo-500/40 hover:bg-white/[0.02]'
                }`}
            whileTap={{ scale: 0.98 }}
        >
            {/* Completion sweep animation */}
            <div className={`absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent transform origin-left transition-transform duration-500 ${task.completed ? 'scale-x-100' : 'scale-x-0'}`}></div>

            <div className="relative z-10 flex items-start gap-3">
                {/* Checkbox */}
                <div className="flex-shrink-0 mt-0.5">
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200
                        ${task.completed
                            ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                            : 'border-gray-600 group-hover:border-indigo-400'
                        }`}
                    >
                        {task.completed && (
                            <motion.svg
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                            </motion.svg>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium leading-relaxed transition-colors ${task.completed ? 'text-gray-500 line-through' : 'text-gray-200 group-hover:text-white'
                        }`}>
                        {task.description}
                    </p>

                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        {/* Time badge */}
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            ⏱ {task.estimated_time || '30 min'}
                        </span>

                        {/* Difficulty badge */}
                        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border ${diff.color}`}>
                            {diff.icon} {diff.label}
                        </span>
                    </div>
                </div>

                {/* Optional Resources Section */}
                {task.resources && task.resources.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/5">
                        <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Resources</h4>
                        <ul className="space-y-1">
                            {task.resources.map((link, idx) => {
                                // Extract simple display name from URL
                                let displayName = link;
                                try {
                                    const url = new URL(link);
                                    displayName = url.hostname.replace('www.', '') + url.pathname;
                                    if(displayName.length > 35) displayName = displayName.substring(0, 32) + '...';
                                } catch(e) {
                                    // Invalid URL, fallback to raw string
                                }
                                return (
                                    <li key={idx} className="flex items-start gap-2 text-sm text-indigo-300 hover:text-indigo-200 transition-colors">
                                        <svg className="w-4 h-4 mt-0.5 opacity-70 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                        <a href={link} target="_blank" rel="noopener noreferrer" className="break-all">{displayName}</a>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default TaskCard;
