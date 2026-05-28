'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Lock, BookOpen, FileText, Settings, Sparkles, Check, 
  Trash2, Upload, AlertCircle, Plus, Eye, Save 
} from 'lucide-react';

interface QuestionDraft {
  id: string;
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

  // Input Station States
  const [topic, setTopic] = useState<string>('');
  const [referenceText, setReferenceText] = useState<string>('');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Draft States
  const [drafts, setDrafts] = useState<QuestionDraft[]>([]);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

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
        // Sort to get latest
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
      // Remove older drafts to avoid cluttering localStorage
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
        setAuthError('अयोग्य पासकोड. कृपया पुन्हा प्रयत्न करा.');
      }
    } catch (err) {
      setAuthError('सर्व्हरशी संपर्क साधताना त्रुटी आली.');
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode) return;
    verifyPasscode(passcode);
  };

  // 4. Call Gemini AI generator
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic || !referenceText) {
      setErrorMsg('कृपया विषय आणि संदर्भ मजकूर भरा.');
      return;
    }

    setIsGenerating(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': passcode,
        },
        body: JSON.stringify({
          topic,
          referenceText,
          questionCount,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'प्रश्न निर्मिती अपयशी ठरली.');
      }

      if (data.questions && Array.isArray(data.questions)) {
        const formattedQuestions: QuestionDraft[] = data.questions.map((q: any, idx: number) => ({
          id: `ai_${Date.now()}_${idx}`,
          question_text: q.question_text || '',
          options: q.options || ['', '', '', ''],
          correct_option: typeof q.correct_option === 'number' ? q.correct_option : 0,
          explanation: q.explanation || '',
        }));

        setDrafts([...drafts, ...formattedQuestions]);
        setSuccessMsg(`${formattedQuestions.length} नवीन प्रश्न यशस्वीरित्या मसुद्यात जोडले गेले.`);
        setTopic('');
        setReferenceText('');
      } else {
        throw new Error('अयोग्य प्रतिसाद स्वरूप (format).');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'प्रश्न निर्मितीदरम्यान त्रुटी आली.');
    } finally {
      setIsGenerating(false);
    }
  };

  // 5. Image uploads to Supabase math-figures bucket
  const handleImageUpload = async (draftId: string, file: File) => {
    if (!file) return;

    // Show loading indicator
    setDrafts(prev => prev.map(d => d.id === draftId ? { ...d, uploading: true } : d));

    try {
      const ext = file.name.split('.').pop() || 'png';
      // Create a URL-friendly topic slug
      const topicSlug = topic ? encodeURIComponent(topic.toLowerCase().replace(/[^a-z0-9]/gi, '-')) : 'general';
      const fileUuid = crypto.randomUUID();
      const path = `math-figures/${topicSlug}/${fileUuid}.${ext}`;

      const { data, error } = await supabase.storage
        .from('math-figures')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) throw error;

      // Fetch public URL
      const { data: urlData } = supabase.storage
        .from('math-figures')
        .getPublicUrl(path);

      setDrafts(prev => prev.map(d => d.id === draftId ? { 
        ...d, 
        image_url: urlData.publicUrl, 
        uploading: false 
      } : d));

      setSuccessMsg('चित्र यशस्वीरित्या अपलोड झाले!');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`चित्र अपलोड करण्यात अडचण आली: ${err.message || 'Error'}`);
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
      question_text: '',
      options: ['', '', '', ''],
      correct_option: 0,
      explanation: '',
    };
    setDrafts([...drafts, newCard]);
  };

  const clearAllDrafts = () => {
    if (confirm('तुम्हाला खरोखर सर्व मसुदा प्रश्न हटवायचे आहेत का?')) {
      setDrafts([]);
      const keys = Object.keys(localStorage);
      keys.filter(k => k.startsWith('admin_draft_')).forEach(k => localStorage.removeItem(k));
    }
  };

  // 7. Save approved drafts to database
  const handleSaveToDatabase = async () => {
    if (drafts.length === 0) return;

    // Validate drafts first
    const invalid = drafts.find(d => 
      !d.question_text.trim() || 
      d.options.some(opt => !opt.trim()) || 
      !d.explanation.trim()
    );

    if (invalid) {
      setErrorMsg('कृपया सर्व मसुदा कार्ड्समध्ये प्रश्न, सर्व ४ पर्याय आणि स्पष्टीकरण भरल्याची खात्री करा.');
      return;
    }

    setIsGenerating(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // Format data for insertion (strip local properties like id starting with 'ai_' and uploading state)
      const insertData = drafts.map(d => ({
        topic: topic || 'सामान्य', // Default topic if empty
        question_text: d.question_text.trim(),
        options: d.options.map(o => o.trim()),
        correct_option: d.correct_option,
        explanation: d.explanation.trim(),
        image_url: d.image_url || null,
      }));

      const { data, error } = await supabase
        .from('questions')
        .insert(insertData)
        .select();

      if (error) throw error;

      setSuccessMsg(`यशस्वी! ${data.length} प्रश्न डेटाबेसमध्ये जतन केले गेले असून ते आता थेट लाईव्ह आहेत.`);
      setDrafts([]);
      const keys = Object.keys(localStorage);
      keys.filter(k => k.startsWith('admin_draft_')).forEach(k => localStorage.removeItem(k));
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`डेटाबेसमध्ये सेव्ह करताना त्रुटी आली: ${err.message || 'Error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Loading indicator for authorization check
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white font-mukta">
        <div className="animate-spin text-indigo-500 mb-4">
          <Sparkles className="w-12 h-12" />
        </div>
        <p className="text-slate-400 text-lg">प्रमाणीकरण तपासत आहे...</p>
      </div>
    );
  }

  // Not authenticated view
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4 font-mukta">
        <div className="w-full max-w-md p-8 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl text-center">
          <div className="w-16 h-16 mx-auto mb-6 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-400 border border-indigo-500/20">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">अॅडमीन पॅनेल</h1>
          <p className="text-slate-400 text-sm mb-6">प्रश्नांची निर्मिती आणि व्यवस्थापन करण्यासाठी कृपया सुरक्षा पासकोड प्रविष्ट करा.</p>
          
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="पासकोड प्रविष्ट करा"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors text-center font-sans tracking-widest text-lg"
                required
              />
            </div>
            
            {authError && (
              <div className="flex items-center justify-center space-x-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center space-x-2 hover:scale-[1.01]"
            >
              <span>प्रवेश करा</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Authenticated Dashboard
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-mukta py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-900 shadow-xl space-y-4 sm:space-y-0">
          <div>
            <div className="flex items-center space-x-3">
              <span className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
                <Settings className="w-6 h-6" />
              </span>
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">प्रश्नांची फॅक्टरी (Admin)</h1>
            </div>
            <p className="text-slate-400 mt-1 text-sm">Gemini AI द्वारे मराठीमध्ये प्रश्न निर्मिती आणि संपादन</p>
          </div>
          <div className="flex space-x-3">
            <a 
              href="/"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-sm font-semibold transition-all"
            >
              डॅशबोर्डवर जा
            </a>
          </div>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="p-4 bg-red-950/40 border border-red-900/50 rounded-xl flex items-start space-x-3 text-red-200">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-4 bg-emerald-950/40 border border-emerald-900/50 rounded-xl flex items-start space-x-3 text-emerald-200">
            <Check className="w-5 h-5 flex-shrink-0 text-emerald-400 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Form: Input Station */}
          <div className="lg:col-span-1 bg-slate-900/40 border border-slate-900 rounded-2xl p-6 shadow-xl space-y-6 h-fit backdrop-blur-md">
            <div className="flex items-center space-x-2 pb-4 border-b border-slate-800">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <h2 className="text-xl font-bold">AI प्रश्न निर्मिती केंद्र</h2>
            </div>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">विषयाचे नाव / Topic Name</label>
                <input
                  type="text"
                  placeholder="उदा. भूमिती, मराठा साम्राज्य, भूगोल"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">संदर्भ मजकूर / Reference Text</label>
                <textarea
                  placeholder="येथे पाठ्यपुस्तक, नोट्स किंवा संदर्भ मजकूर पेस्ट करा ज्याच्या आधारे प्रश्न तयार करायचे आहेत..."
                  rows={8}
                  value={referenceText}
                  onChange={(e) => setReferenceText(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors text-sm font-sans"
                  required
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-slate-300">प्रश्नांची संख्या / Count: {questionCount}</label>
                  <span className="text-xs text-indigo-400 font-sans">1 - 20</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={questionCount}
                  onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                  className="w-full accent-indigo-500 bg-slate-950 border-none"
                />
              </div>

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-50 text-white font-semibold rounded-lg shadow-lg shadow-indigo-600/10 transition-all flex items-center justify-center space-x-2"
              >
                {isGenerating ? (
                  <>
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                    <span>प्रश्न तयार होत आहेत...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>AI प्रश्न व्युत्पन्न करा</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* List: Draft UI */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center p-4 bg-slate-900/40 border border-slate-900 rounded-xl backdrop-blur-md">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <h2 className="text-xl font-bold">मसुदा यादी / Draft List ({drafts.length})</h2>
              </div>
              
              {drafts.length > 0 && (
                <div className="flex space-x-2">
                  <button
                    onClick={clearAllDrafts}
                    className="p-2 bg-red-950/20 text-red-400 hover:bg-red-950/40 border border-red-900/30 rounded-lg transition-colors text-xs flex items-center space-x-1"
                    title="Clear drafts"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">सर्व काढा</span>
                  </button>
                  <button
                    onClick={addNewDraftCard}
                    className="p-2 bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors text-xs flex items-center space-x-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span>मैन्युअली जोडा</span>
                  </button>
                </div>
              )}
            </div>

            {drafts.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 bg-slate-900/10 border border-dashed border-slate-800 rounded-2xl text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-slate-600 border border-slate-800">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-400">सध्या कोणताही मसुदा उपलब्ध नाही</h3>
                  <p className="text-slate-600 text-sm mt-1 max-w-sm">बाजूच्या पॅनेलमधून संदर्भ मजकूर प्रविष्ट करून नवीन प्रश्न व्युत्पन्न करा किंवा मॅन्युअली नवीन कार्ड तयार करा.</p>
                </div>
                <button
                  onClick={addNewDraftCard}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-colors flex items-center space-x-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>पहिले मसुदा कार्ड जोडा</span>
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Draft Cards */}
                {drafts.map((draft, index) => (
                  <div 
                    key={draft.id} 
                    className="p-6 bg-slate-900/30 border border-slate-900 rounded-2xl shadow-xl space-y-4 backdrop-blur-md relative"
                  >
                    <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                      <span className="text-xs font-semibold px-2.5 py-1 bg-slate-800 text-indigo-400 rounded-full font-sans">
                        प्रश्न #{index + 1}
                      </span>
                      <button
                        onClick={() => deleteDraft(draft.id)}
                        className="text-slate-500 hover:text-red-400 transition-colors p-1"
                        title="Delete question"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Question text */}
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">प्रश्न मजकूर (Marathi)</label>
                      <textarea
                        value={draft.question_text}
                        onChange={(e) => updateDraftField(draft.id, 'question_text', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
                        placeholder="प्रश्न येथे लिहा..."
                      />
                    </div>

                    {/* Options Grid */}
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-slate-400 mb-1">पर्याय (Options)</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {draft.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name={`correct_opt_${draft.id}`}
                              checked={draft.correct_option === optIdx}
                              onChange={() => updateDraftField(draft.id, 'correct_option', optIdx)}
                              className="accent-indigo-500 w-4 h-4 cursor-pointer"
                              title="Set as correct"
                            />
                            <div className="relative w-full">
                              <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-sans font-semibold">
                                {optIdx + 1}.
                              </span>
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => updateDraftOption(draft.id, optIdx, e.target.value)}
                                className={`w-full pl-7 pr-3 py-2 bg-slate-950 border rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors text-sm ${
                                  draft.correct_option === optIdx ? 'border-emerald-900/60 bg-emerald-950/5' : 'border-slate-850'
                                }`}
                                placeholder={`पर्याय ${optIdx + 1}`}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Explanation */}
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">स्पष्टीकरण / Explanation (Marathi)</label>
                      <textarea
                        value={draft.explanation}
                        onChange={(e) => updateDraftField(draft.id, 'explanation', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
                        placeholder="स्पष्टीकरण येथे लिहा (उदा. कारण...)"
                      />
                    </div>

                    {/* Math Figure / Image Attach */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-900 gap-3">
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
                          className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 disabled:opacity-50"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>{draft.uploading ? 'अपलोड होत आहे...' : 'चित्र जोडा'}</span>
                        </button>
                        
                        {draft.image_url ? (
                          <div className="flex items-center space-x-1.5 text-xs text-indigo-400 bg-indigo-500/5 px-2 py-1 rounded-md border border-indigo-500/10">
                            <Eye className="w-3.5 h-3.5" />
                            <a href={draft.image_url} target="_blank" rel="noreferrer" className="underline truncate max-w-[120px] sm:max-w-[200px]">
                              चित्र पहा
                            </a>
                            <button
                              onClick={() => updateDraftField(draft.id, 'image_url', undefined)}
                              className="text-red-400 hover:text-red-300 ml-1 font-bold"
                              title="Remove image"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">कोणतेही चित्र जोडलेले नाही (ऐच्छिक)</span>
                        )}
                      </div>
                    </div>

                  </div>
                ))}

                {/* DB Publisher action bar */}
                <div className="p-4 bg-slate-900/60 border border-slate-900 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 backdrop-blur-md shadow-2xl">
                  <div className="text-center sm:text-left">
                    <h3 className="font-bold text-slate-200">डेटाबेस प्रकाशन</h3>
                    <p className="text-xs text-slate-400 mt-0.5">सर्व मसुदा प्रश्नांचे पुनरावलोकन केल्यानंतर डेटाबेसमध्ये जतन करा.</p>
                  </div>
                  
                  <button
                    onClick={handleSaveToDatabase}
                    disabled={isGenerating}
                    className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/10 transition-all flex items-center justify-center space-x-2"
                  >
                    {isGenerating ? (
                      <>
                        <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                        <span>जतन होत आहे...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>सर्व प्रश्न जतन करा</span>
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
