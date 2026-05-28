'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Lock, FileText, Settings, Sparkles, Check, 
  Trash2, Upload, AlertCircle, Plus, Eye, Save, HelpCircle 
} from 'lucide-react';

interface QuestionDraft {
  id: string;
  subject: string;
  topic: string;
  question_text: string;
  options: string[];
  correct_option: number;
  explanation: string;
  image_url?: string;
  uploading?: boolean;
}

export default function AdminPage() {
  // Authorization States
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passcode, setPasscode] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);

  // Status message states
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Draft States
  const [drafts, setDrafts] = useState<QuestionDraft[]>([]);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Check authentication on mount
  useEffect(() => {
    const savedPasscode = sessionStorage.getItem('admin_passcode');
    if (savedPasscode) {
      verifyPasscode(savedPasscode);
    } else {
      setCheckingAuth(false);
    }
  }, []);

  // 2. LocalStorage Draft Recovery
  useEffect(() => {
    if (isAuthenticated) {
      const keys = Object.keys(localStorage);
      const draftKeys = keys.filter(k => k.startsWith('admin_draft_'));
      if (draftKeys.length > 0) {
        draftKeys.sort();
        const latestKey = draftKeys[draftKeys.length - 1];
        const savedDrafts = localStorage.getItem(latestKey);
        if (savedDrafts && drafts.length === 0) {
          try {
            setDrafts(JSON.parse(savedDrafts));
            setSuccessMsg('मागील मसुदा (draft) पुनर्प्राप्त केला गेला आहे.');
          } catch (e) {
            console.error('Failed to parse saved drafts');
          }
        }
      }
    }
  }, [isAuthenticated]);

  // 3. Save draft to localStorage whenever drafts change
  useEffect(() => {
    if (isAuthenticated && drafts.length > 0) {
      const timestamp = new Date().getTime();
      const keys = Object.keys(localStorage);
      keys.filter(k => k.startsWith('admin_draft_')).forEach(k => localStorage.removeItem(k));
      
      localStorage.setItem(`admin_draft_${timestamp}`, JSON.stringify(drafts));
    }
  }, [drafts, isAuthenticated]);

  const verifyPasscode = async (codeToVerify: string) => {
    setCheckingAuth(true);
    try {
      const res = await fetch('/api/verify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: codeToVerify }),
      });

      if (res.ok) {
        sessionStorage.setItem('admin_passcode', codeToVerify);
        setPasscode(codeToVerify);
        setIsAuthenticated(true);
        setAuthError('');
      } else {
        sessionStorage.removeItem('admin_passcode');
        setAuthError('Incorrect passcode. Please try again.');
      }
    } catch (err) {
      setAuthError('Server communication error.');
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode) return;
    verifyPasscode(passcode);
  };

  // 4. File Upload (JSON parser & validator)
  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setSuccessMsg('');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text);

        if (!Array.isArray(data)) {
          throw new Error('JSON formatted data must be a top-level array of question objects.');
        }

        // Validate structure
        const validatedDrafts: QuestionDraft[] = [];
        for (let i = 0; i < data.length; i++) {
          const item = data[i];
          const hasSubject = typeof item.subject === 'string' && item.subject.trim().length > 0;
          const hasTopic = typeof item.topic === 'string' && item.topic.trim().length > 0;
          const hasQuestion = typeof item.question_text === 'string' && item.question_text.trim().length > 0;
          const hasExplanation = typeof item.explanation === 'string' && item.explanation.trim().length > 0;
          const hasOptions = Array.isArray(item.options) && item.options.length === 4 && item.options.every((o: any) => typeof o === 'string' && o.trim().length > 0);
          const hasCorrectIdx = typeof item.correct_option === 'number' && item.correct_option >= 0 && item.correct_option <= 3;

          if (!hasSubject || !hasTopic || !hasQuestion || !hasExplanation || !hasOptions || !hasCorrectIdx) {
            throw new Error(`Question #${i + 1} is missing required fields. Ensure it has a non-empty subject, topic, question_text, explanation, correct_option (0-3), and exactly 4 non-empty options.`);
          }

          validatedDrafts.push({
            id: `json_${Date.now()}_${i}`,
            subject: item.subject.trim(),
            topic: item.topic.trim(),
            question_text: item.question_text.trim(),
            options: item.options.map((o: string) => o.trim()),
            correct_option: item.correct_option,
            explanation: item.explanation.trim(),
          });
        }

        setDrafts(prev => [...prev, ...validatedDrafts]);
        setSuccessMsg(`Success! ${validatedDrafts.length} questions loaded into draft list from file.`);
        
        // Reset file input value
        if (jsonFileInputRef.current) {
          jsonFileInputRef.current.value = '';
        }
      } catch (err: any) {
        console.error(err);
        setErrorMsg(`JSON Parsing Error: ${err.message || 'Check the file format.'}`);
      }
    };
    reader.readAsText(file);
  };

  // 5. Image uploads to Supabase math-figures bucket
  const handleImageUpload = async (draftId: string, file: File) => {
    if (!file) return;

    setDrafts(prev => prev.map(d => d.id === draftId ? { ...d, uploading: true } : d));

    try {
      const ext = file.name.split('.').pop() || 'png';
      const draftItem = drafts.find(d => d.id === draftId);
      const topicSlug = draftItem && draftItem.topic 
        ? encodeURIComponent(draftItem.topic.toLowerCase().replace(/[^a-z0-9]/gi, '-')) 
        : 'general';
      const fileUuid = crypto.randomUUID();
      const path = `math-figures/${topicSlug}/${fileUuid}.${ext}`;

      const { data, error } = await supabase.storage
        .from('math-figures')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('math-figures')
        .getPublicUrl(path);

      setDrafts(prev => prev.map(d => d.id === draftId ? { 
        ...d, 
        image_url: urlData.publicUrl, 
        uploading: false 
      } : d));

      setSuccessMsg('Figure uploaded successfully!');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Upload failed: ${err.message || 'Error'}`);
      setDrafts(prev => prev.map(d => d.id === draftId ? { ...d, uploading: false } : d));
    }
  };

  // 6. Draft Card edits
  const updateDraftField = (id: string, field: keyof QuestionDraft, value: any) => {
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const updateDraftOption = (id: string, optIdx: number, val: string) => {
    setDrafts(prev => prev.map(d => {
      if (d.id === id) {
        const newOptions = [...d.options];
        newOptions[optIdx] = val;
        return { ...d, options: newOptions };
      }
      return d;
    }));
  };

  const deleteDraft = (id: string) => {
    setDrafts(prev => prev.filter(d => d.id !== id));
  };

  const addNewDraftCard = () => {
    const newCard: QuestionDraft = {
      id: `manual_${Date.now()}`,
      subject: '',
      topic: '',
      question_text: '',
      options: ['', '', '', ''],
      correct_option: 0,
      explanation: '',
    };
    setDrafts([...drafts, newCard]);
  };

  const clearAllDrafts = () => {
    if (confirm('Are you sure you want to clear all draft cards?')) {
      setDrafts([]);
      const keys = Object.keys(localStorage);
      keys.filter(k => k.startsWith('admin_draft_')).forEach(k => localStorage.removeItem(k));
    }
  };

  // 7. Save approved drafts to database via secure /api/save-questions route
  const handleSaveToDatabase = async () => {
    if (drafts.length === 0) return;

    const invalid = drafts.find(d => 
      !d.subject.trim() ||
      !d.topic.trim() ||
      !d.question_text.trim() || 
      d.options.some(opt => !opt.trim()) || 
      !d.explanation.trim()
    );

    if (invalid) {
      setErrorMsg('Please ensure all drafts have a subject, topic, question, all 4 options, and an explanation filled out.');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/save-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          passcode,
          questions: drafts,
        }),
      });

      const responseData = await res.json();

      if (!res.ok) {
        throw new Error(responseData.error || 'Failed to save questions.');
      }

      setSuccessMsg(`Success! ${responseData.count} questions saved to database and are now live.`);
      setDrafts([]);
      const keys = Object.keys(localStorage);
      keys.filter(k => k.startsWith('admin_draft_')).forEach(k => localStorage.removeItem(k));
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Database save error: ${err.message || 'Error occurred.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800 font-mukta">
        <div className="animate-spin text-indigo-650 mb-4">
          <Sparkles className="w-12 h-12" />
        </div>
        <p className="text-slate-500 text-lg">Authenticating...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 font-mukta">
        <div className="w-full max-w-md p-8 bg-white rounded-2xl border border-slate-200 shadow-xl text-center">
          <div className="w-16 h-16 mx-auto mb-6 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-655 border border-indigo-100">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">MAHATET Admin Panel</h1>
          <p className="text-slate-500 text-sm mb-6">Enter passcode to access Admin features and upload questions.</p>
          
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="Enter passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-850 placeholder-slate-400 focus:outline-none focus:border-indigo-550 transition-colors text-center font-sans tracking-widest text-lg"
                required
              />
            </div>
            
            {authError && (
              <div className="flex items-center justify-center space-x-2 text-red-500 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 hover:scale-[1.005]"
            >
              <span>Verify Access</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-mukta py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4 sm:space-y-0">
          <div>
            <div className="flex items-center space-x-3">
              <span className="p-2 bg-indigo-50 rounded-xl text-indigo-650 border border-indigo-100">
                <Settings className="w-6 h-6" />
              </span>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-850">MAHATET Admin Panel</h1>
            </div>
            <p className="text-slate-550 mt-1 text-sm">Upload, edit, and publish offline questions to the database</p>
          </div>
          <div className="flex space-x-3">
            <a 
              href="/"
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 text-sm font-semibold transition-all shadow-sm"
            >
              Go to Dashboard
            </a>
          </div>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start space-x-3 text-red-800 animate-fade-in">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start space-x-3 text-emerald-800 animate-fade-in">
            <Check className="w-5 h-5 flex-shrink-0 text-emerald-500 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Form: File Upload Panel */}
          <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 h-fit">
            <div className="flex items-center space-x-2 pb-4 border-b border-slate-100">
              <Upload className="w-5 h-5 text-indigo-600" />
              <h2 className="text-xl font-bold">Upload Center</h2>
            </div>

            {/* Drag & Drop JSON upload zone */}
            <div 
              onClick={() => jsonFileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 hover:border-indigo-500 rounded-xl p-8 text-center cursor-pointer bg-slate-50 hover:bg-indigo-50/10 transition-all flex flex-col items-center justify-center space-y-2 group"
            >
              <input
                type="file"
                accept=".json"
                ref={jsonFileInputRef}
                onChange={handleJsonUpload}
                className="hidden"
              />
              <div className="p-3 bg-white border border-slate-200 rounded-full text-slate-400 group-hover:text-indigo-600 transition-colors shadow-sm">
                <FileText className="w-6 h-6" />
              </div>
              <div className="font-semibold text-slate-700">JSON फाईल निवडा</div>
              <p className="text-slate-400 text-xs mt-1">Select a `.json` file containing question datasets from your computer.</p>
            </div>

            {/* Instruction Format Block */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <h4 className="font-bold text-sm text-slate-700 flex items-center space-x-1.5">
                <HelpCircle className="w-4 h-4 text-indigo-600" />
                <span>Format Guide (JSON)</span>
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Your JSON file should contain a root array containing question entries with `subject`, `topic`, `question_text`, `options` (exactly 4 strings), `correct_option` (index 0 to 3), and `explanation`.
              </p>
              <div className="text-[10px] bg-slate-150 p-2.5 rounded font-mono text-slate-600 overflow-x-auto whitespace-pre leading-normal">
{`[
  {
    "subject": "मराठी",
    "topic": "व्याकरण",
    "question_text": "...",
    "options": ["A", "B", "C", "D"],
    "correct_option": 0,
    "explanation": "..."
  }
]`}
              </div>
            </div>
          </div>

          {/* List: Draft UI */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h2 className="text-xl font-bold">Draft List ({drafts.length})</h2>
              </div>
              
              <div className="flex space-x-2">
                {drafts.length > 0 && (
                  <button
                    onClick={clearAllDrafts}
                    className="p-2 bg-red-50 text-red-650 hover:bg-red-100 border border-red-200 rounded-lg transition-colors text-xs flex items-center space-x-1"
                    title="Clear drafts"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Clear All</span>
                  </button>
                )}
                <button
                  onClick={addNewDraftCard}
                  className="p-2 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors text-xs flex items-center space-x-1 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Manually</span>
                </button>
              </div>
            </div>

            {drafts.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 bg-white border border-dashed border-slate-200 rounded-2xl text-center space-y-4 shadow-sm">
                <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-500">No questions drafted yet</h3>
                  <p className="text-slate-400 text-sm mt-1 max-w-sm">Choose and upload a JSON file from the Upload Center, or add draft cards manually to get started.</p>
                </div>
                <button
                  onClick={addNewDraftCard}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center space-x-1 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Card</span>
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Draft Cards */}
                {drafts.map((draft, index) => (
                  <div 
                    key={draft.id} 
                    className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4 relative"
                  >
                    <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                      <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-indigo-650 rounded-full font-sans">
                        Question #{index + 1}
                      </span>
                      <button
                        onClick={() => deleteDraft(draft.id)}
                        className="text-slate-400 hover:text-red-500 transition-colors p-1"
                        title="Delete card"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Subject and Topic Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Subject (विषय)</label>
                        <input
                          type="text"
                          value={draft.subject}
                          onChange={(e) => updateDraftField(draft.id, 'subject', e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
                          placeholder="e.g. बालमानसशास्त्र"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Topic (घटक)</label>
                        <input
                          type="text"
                          value={draft.topic}
                          onChange={(e) => updateDraftField(draft.id, 'topic', e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
                          placeholder="e.g. अध्यापन पद्धती"
                        />
                      </div>
                    </div>

                    {/* Question text */}
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Question (मजकूर - Marathi)</label>
                      <textarea
                        value={draft.question_text}
                        onChange={(e) => updateDraftField(draft.id, 'question_text', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
                        placeholder="प्रश्न मजकूर..."
                      />
                    </div>

                    {/* Options Grid */}
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Options (पर्याय)</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {draft.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name={`correct_opt_${draft.id}`}
                              checked={draft.correct_option === optIdx}
                              onChange={() => updateDraftField(draft.id, 'correct_option', optIdx)}
                              className="accent-indigo-650 w-4 h-4 cursor-pointer"
                              title="Set as correct"
                            />
                            <div className="relative w-full">
                              <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-sans font-semibold">
                                {optIdx + 1}.
                              </span>
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => updateDraftOption(draft.id, optIdx, e.target.value)}
                                className={`w-full pl-7 pr-3 py-2 bg-slate-50 border rounded-lg text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors text-sm ${
                                  draft.correct_option === optIdx ? 'border-emerald-300 bg-emerald-50/10' : 'border-slate-200'
                                }`}
                                placeholder={`Option ${optIdx + 1}`}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Explanation */}
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Explanation (स्पष्टीकरण - Marathi)</label>
                      <textarea
                        value={draft.explanation}
                        onChange={(e) => updateDraftField(draft.id, 'explanation', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
                        placeholder="स्पष्टीकरण मजकूर..."
                      />
                    </div>

                    {/* Math Figure / Image Attach */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 gap-3">
                      <div className="flex items-center space-x-3">
                        <input
                          type="file"
                          accept="image/*"
                          ref={el => { fileInputRefs.current[draft.id] = el; }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(draft.id, file);
                          }}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRefs.current[draft.id]?.click()}
                          disabled={draft.uploading}
                          className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 disabled:opacity-50 shadow-sm"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>{draft.uploading ? 'Uploading...' : 'Add Figure / Image'}</span>
                        </button>
                        
                        {draft.image_url ? (
                          <div className="flex items-center space-x-1.5 text-xs text-indigo-650 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">
                            <Eye className="w-3.5 h-3.5" />
                            <a href={draft.image_url} target="_blank" rel="noreferrer" className="underline truncate max-w-[120px] sm:max-w-[200px]">
                              View Image
                            </a>
                            <button
                              onClick={() => updateDraftField(draft.id, 'image_url', undefined)}
                              className="text-red-500 hover:text-red-700 ml-1 font-bold"
                              title="Remove image"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">No math figure attached (optional)</span>
                        )}
                      </div>
                    </div>

                  </div>
                ))}

                {/* DB Publisher action bar */}
                <div className="p-4 bg-white border border-slate-200 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm">
                  <div className="text-center sm:text-left">
                    <h3 className="font-bold text-slate-800">Publish Approved Questions</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Push the entire draft list directly to your Supabase live database.</p>
                  </div>
                  
                  <button
                    onClick={handleSaveToDatabase}
                    disabled={isSaving}
                    className="w-full sm:w-auto px-6 py-2.5 bg-emerald-650 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center space-x-2"
                  >
                    {isSaving ? (
                      <>
                        <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save All Approved</span>
                      </>
                    )}
                  </button>
                </div>

              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
