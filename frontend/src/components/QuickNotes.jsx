import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getNotes, saveNotes } from '../services/api';

const QuickNotes = ({ forceRefresh }) => {
    const [notes, setNotes] = useState('');
    const [notesSaving, setNotesSaving] = useState(false);
    const [notesSaved, setNotesSaved] = useState(false);

    useEffect(() => {
        const fetchNotes = async () => {
            try {
                const data = await getNotes();
                setNotes(data.content || '');
            } catch (e) {
                console.error('Failed to fetch notes', e);
            }
        };
        fetchNotes();
    }, [forceRefresh]);

    const handleSaveNotes = async () => {
        try {
            setNotesSaving(true);
            await saveNotes(notes);
            setNotesSaved(true);
            setTimeout(() => setNotesSaved(false), 2000);
        } catch (e) {
            console.error('Failed to save notes', e);
        } finally {
            setNotesSaving(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="glass-card p-8 gradient-border"
        >
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                        <span></span> Quick Notes
                    </h2>
                    <p className="text-sm text-gray-500">Write it down to NOT miss it.</p>
                </div>
                <AnimatePresence>
                    {notesSaved && (
                        <motion.span
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className="text-xs text-emerald-400 font-medium flex items-center gap-1"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            Saved!
                        </motion.span>
                    )}
                </AnimatePresence>
            </div>
            <textarea
                className="w-full p-4 rounded-xl border transition-all duration-300 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm resize-none custom-scrollbar"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', minHeight: '120px' }}
                placeholder="Jot down key concepts, reminders, or anything you want to remember..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
            />
            <button
                type="button"
                onClick={handleSaveNotes}
                disabled={notesSaving}
                className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2"
                style={{
                    background: 'rgba(99, 102, 241, 0.1)',
                    color: '#818cf8',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                }}
                onMouseEnter={(e) => { e.target.style.background = 'rgba(99, 102, 241, 0.2)'; e.target.style.color = '#a5b4fc'; }}
                onMouseLeave={(e) => { e.target.style.background = 'rgba(99, 102, 241, 0.1)'; e.target.style.color = '#818cf8'; }}
            >
                {notesSaving ? (
                    <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                    </>
                ) : (
                    <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        Save Notes
                    </>
                )}
            </button>
        </motion.div>
    );
};

export default QuickNotes;
