import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getNotes, saveNotes } from '../services/api';

/**
 * Safely parse the raw content from the backend.
 * Old data may have been stored as a JSON array: [{id, text, date}...]
 * New data is stored as plain text. We handle both gracefully.
 */
const parseRawContent = (raw) => {
    if (!raw || typeof raw !== 'string') return { text: '', savedNotes: [] };

    const trimmed = raw.trim();
    if (trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                // Migrate: join all old note texts into a single saved-notes list
                const savedNotes = parsed.map((n) => ({
                    id: n.id || Date.now(),
                    text: (n.text || '').replace(/\\n/g, '\n'),
                    date: n.date || new Date().toISOString(),
                }));
                return { text: '', savedNotes };
            }
        } catch (_) {
            // fall through — treat as plain text
        }
    }

    // Try to parse as a JSON object with our new format
    if (trimmed.startsWith('{')) {
        try {
            const parsed = JSON.parse(trimmed);
            return {
                text: parsed.draft || '',
                savedNotes: parsed.savedNotes || [],
            };
        } catch (_) {
            // fall through
        }
    }

    // Plain string — treat entire content as a single pre-existing saved note
    // only if it looks like meaningful content
    return { text: '', savedNotes: trimmed ? [{ id: Date.now(), text: trimmed, date: new Date().toISOString() }] : [] };
};

/**
 * Serialize our state back to the format we store on the backend.
 */
const serializeContent = (draft, savedNotes) => {
    return JSON.stringify({ draft, savedNotes });
};

const formatDate = (iso) => {
    try {
        return new Date(iso).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    } catch (_) {
        return '';
    }
};

const QuickNotes = ({ forceRefresh }) => {
    const [draft, setDraft] = useState('');
    const [savedNotes, setSavedNotes] = useState([]);
    const [notesSaving, setNotesSaving] = useState(false);
    const [notesSaved, setNotesSaved] = useState(false);

    useEffect(() => {
        const fetchNotes = async () => {
            try {
                const data = await getNotes();
                const { text, savedNotes: notes } = parseRawContent(data.content || '');
                setDraft(text);
                setSavedNotes(notes);
            } catch (e) {
                console.error('Failed to fetch notes', e);
            }
        };
        fetchNotes();
    }, [forceRefresh]);

    const handleSaveNotes = async () => {
        if (!draft.trim()) return;
        try {
            setNotesSaving(true);
            const newNote = {
                id: Date.now(),
                text: draft.trim(),
                date: new Date().toISOString(),
            };
            const updatedNotes = [newNote, ...savedNotes];
            const serialized = serializeContent('', updatedNotes);
            await saveNotes(serialized);
            setSavedNotes(updatedNotes);
            setDraft('');
            setNotesSaved(true);
            setTimeout(() => setNotesSaved(false), 2000);
        } catch (e) {
            console.error('Failed to save notes', e);
        } finally {
            setNotesSaving(false);
        }
    };

    const handleDeleteNote = async (id) => {
        try {
            const updatedNotes = savedNotes.filter((n) => n.id !== id);
            const serialized = serializeContent(draft, updatedNotes);
            await saveNotes(serialized);
            setSavedNotes(updatedNotes);
        } catch (e) {
            console.error('Failed to delete note', e);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="glass-card p-8 gradient-border"
        >
            {/* Header */}
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

            {/* Input textarea */}
            <textarea
                className="w-full p-4 rounded-xl border transition-all duration-300 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm resize-none custom-scrollbar"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', minHeight: '120px' }}
                placeholder="Jot down key concepts, reminders, or anything you want to remember..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={5}
            />

            {/* Save Button */}
            <button
                type="button"
                onClick={handleSaveNotes}
                disabled={notesSaving || !draft.trim()}
                className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                    background: 'rgba(99, 102, 241, 0.1)',
                    color: '#818cf8',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                }}
                onMouseEnter={(e) => { if (!e.currentTarget.disabled) { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)'; e.currentTarget.style.color = '#a5b4fc'; } }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'; e.currentTarget.style.color = '#818cf8'; }}
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
                        Save Note
                    </>
                )}
            </button>

            {/* Saved Notes List */}
            <AnimatePresence>
                {savedNotes.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-5"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                                Saved Notes ({savedNotes.length})
                            </span>
                            <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
                        </div>
                        <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                            {savedNotes.map((note) => (
                                <motion.div
                                    key={note.id}
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="group flex items-start gap-3 p-3 rounded-xl border"
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        borderColor: 'var(--border)',
                                    }}
                                >
                                    {/* Note icon */}
                                    <div className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-md flex items-center justify-center"
                                        style={{ background: 'rgba(99,102,241,0.15)' }}>
                                        <svg className="w-3 h-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </div>
                                    {/* Note content */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
                                            {note.text}
                                        </p>
                                        <p className="text-xs text-gray-600 mt-1.5">{formatDate(note.date)}</p>
                                    </div>
                                    {/* Delete button */}
                                    <button
                                        onClick={() => handleDeleteNote(note.id)}
                                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-red-500/20 text-gray-600 hover:text-red-400"
                                        title="Delete note"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default QuickNotes;
