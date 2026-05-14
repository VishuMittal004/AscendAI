import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getNotes, saveNotes } from '../services/api';

const QuickNotes = ({ forceRefresh }) => {
    const [notesList, setNotesList] = useState([]);
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'edit'
    const [activeNoteId, setActiveNoteId] = useState(null);
    const [currentText, setCurrentText] = useState('');
    
    const [notesSaving, setNotesSaving] = useState(false);
    const [notesSaved, setNotesSaved] = useState(false);

    useEffect(() => {
        const fetchNotes = async () => {
            try {
                const data = await getNotes();
                let parsed = [];
                if (data.content) {
                    try {
                        parsed = JSON.parse(data.content);
                        if (!Array.isArray(parsed)) throw new Error('Not an array');
                    } catch (err) {
                        // Migration: convert old string note to the first note in the array
                        parsed = [{ id: Date.now().toString(), text: data.content, date: new Date().toISOString() }];
                    }
                }
                setNotesList(parsed);
            } catch (e) {
                console.error('Failed to fetch notes', e);
            }
        };
        fetchNotes();
    }, [forceRefresh]);

    const saveNotesList = async (newList) => {
        try {
            setNotesSaving(true);
            await saveNotes(JSON.stringify(newList));
            setNotesList(newList);
            setNotesSaved(true);
            setTimeout(() => setNotesSaved(false), 2000);
        } catch (e) {
            console.error('Failed to save notes', e);
        } finally {
            setNotesSaving(false);
        }
    };

    const handleNewNote = () => {
        setActiveNoteId(null);
        setCurrentText('');
        setViewMode('edit');
    };

    const handleEditNote = (note) => {
        setActiveNoteId(note.id);
        setCurrentText(note.text);
        setViewMode('edit');
    };

    const handleSaveCurrentNote = () => {
        if (!currentText.trim()) return;

        let newList = [...notesList];
        if (activeNoteId) {
            newList = newList.map(n => n.id === activeNoteId ? { ...n, text: currentText, date: new Date().toISOString() } : n);
        } else {
            const newNote = { id: Date.now().toString(), text: currentText, date: new Date().toISOString() };
            newList = [newNote, ...newList];
            setActiveNoteId(newNote.id);
        }
        saveNotesList(newList);
        setViewMode('list');
    };

    const handleDeleteNote = (id, e) => {
        e.stopPropagation();
        const newList = notesList.filter(n => n.id !== id);
        saveNotesList(newList);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="glass-card p-8 gradient-border flex flex-col h-[400px]"
        >
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div>
                    <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                        <span></span> Quick Notes
                    </h2>
                    <p className="text-sm text-gray-500">
                        {viewMode === 'list' ? 'Your saved thoughts & ideas.' : 'Write it down to NOT miss it.'}
                    </p>
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

            {viewMode === 'list' ? (
                <div className="flex-1 flex flex-col min-h-0">
                    <button
                        onClick={handleNewNote}
                        className="mb-4 w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 flex-shrink-0"
                        style={{
                            background: 'rgba(99, 102, 241, 0.1)',
                            color: '#818cf8',
                            border: '1px solid rgba(99, 102, 241, 0.2)',
                        }}
                        onMouseEnter={(e) => { e.target.style.background = 'rgba(99, 102, 241, 0.2)'; e.target.style.color = '#a5b4fc'; }}
                        onMouseLeave={(e) => { e.target.style.background = 'rgba(99, 102, 241, 0.1)'; e.target.style.color = '#818cf8'; }}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        New Note
                    </button>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                        {notesList.length === 0 ? (
                            <div className="text-center text-sm text-gray-500 py-6 italic">
                                No notes yet. Start writing!
                            </div>
                        ) : (
                            notesList.map((note) => (
                                <motion.div
                                    key={note.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    onClick={() => handleEditNote(note)}
                                    className="p-3 rounded-xl cursor-pointer group transition-all duration-200 border"
                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <p className="text-xs text-gray-400">
                                            {new Date(note.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        <button 
                                            onClick={(e) => handleDeleteNote(note.id, e)}
                                            className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Delete note"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                    <p className="text-sm text-gray-200 line-clamp-2">
                                        {note.text}
                                    </p>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col min-h-0">
                    <button 
                        onClick={() => setViewMode('list')}
                        className="self-start mb-3 text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1 flex-shrink-0"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to list
                    </button>
                    
                    <textarea
                        className="flex-1 w-full p-4 rounded-xl border transition-all duration-300 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm resize-none custom-scrollbar"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
                        placeholder="Jot down key concepts, reminders, or anything you want to remember..."
                        value={currentText}
                        onChange={(e) => setCurrentText(e.target.value)}
                    />
                    <button
                        type="button"
                        onClick={handleSaveCurrentNote}
                        disabled={notesSaving || !currentText.trim()}
                        className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                            background: 'rgba(99, 102, 241, 0.1)',
                            color: '#818cf8',
                            border: '1px solid rgba(99, 102, 241, 0.2)',
                        }}
                        onMouseEnter={(e) => { if(!e.target.disabled) { e.target.style.background = 'rgba(99, 102, 241, 0.2)'; e.target.style.color = '#a5b4fc'; } }}
                        onMouseLeave={(e) => { if(!e.target.disabled) { e.target.style.background = 'rgba(99, 102, 241, 0.1)'; e.target.style.color = '#818cf8'; } }}
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
                </div>
            )}
        </motion.div>
    );
};

export default QuickNotes;
