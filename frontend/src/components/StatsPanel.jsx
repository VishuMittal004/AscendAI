import React from 'react';
import { motion } from 'framer-motion';

const statVariant = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" }
    })
};

const StatsPanel = ({ stats }) => {
    const cards = [
        {
            label: "Current Streak",
            value: stats.current_streak || 0,
            bgImage: "/placeholders/streak-bg.jpg", // Replace with actual image path
            suffix: stats.current_streak === 1 ? "day" : "days",
            color: "from-orange-500 to-red-500",
            bgGlow: "rgba(249, 115, 22, 0.25)"
        },
        {
            label: "Tasks Done",
            value: stats.completed_tasks || 0,
            bgImage: "/placeholders/tasks-bg.jpg", // Replace with actual image path
            suffix: `/ ${stats.total_tasks || 0}`,
            color: "from-emerald-500 to-green-500",
            bgGlow: "rgba(34, 197, 94, 0.25)"
        },
        {
            label: "Progress",
            value: stats.progress_percent || 0,
            bgImage: "/placeholders/progress-bg.jpg", // Replace with actual image path
            suffix: "%",
            color: "from-indigo-500 to-purple-500",
            bgGlow: "rgba(99, 102, 241, 0.25)"
        },
        {
            label: "Time Invested",
            value: stats.completed_minutes ? Math.round(stats.completed_minutes / 60 * 10) / 10 : 0,
            bgImage: "/placeholders/time-bg.jpg", // Replace with actual image path
            suffix: "hrs",
            color: "from-cyan-500 to-blue-500",
            bgGlow: "rgba(6, 182, 212, 0.25)"
        }
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((card, i) => (
                <motion.div
                    key={card.label}
                    custom={i}
                    variants={statVariant}
                    initial="hidden"
                    animate="visible"
                    className="stat-card group cursor-default relative overflow-visible"
                >
                    {/* Shadow Glow Layer */}
                    <div
                        className="absolute inset-0 rounded-2xl pointer-events-none transition-shadow duration-300 mix-blend-screen"
                        style={{ boxShadow: `0 0 60px ${card.bgGlow}` }}
                    />

                    {/* Background Image Holder */}
                    <div
                        className="absolute inset-0 bg-cover bg-center opacity-20 blur-[2px] transition-opacity duration-300 group-hover:opacity-30 rounded-2xl overflow-hidden pointer-events-none z-0"
                        style={{ backgroundImage: `url(${card.bgImage})` }}
                    />

                    {/* Content wrapper to float above the background image */}
                    <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-center justify-end mb-2">
                            <span className={`h-2 w-2 rounded-full bg-gradient-to-r ${card.color}`}></span>
                        </div>
                        <div className="flex items-baseline gap-1.5 mt-auto">
                            <motion.span
                                className="text-3xl font-extrabold text-white"
                                key={card.value}
                                initial={{ scale: 1.2, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.3 }}
                            >
                                {card.value}
                            </motion.span>
                            <span className="text-sm text-gray-400 font-medium">{card.suffix}</span>
                        </div>
                        <span className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-1">{card.label}</span>
                    </div>
                </motion.div>
            ))}
        </div>
    );
};

export default StatsPanel;
