'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Lock, FileText, Settings, Sparkles, Check, 
  Trash2, Upload, AlertCircle, Plus, Eye, Save, HelpCircle, Search, RefreshCw 
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

interface DBQuestion {
  id: string;
  subject: string;
  topic: string;
  question_text: string;
  options: string[];
  correct_option: number;
  explanation: string;
  image_url?: string | null;
  created_at: string;
}

export default function AdminPage() {
  // Authorization States
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passcode, setPasscode] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);

  // Tabs state
  const [activeTab, setActiveTab] = useState<'upload' | 'manager' | 'history'>('upload');

  // Status message states
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Upload Center Draft States
  const [drafts, setDrafts] = useState<QuestionDraft[]>([]);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);

  // Question Bank Manager States
  const [dbQuestions, setDbQuestions] = useState<DBQuestion[]>([]);
  const [loadingDb, setLoadingDb] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedManagerSubject, setSelectedManagerSubject] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Past Tests Manager States
  const [adminTests, setAdminTests] = useState<any[]>([]);
  const [loadingTests, setLoadingTests] = useState<boolean>(false);
  const [deletingTestId, setDeletingTestId] = useState<string | null>(null);

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

  // 4. Fetch all questions from database for Manager Tab
  const fetchDatabaseQuestions = async () => {
    setLoadingDb(true);
    setErrorMsg('');
    try {
      // Questions have a Public read SELECT policy, so we can fetch them on client side
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDbQuestions(data || []);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Failed to load database questions: ${err.message || 'Error occurred.'}`);
    } finally {
      setLoadingDb(false);
    }
  };

  // Trigger fetch when tab switches to Manager
  useEffect(() => {
    if (isAuthenticated && activeTab === 'manager') {
      fetchDatabaseQuestions();
    }
  }, [activeTab, isAuthenticated]);

  const fetchAllTestHistory = async () => {
    setLoadingTests(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/admin/test-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': passcode,
        },
        body: JSON.stringify({ passcode }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch test history.');
      }
      setAdminTests(data.testHistory || []);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`चाचणी इतिहास लोड करताना त्रुटी आली: ${err.message || 'Error occurred.'}`);
    } finally {
      setLoadingTests(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && activeTab === 'history') {
      fetchAllTestHistory();
    }
  }, [activeTab, isAuthenticated]);

  // 5. Deleting a question from Manager
  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question? This action is permanent.')) return;

    setDeletingId(questionId);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/delete-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': passcode,
        },
        body: JSON.stringify({
          passcode,
          questionId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete question.');
      }

      setSuccessMsg('Question deleted successfully.');
      // Remove from local list
      setDbQuestions(prev => prev.filter(q => q.id !== questionId));
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Deletion error: ${err.message || 'Error occurred.'}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteTestByAdmin = async (userId: string, testId: string) => {
    if (!confirm('Are you sure you want to delete this test record? This action is permanent.')) return;

    setDeletingTestId(testId);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/delete-test-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': passcode,
        },
        body: JSON.stringify({
          userId,
          testId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete test history.');
      }

      setSuccessMsg('Test history record deleted successfully.');
      setAdminTests(prev => prev.filter(t => t.id !== testId));
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Deletion error: ${err.message || 'Error occurred.'}`);
    } finally {
      setDeletingTestId(null);
    }
  };

  // 6. JSON Upload parse & validator
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

  // 7. Image uploads to Supabase math-figures bucket
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

  // 8. Draft Card edits
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

  // 9. Save approved drafts to database via secure API
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
          'x-admin-key': passcode,
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

  // Filter manager database questions list based on Search & Subject filters
  const filteredDbQuestions = dbQuestions.filter((q) => {
    const matchesSearch = 
      q.question_text.toLowerCase().includes(searchQuery.toLowerCase()) || 
      q.topic.toLowerCase().includes(searchQuery.toLowerCase()) || 
      q.subject.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSubject = 
      selectedManagerSubject === 'all' || 
      q.subject === selectedManagerSubject;
    
    return matchesSearch && matchesSubject;
  });

  // Extract unique subjects for dropdown filter
  const managerSubjects = Array.from(new Set(dbQuestions.map(q => q.subject))).filter(Boolean);

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800 font-mukta">
        <div className="animate-spin text-indigo-655 mb-4">
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
    <div className="min-h-screen bg-slate-50 text-slate-850 font-mukta py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4 sm:space-y-0">
          <div>
            <div className="flex items-center space-x-3">
              <span className="p-2 bg-indigo-50 rounded-xl text-indigo-650 border border-indigo-100">
                <Settings className="w-6 h-6" />
              </span>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-850">MAHATET Admin Panel</h1>
            </div>
            <p className="text-slate-550 mt-1 text-sm">Manage, edit, upload, and delete database questions</p>
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

        {/* Navigation Tabs */}
        <div className="flex space-x-1 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-5 py-2.5 font-bold text-sm border-b-2 transition-all ${
              activeTab === 'upload'
                ? 'border-indigo-650 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Upload Center / मसुदा
          </button>
          <button
            onClick={() => setActiveTab('manager')}
            className={`px-5 py-2.5 font-bold text-sm border-b-2 transition-all ${
              activeTab === 'manager'
                ? 'border-indigo-650 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Question Bank Manager / प्रश्न व्यवस्थापन
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-5 py-2.5 font-bold text-sm border-b-2 transition-all ${
              activeTab === 'history'
                ? 'border-indigo-650 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Past Tests Manager / चाचणी इतिहास
          </button>
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

        {/* TAB 1: UPLOAD CENTER */}
        {activeTab === 'upload' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
            
            {/* Left Upload panel */}
            <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 h-fit">
              <div className="flex items-center space-x-2 pb-4 border-b border-slate-100">
                <Upload className="w-5 h-5 text-indigo-600" />
                <h2 className="text-xl font-bold">Upload Center</h2>
              </div>

              {/* Upload field */}
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
                <div className="p-3 bg-white border border-slate-200 rounded-full text-slate-400 group-hover:text-indigo-650 transition-colors shadow-sm">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="font-semibold text-slate-700">JSON फाईल निवडा</div>
                <p className="text-slate-400 text-xs mt-1">Select a `.json` file containing question datasets from your computer.</p>
              </div>

              {/* Format Guide */}
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

            {/* Right Draft Cards List */}
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
                      className="p-2 bg-red-50 text-red-655 hover:bg-red-105 border border-red-200 rounded-lg transition-colors text-xs flex items-center space-x-1"
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
                  {/* Draft Cards list */}
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
                          className="text-slate-400 hover:text-red-505 transition-colors p-1"
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
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-505 transition-colors text-sm"
                            placeholder="e.g. बालमानसशास्त्र"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Topic (घटक)</label>
                          <input
                            type="text"
                            value={draft.topic}
                            onChange={(e) => updateDraftField(draft.id, 'topic', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-505 transition-colors text-sm"
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
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-505 transition-colors text-sm"
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

                      {/* Image attachments */}
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
                                className="text-red-500 hover:text-red-750 ml-1 font-bold"
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

                  {/* Save button block */}
                  <div className="p-4 bg-white border border-slate-200 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm">
                    <div>
                      <h3 className="font-bold text-slate-805">Publish Approved Questions</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Push the entire draft list directly to your Supabase live database.</p>
                    </div>
                    
                    <button
                      onClick={handleSaveToDatabase}
                      disabled={isSaving}
                      className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center space-x-2"
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
        )}

        {/* TAB 2: QUESTION BANK MANAGER */}
        {activeTab === 'manager' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold">Question Bank Manager</h2>
                <p className="text-xs text-slate-400 mt-0.5">View and delete currently published questions</p>
              </div>

              {/* Search & Filtering controls */}
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                {/* Search query input */}
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2.5 text-slate-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search questions, topics..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>

                {/* Subject filter dropdown */}
                <select
                  value={selectedManagerSubject}
                  onChange={(e) => setSelectedManagerSubject(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-indigo-500 text-sm"
                >
                  <option value="all">All Subjects (सर्व विषय)</option>
                  {managerSubjects.map((sub, idx) => (
                    <option key={idx} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
            </div>

            {loadingDb ? (
              <div className="flex flex-col items-center justify-center p-12 text-slate-500">
                <RefreshCw className="w-8 h-8 animate-spin mb-2 text-indigo-650" />
                <p className="text-sm">Loading questions from database...</p>
              </div>
            ) : filteredDbQuestions.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl bg-slate-50">
                <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-slate-500 font-semibold text-sm">No questions found</p>
                <p className="text-slate-400 text-xs mt-1">Try resetting filters or upload a question file first.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {filteredDbQuestions.map((q, idx) => (
                  <div 
                    key={q.id}
                    className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-slate-300 transition-colors"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-650 rounded-md">
                          {q.subject}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-650 rounded-md">
                          {q.topic}
                        </span>
                        {q.image_url && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-655 rounded-md flex items-center space-x-0.5">
                            <Eye className="w-3 h-3" />
                            <span>Figure</span>
                          </span>
                        )}
                      </div>

                      <div className="font-bold text-sm text-slate-800 leading-normal">
                        <span className="font-sans mr-1">{idx + 1}.</span> {q.question_text}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-500">
                        {q.options.map((opt, optIdx) => (
                          <div 
                            key={optIdx} 
                            className={`p-1.5 border rounded-md truncate ${
                              optIdx === q.correct_option 
                                ? 'border-emerald-300 bg-emerald-50/20 text-emerald-800 font-bold' 
                                : 'border-slate-150 bg-white'
                            }`}
                          >
                            <span className="font-sans font-semibold mr-1">{optIdx + 1}.</span>
                            {opt}
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      disabled={deletingId === q.id}
                      className="px-3.5 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-655 hover:text-red-750 font-bold rounded-lg text-xs transition-colors shrink-0 flex items-center space-x-1.5 disabled:opacity-50"
                    >
                      {deletingId === q.id ? (
                        <>
                          <span className="animate-spin inline-block w-3 h-3 border border-red-500 border-t-transparent rounded-full"></span>
                          <span>Deleting...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </>
                      )}
                    </button>

                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PAST TESTS HISTORY MANAGER */}
        {activeTab === 'history' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 animate-fade-in">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold">Past Tests History Manager</h2>
                <p className="text-xs text-slate-400 mt-0.5">View and delete completed test history records across all users</p>
              </div>
              <button
                onClick={fetchAllTestHistory}
                disabled={loadingTests}
                className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            {loadingTests ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin mb-2" />
                <span className="text-sm">Loading test history...</span>
              </div>
            ) : adminTests.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 border border-slate-200 border-dashed rounded-xl">
                <HelpCircle className="w-8 h-8 text-slate-350 mx-auto mb-2" />
                <p className="text-slate-500 font-semibold text-sm">No test history records found.</p>
                <p className="text-slate-400 text-xs mt-1">Completed tests taken by students will appear here.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1 font-mukta text-slate-800">
                {adminTests.map((test) => {
                  const percentage = test.total_questions > 0 ? Math.round((test.score / test.total_questions) * 100) : 0;
                  const isSuccess = percentage >= 40;
                  
                  return (
                    <div 
                      key={test.id} 
                      className="p-4 bg-slate-50 hover:bg-slate-100/70 border border-slate-250 rounded-xl transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                            test.test_type === 'topic-wise' 
                              ? 'bg-indigo-50 border border-indigo-100 text-indigo-700' 
                              : 'bg-amber-50 border border-amber-100 text-amber-700'
                          }`}>
                            {test.test_type === 'topic-wise' ? 'विषयनिहाय चाचणी' : 'मिश्रित चाचणी'}
                          </span>
                          <span className="text-[10px] text-slate-450 font-sans">
                            Date: {new Date(test.created_at).toLocaleString('en-US', { hour12: true })}
                          </span>
                        </div>
                        <div className="text-sm font-bold text-slate-800 truncate">
                          Topics: {test.topics && test.topics.length > 0 ? test.topics.join(', ') : 'सामान्य'}
                        </div>
                        <div className="text-[11px] text-indigo-650 font-semibold select-all font-sans">
                          सरावकर्ता: <span className="font-bold font-mukta">{test.login_id}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-2.5 md:pt-0 border-slate-200">
                        <div className="flex items-center space-x-2">
                          <div className="text-right">
                            <div className="text-[10px] text-slate-400 font-semibold uppercase">Score</div>
                            <div className="text-sm font-bold text-slate-800 font-sans">
                              {test.score} / {test.total_questions}
                            </div>
                          </div>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold font-sans shadow-sm ${
                            isSuccess 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            {percentage}%
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteTestByAdmin(test.user_id, test.id)}
                          disabled={deletingTestId === test.id}
                          className="px-3.5 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-655 hover:text-red-750 font-bold rounded-lg text-xs transition-colors shrink-0 flex items-center space-x-1.5 disabled:opacity-50"
                        >
                          {deletingTestId === test.id ? (
                            <>
                              <span className="animate-spin inline-block w-3 h-3 border border-red-500 border-t-transparent rounded-full"></span>
                              <span>Deleting...</span>
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
