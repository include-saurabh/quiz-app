'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useQuizStore, Question } from '@/store/useQuizStore';
import { 
  BookOpen, Award, BarChart2, BrainCircuit, Play, 
  HelpCircle, AlertCircle, X, Layers, Settings, Sparkles 
} from 'lucide-react';

export default function Dashboard() {
  const router = useRouter();
  const initUserId = useQuizStore((state) => state.initUserId);
  const startQuiz = useQuizStore((state) => state.startQuiz);
  const user_id = useQuizStore((state) => state.user_id);

  // Dashboard Stats
  const [stats, setStats] = useState<{
    totalTests: number;
    averageScore: number;
    insights: string | null;
    topics: string[];
  }>({
    totalTests: 0,
    averageScore: 0,
    insights: null,
    topics: [],
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [showNotice, setShowNotice] = useState<boolean>(true);

  // Test configuration state
  const [testMode, setTestMode] = useState<'topic-wise' | 'mixed'>('topic-wise');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [selectedMixedTopics, setSelectedMixedTopics] = useState<string[]>([]);
  const [launchingTest, setLaunchingTest] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // 1. Initialize user ID and fetch stats
  useEffect(() => {
    const id = initUserId();
    
    // Check notice state
    const noticeDismissed = localStorage.getItem('device_notice_dismissed');
    if (noticeDismissed === 'true') {
      setShowNotice(false);
    }

    const fetchStats = async () => {
      try {
        const res = await fetch(`/api/user-stats?user_id=${id}`);
        if (!res.ok) throw new Error('Failed to fetch statistics');
        const data = await res.json();
        setStats(data);
        
        // Auto-select first topic
        if (data.topics && data.topics.length > 0) {
          setSelectedTopic(data.topics[0]);
        }
      } catch (err) {
        console.error('Error loading stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [initUserId]);

  const dismissNotice = () => {
    localStorage.setItem('device_notice_dismissed', 'true');
    setShowNotice(false);
  };

  // Handle Mixed Topic Selection Toggle
  const toggleMixedTopic = (topicName: string) => {
    setSelectedMixedTopics(prev => 
      prev.includes(topicName)
        ? prev.filter(t => t !== topicName)
        : [...prev, topicName]
    );
  };

  // Launch test
  const handleStartTest = async () => {
    setErrorMsg('');
    
    // Validate selection
    const topicsToFetch = testMode === 'topic-wise' 
      ? [selectedTopic] 
      : selectedMixedTopics;

    if (topicsToFetch.length === 0 || !topicsToFetch[0]) {
      setErrorMsg('कृपया कमीत कमी एक विषय तरी निवडा.');
      return;
    }

    setLaunchingTest(true);

    try {
      // 1. Fetch questions for the selected topics
      let query = supabase.from('questions').select('*').in('topic', topicsToFetch);
      
      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        setErrorMsg('निवडलेल्या विषयांमध्ये सध्या कोणतेही प्रश्न उपलब्ध नाहीत. कृपया दुसरा विषय निवडा.');
        setLaunchingTest(false);
        return;
      }

      // Format questions
      let finalQuestions: Question[] = data.map(q => ({
        id: q.id,
        topic: q.topic,
        question_text: q.question_text,
        options: Array.isArray(q.options) ? q.options : [],
        correct_option: q.correct_option,
        explanation: q.explanation,
        image_url: q.image_url,
      }));

      // Shuffle helper
      const shuffle = (array: any[]) => {
        let currentIndex = array.length, randomIndex;
        while (currentIndex !== 0) {
          randomIndex = Math.floor(Math.random() * currentIndex);
          currentIndex--;
          [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }
        return array;
      };

      // Sample and Shuffle
      if (testMode === 'topic-wise') {
        const maxTopicQs = Number(process.env.NEXT_PUBLIC_MAX_TOPIC_QUESTIONS) || 30;
        finalQuestions = shuffle(finalQuestions).slice(0, maxTopicQs);
      } else {
        const maxMixedQs = Number(process.env.NEXT_PUBLIC_MAX_MIXED_QUESTIONS) || 40;
        finalQuestions = shuffle(finalQuestions).slice(0, maxMixedQs);
      }

      // 2. Initialize the Zustand quiz engine state
      // Default: 60s per question
      startQuiz(testMode, topicsToFetch, finalQuestions, 60);

      // 3. Redirect to quiz engine screen
      router.push('/quiz');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`चाचणी सुरू करताना त्रुटी आली: ${err.message || 'Error'}`);
      setLaunchingTest(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-mukta text-slate-100 bg-slate-950 pb-12">
      
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-900 px-4 py-4 sm:px-6">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2.5">
            <span className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
              <BrainCircuit className="w-6 h-6" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">मराठी AI क्विझ</h1>
          </div>
          
          <a 
            href="/admin"
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-slate-200 rounded-xl border border-slate-850 text-xs font-semibold transition-all flex items-center space-x-1"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>अॅडमीन</span>
          </a>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-4xl mx-auto px-4 mt-6 space-y-6 flex-1 w-full">
        
        {/* LocalStorage Notice */}
        {showNotice && (
          <div className="p-4 bg-indigo-950/40 border border-indigo-900/50 rounded-2xl flex items-start space-x-3 text-indigo-200 relative animate-fade-in shadow-lg">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-indigo-400 mt-0.5" />
            <div className="flex-1 pr-6 text-sm">
              <span className="font-semibold text-white">माहिती:</span> आपली प्रगती या डिव्हाइसवर जतन केली आहे. ब्राउझर डेटा साफ केल्याने आपला इतिहास रीसेट होईल.
            </div>
            <button 
              onClick={dismissNotice}
              className="absolute top-3 right-3 text-indigo-400 hover:text-indigo-200 transition-colors"
              aria-label="Dismiss notice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Stats Section */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
            <div className="h-28 bg-slate-900/40 border border-slate-900 rounded-2xl"></div>
            <div className="h-28 bg-slate-900/40 border border-slate-900 rounded-2xl"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Total Tests Taken */}
            <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl flex items-center space-x-4 shadow-xl backdrop-blur-md">
              <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <p className="text-slate-400 text-xs sm:text-sm font-semibold uppercase tracking-wider">एकूण घेतलेल्या चाचण्या</p>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white mt-0.5">{stats.totalTests}</h3>
              </div>
            </div>

            {/* Average Score */}
            <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl flex items-center space-x-4 shadow-xl backdrop-blur-md">
              <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <p className="text-slate-400 text-xs sm:text-sm font-semibold uppercase tracking-wider">सरासरी टक्केवारी (Score)</p>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white mt-0.5">{stats.averageScore}%</h3>
              </div>
            </div>

          </div>
        )}

        {/* AI Analysis section */}
        <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl shadow-xl backdrop-blur-md space-y-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-slate-100">AI विश्लेषण: कमकुवत विषय (Weak Topics)</h2>
          </div>
          
          {loading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-4 bg-slate-800 rounded w-3/4"></div>
              <div className="h-4 bg-slate-800 rounded w-5/6"></div>
            </div>
          ) : (
            <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-900 text-slate-300 text-sm leading-relaxed">
              {stats.insights ? (
                stats.insights
              ) : (
                <span className="text-slate-500 italic">
                  अधिक चाचण्या घ्या, म्हणजे आपल्या कमकुवत विषयांचे विश्लेषण दिसेल.
                </span>
              )}
            </div>
          )}
        </div>

        {/* Error boundary inside UI */}
        {errorMsg && (
          <div className="p-4 bg-red-950/40 border border-red-900/50 rounded-2xl flex items-start space-x-3 text-red-200">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400 mt-0.5" />
            <span className="text-sm">{errorMsg}</span>
          </div>
        )}

        {/* Test Configuration & Action panel */}
        <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl shadow-xl backdrop-blur-md space-y-6">
          <div className="flex items-center space-x-2 pb-4 border-b border-slate-800">
            <Layers className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold">चाचणी प्रकार निवडा / Setup Test</h2>
          </div>

          {/* Test mode toggle tabs */}
          <div className="grid grid-cols-2 p-1.5 bg-slate-950 rounded-xl border border-slate-900">
            <button
              onClick={() => {
                setTestMode('topic-wise');
                setErrorMsg('');
              }}
              className={`py-2 text-sm font-semibold rounded-lg transition-all ${
                testMode === 'topic-wise' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              विषयनिहाय चाचणी (Topic-Wise)
            </button>
            <button
              onClick={() => {
                setTestMode('mixed');
                setErrorMsg('');
              }}
              className={`py-2 text-sm font-semibold rounded-lg transition-all ${
                testMode === 'mixed' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              मिश्रित चाचणी (Mixed Test)
            </button>
          </div>

          {/* Topic Selectors */}
          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-10 bg-slate-800 rounded"></div>
            </div>
          ) : stats.topics.length === 0 ? (
            <div className="text-center py-6 bg-slate-950/60 rounded-xl border border-slate-900">
              <HelpCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">डेटाबेसमध्ये सध्या कोणतेही प्रश्न उपलब्ध नाहीत.</p>
              <p className="text-slate-600 text-xs mt-1">अॅडमीन पॅनेलमध्ये जाऊन प्रथम प्रश्न तयार करा.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {testMode === 'topic-wise' ? (
                /* Topic-Wise selection dropdown */
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-350">खालीलपैकी एक विषय निवडा:</label>
                  <select
                    value={selectedTopic}
                    onChange={(e) => setSelectedTopic(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
                  >
                    {stats.topics.map((t, idx) => (
                      <option key={idx} value={t}>{t}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 italic mt-1 font-sans">
                    * महत्तम प्रश्न मर्यादा: {process.env.NEXT_PUBLIC_MAX_TOPIC_QUESTIONS || 30} प्रश्न.
                  </p>
                </div>
              ) : (
                /* Mixed selection checkboxes */
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-350">सामील करायचे विषय निवडा (बहुनिवड):</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-950/45 p-4 rounded-xl border border-slate-900 max-h-48 overflow-y-auto">
                    {stats.topics.map((t, idx) => {
                      const isChecked = selectedMixedTopics.includes(t);
                      return (
                        <button
                          key={idx}
                          onClick={() => toggleMixedTopic(t)}
                          className={`flex items-center space-x-3 px-3 py-2 border rounded-lg transition-all text-left text-sm ${
                            isChecked 
                              ? 'border-indigo-650 bg-indigo-550/10 text-white' 
                              : 'border-slate-850 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] ${
                            isChecked 
                              ? 'bg-indigo-600 border-indigo-500 text-white' 
                              : 'border-slate-700'
                          }`}>
                            {isChecked && '✓'}
                          </span>
                          <span className="truncate">{t}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-500 italic mt-1 font-sans">
                    * महत्तम प्रश्न मर्यादा: {process.env.NEXT_PUBLIC_MAX_MIXED_QUESTIONS || 40} प्रश्न (यादृच्छिकपणे निवडले जातील).
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Launch test button */}
          <button
            onClick={handleStartTest}
            disabled={launchingTest || stats.topics.length === 0}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center space-x-2 text-base hover:scale-[1.01]"
          >
            {launchingTest ? (
              <>
                <span className="animate-spin inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                <span>चाचणी लोड होत आहे...</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                <span>चाचणी सुरू करा</span>
              </>
            )}
          </button>
        </div>

      </main>
    </div>
  );
}
