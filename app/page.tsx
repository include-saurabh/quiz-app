'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useQuizStore, Question } from '@/store/useQuizStore';
import { 
  BookOpen, Award, BrainCircuit, Play, 
  HelpCircle, AlertCircle, X, Layers, Settings, Sparkles, TrendingUp, BarChart,
  Calendar
} from 'lucide-react';

interface ScoreHistoryItem {
  testIndex: number;
  date: string;
  percentage: number;
}

interface SubjectProgressItem {
  subject: string;
  percentage: number;
  total: number;
}

interface SubjectNode {
  subject: string;
  topics: string[];
}

interface PastTestItem {
  id: string;
  score: number;
  total_questions: number;
  test_type: 'topic-wise' | 'mixed';
  topics: string[];
  created_at: string;
}

interface RevisionTopicItem {
  topic: string;
  subject: string;
  percentage: number;
  total: number;
  incorrect: number;
}

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
    subjects: SubjectNode[];
    scoreHistory: ScoreHistoryItem[];
    subjectProgress: SubjectProgressItem[];
    solvedQuestionIds: string[];
    pastTests: PastTestItem[];
    needsRevision: RevisionTopicItem[];
  }>({
    totalTests: 0,
    averageScore: 0,
    insights: null,
    subjects: [],
    scoreHistory: [],
    subjectProgress: [],
    solvedQuestionIds: [],
    pastTests: [],
    needsRevision: [],
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [showNotice, setShowNotice] = useState<boolean>(true);

  // Test configuration state
  const [testMode, setTestMode] = useState<'topic-wise' | 'mixed'>('topic-wise');
  
  // Selection States
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [selectedMixedTopics, setSelectedMixedTopics] = useState<string[]>([]);
  
  const [launchingTest, setLaunchingTest] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [deletingTestId, setDeletingTestId] = useState<string | null>(null);

  const handleDeleteTest = async (testId: string) => {
    if (!window.confirm('तुम्हाला खरोखर हा निकाल हटवायचा आहे का?')) return;
    
    setDeletingTestId(testId);
    setErrorMsg('');
    try {
      const res = await fetch('/api/delete-test-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user_id, testId }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete test');
      }
      
      // Refresh stats
      const statsRes = await fetch(`/api/user-stats?user_id=${user_id}`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err: any) {
      console.error('Error deleting test:', err);
      setErrorMsg(`निकाल हटवताना त्रुटी आली: ${err.message || 'Error'}`);
    } finally {
      setDeletingTestId(null);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const d = new Date(dateString);
      return d.toLocaleString('mr-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return dateString;
    }
  };

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
        
        // Auto-select first subject and its first topic
        if (data.subjects && data.subjects.length > 0) {
          setSelectedSubject(data.subjects[0].subject);
          if (data.subjects[0].topics && data.subjects[0].topics.length > 0) {
            setSelectedTopic(data.subjects[0].topics[0]);
          }
        }
      } catch (err) {
        console.error('Error loading stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [initUserId]);

  // Update selected topic when subject changes in Topic-wise mode
  useEffect(() => {
    if (selectedSubject && stats.subjects.length > 0) {
      const subNode = stats.subjects.find(s => s.subject === selectedSubject);
      if (subNode && subNode.topics && subNode.topics.length > 0) {
        setSelectedTopic(subNode.topics[0]);
      } else {
        setSelectedTopic('');
      }
    }
  }, [selectedSubject, stats.subjects]);

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
      setErrorMsg('कृपया कमीत कमी एक घटक तरी निवडा.');
      return;
    }

    setLaunchingTest(true);

    try {
      // 1. Fetch questions for the selected topics
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .in('topic', topicsToFetch);
      
      if (error) throw error;

      if (!data || data.length === 0) {
        setErrorMsg('निवडलेल्या घटकांमध्ये सध्या कोणतेही प्रश्न उपलब्ध नाहीत. कृपया दुसरा घटक निवडा.');
        setLaunchingTest(false);
        return;
      }

      // Format questions
      const formattedQuestions: Question[] = data.map(q => ({
        id: q.id,
        subject: q.subject || 'सामान्य',
        topic: q.topic,
        question_text: q.question_text,
        options: Array.isArray(q.options) ? q.options : [],
        correct_option: q.correct_option,
        explanation: q.explanation,
        image_url: q.image_url,
      }));

      // Filter out correctly solved questions (on latest attempt)
      const solvedIds = stats.solvedQuestionIds || [];
      let filteredQuestions = formattedQuestions.filter(q => !solvedIds.includes(q.id));

      // Fallback if all questions are solved, use all formatted questions
      if (filteredQuestions.length === 0) {
        filteredQuestions = formattedQuestions;
      }

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

      let finalQuestions: Question[] = [];
      // Sample and Shuffle (capped at 20 questions maximum)
      if (testMode === 'topic-wise') {
        const maxTopicQs = 20;
        finalQuestions = shuffle(filteredQuestions).slice(0, maxTopicQs);
      } else {
        const maxMixedQs = 20;
        finalQuestions = shuffle(filteredQuestions).slice(0, maxMixedQs);
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

  // Helper: Draw pure SVG Line Chart for user scores over time
  const renderLineChart = () => {
    const data = stats.scoreHistory;
    if (!data || data.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-48 bg-slate-50 border border-slate-200 rounded-xl border-dashed">
          <TrendingUp className="w-8 h-8 text-slate-400 mb-1" />
          <p className="text-xs text-slate-500 font-semibold">अजून कोणतीही चाचणी घेतलेली नाही.</p>
        </div>
      );
    }

    const width = 500;
    const height = 180;
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Calculate Coordinates
    const points = data.map((d, index) => {
      const x = padding.left + (data.length === 1 ? chartWidth / 2 : (index / (data.length - 1)) * chartWidth);
      const y = padding.top + chartHeight - (d.percentage / 100) * chartHeight;
      return { x, y, value: d.percentage, label: d.date };
    });

    // Create Path SVG string
    let pathD = '';
    if (points.length > 0) {
      pathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
    }

    // Gridlines at 0%, 50%, 100%
    const gridY = [0, 50, 100].map(val => ({
      y: padding.top + chartHeight - (val / 100) * chartHeight,
      label: `${val}%`
    }));

    return (
      <div className="w-full overflow-x-auto bg-white p-4 border border-slate-100 rounded-2xl shadow-sm">
        <div className="flex items-center space-x-1.5 mb-3 text-indigo-650">
          <TrendingUp className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">गुण प्रगती आलेख (Progress History)</span>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[380px] h-40 overflow-visible font-sans">
          {/* Grid lines */}
          {gridY.map((g, idx) => (
            <g key={idx}>
              <line 
                x1={padding.left} 
                y1={g.y} 
                x2={width - padding.right} 
                y2={g.y} 
                className="stroke-slate-100" 
                strokeWidth="1"
                strokeDasharray="4"
              />
              <text 
                x={padding.left - 10} 
                y={g.y + 4} 
                textAnchor="end" 
                className="text-[10px] fill-slate-400 font-semibold"
              >
                {g.label}
              </text>
            </g>
          ))}

          {/* Line Path */}
          {points.length > 1 && (
            <path
              d={pathD}
              fill="none"
              className="stroke-indigo-600"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Dots on points */}
          {points.map((p, idx) => (
            <g key={idx} className="group cursor-pointer">
              <circle
                cx={p.x}
                cy={p.y}
                r="4.5"
                className="fill-indigo-600 stroke-white"
                strokeWidth="2"
              />
              <text
                x={p.x}
                y={p.y - 10}
                textAnchor="middle"
                className="text-[9px] font-bold fill-indigo-750 bg-white"
              >
                {p.value}%
              </text>
              <text
                x={p.x}
                y={height - 10}
                textAnchor="middle"
                className="text-[9px] fill-slate-405 font-medium"
              >
                {p.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col font-mukta text-slate-900 bg-slate-50 pb-12">
      
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-4 sm:px-6 shadow-sm">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2.5">
            <span className="p-2 bg-indigo-50 rounded-xl text-indigo-650 border border-indigo-100">
              <BrainCircuit className="w-6 h-6" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-800">MAHATET</h1>
          </div>
          
          <a 
            href="/admin"
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-655 rounded-xl border border-slate-200 text-xs font-semibold transition-all flex items-center space-x-1"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Admin</span>
          </a>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-4xl mx-auto px-4 mt-6 space-y-6 flex-1 w-full">
        
        {/* LocalStorage Notice */}
        {showNotice && (
          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-start space-x-3 text-indigo-800 relative animate-fade-in shadow-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-indigo-500 mt-0.5" />
            <div className="flex-1 pr-6 text-sm">
              <span className="font-semibold">माहिती:</span> आपली प्रगती या डिव्हाइसवर जतन केली आहे. ब्राउझर डेटा साफ केल्याने आपला इतिहास रीसेट होईल.
            </div>
            <button 
              onClick={dismissNotice}
              className="absolute top-3 right-3 text-indigo-400 hover:text-indigo-600 transition-colors"
              aria-label="Dismiss notice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Stats Row */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-pulse">
            <div className="h-24 bg-white border border-slate-200 rounded-2xl"></div>
            <div className="h-24 bg-white border border-slate-200 rounded-2xl"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 bg-white border border-slate-100 rounded-2xl flex items-center space-x-4 shadow-sm">
              <div className="p-3 bg-indigo-50 rounded-xl text-indigo-650 border border-indigo-100">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">एकूण दिलेल्या चाचण्या</p>
                <h3 className="text-2xl font-extrabold text-slate-800 mt-0.5">{stats.totalTests}</h3>
              </div>
            </div>

            <div className="p-5 bg-white border border-slate-100 rounded-2xl flex items-center space-x-4 shadow-sm">
              <div className="p-3 bg-emerald-50 rounded-xl text-emerald-655 border border-emerald-100">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">सरासरी टक्केवारी (Score)</p>
                <h3 className="text-2xl font-extrabold text-slate-800 mt-0.5">{stats.averageScore}%</h3>
              </div>
            </div>
          </div>
        )}

        {/* Charts & Analytics Panel */}
        {!loading && stats.totalTests > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Score progress Line chart */}
            {renderLineChart()}

            {/* Subject wise accuracy chart */}
            <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center space-x-1.5 text-indigo-650">
                <BarChart className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">विषयनिहाय अचूकता (Subject Accuracy)</span>
              </div>
              
              <div className="space-y-3.5 max-h-40 overflow-y-auto pr-1">
                {stats.subjectProgress.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-700 truncate max-w-[200px]">{item.subject}</span>
                      <span className="text-indigo-650 font-sans">{item.percentage}% ({item.total} प्रश्न)</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                      <div 
                        className="h-full bg-indigo-600 rounded-full transition-all"
                        style={{ width: `${item.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* AI Weak topics analysis section */}
        <div className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-800">AI विश्लेषण: कमकुवत विषय (Weak Topics)</h2>
          </div>
          
          {loading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-3/4"></div>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 text-sm leading-relaxed">
              {stats.insights ? (
                stats.insights
              ) : (
                <span className="text-slate-400 italic">
                  अधिक चाचण्या घ्या, म्हणजे आपल्या कमकुवत विषयांचे विश्लेषण दिसेल.
                </span>
              )}
            </div>
          )}
        </div>

        {/* Topics Needing Revision Section */}
        {!loading && stats.needsRevision && stats.needsRevision.length > 0 && (
          <div className="p-6 bg-white border border-rose-100 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
              <AlertCircle className="w-5 h-5 text-rose-500 animate-pulse" />
              <h2 className="text-lg font-bold text-slate-800">पुनरावलोकन आवश्यक असलेले घटक (Revision Needed)</h2>
            </div>
            <p className="text-xs text-slate-550 leading-relaxed">खालील घटकांमध्ये तुमची अचूकता ७०% पेक्षा कमी आहे. चांगल्या गुणांसाठी या घटकांचा अधिक सराव करा:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {stats.needsRevision.slice(0, 6).map((item, idx) => (
                <div key={idx} className="p-4 bg-rose-50/30 hover:bg-rose-50/60 border border-rose-100/60 rounded-xl transition-all flex justify-between items-center group">
                  <div className="space-y-1 pr-2 min-w-0">
                    <span className="text-[10px] font-semibold text-rose-550 block truncate">{item.subject}</span>
                    <span className="text-sm font-bold text-slate-800 block truncate group-hover:text-rose-900">{item.topic}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-rose-600 block font-sans">{item.percentage}% अचूकता</span>
                    <span className="text-[10px] text-slate-400 block font-sans">{item.incorrect} चुकीचे प्रश्न</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error notification boundary */}
        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start space-x-3 text-red-800">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" />
            <span className="text-sm">{errorMsg}</span>
          </div>
        )}

        {/* Test Configuration panel */}
        <div className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-6">
          <div className="flex items-center space-x-2 pb-4 border-b border-slate-100">
            <Layers className="w-5 h-5 text-indigo-650" />
            <h2 className="text-lg font-bold">चाचणी प्रकार निवडा / Setup Test</h2>
          </div>

          {/* Test mode toggle tabs */}
          <div className="grid grid-cols-2 p-1.5 bg-slate-100 rounded-xl border border-slate-200">
            <button
              onClick={() => {
                setTestMode('topic-wise');
                setErrorMsg('');
              }}
              className={`py-2 text-sm font-semibold rounded-lg transition-all ${
                testMode === 'topic-wise' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
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
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              मिश्रित चाचणी (Mixed Test)
            </button>
          </div>

          {/* Topic Selectors */}
          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-10 bg-slate-100 rounded"></div>
            </div>
          ) : stats.subjects.length === 0 ? (
            <div className="text-center py-6 bg-slate-50 rounded-xl border border-slate-200">
              <HelpCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">डेटाबेसमध्ये सध्या कोणतेही प्रश्न उपलब्ध नाहीत.</p>
              <p className="text-slate-450 text-xs mt-1">Admin पॅनेलमध्ये जाऊन .json फाईल अपलोड करा.</p>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* TOPIC-WISE MODE SELECTORS */}
              {testMode === 'topic-wise' ? (
                <div className="space-y-4">
                  {/* Subject Dropdown */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-600">विषय (Subject) निवडा:</label>
                    <select
                      value={selectedSubject}
                      onChange={(e) => setSelectedSubject(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-250 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
                    >
                      {stats.subjects.map((sub, idx) => (
                        <option key={idx} value={sub.subject}>{sub.subject}</option>
                      ))}
                    </select>
                  </div>

                  {/* Topic Dropdown (filtered by selected subject) */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-600">घटक / धडा (Topic) निवडा:</label>
                    <select
                      value={selectedTopic}
                      onChange={(e) => setSelectedTopic(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-250 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
                      disabled={!selectedSubject}
                    >
                      {stats.subjects
                        .find(s => s.subject === selectedSubject)
                        ?.topics.map((t, idx) => (
                          <option key={idx} value={t}>{t}</option>
                        ))
                      }
                    </select>
                    <p className="text-xs text-slate-400 italic mt-1">
                      * महत्तम प्रश्न मर्यादा: २० प्रश्न.
                    </p>
                  </div>
                </div>
              ) : (
                /* MIXED TEST MODE SELECTORS */
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-650">चाचणीमध्ये समाविष्ट करायचे घटक निवडा:</label>
                  
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                    {stats.subjects.map((sub, subIdx) => (
                      <div key={subIdx} className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <span className="text-xs font-bold text-indigo-750 uppercase tracking-wide border-b border-indigo-100 pb-1 block">
                          {sub.subject}
                        </span>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                          {sub.topics.map((t, topIdx) => {
                            const isChecked = selectedMixedTopics.includes(t);
                            return (
                              <button
                                key={topIdx}
                                onClick={() => toggleMixedTopic(t)}
                                className={`flex items-center space-x-3 px-3 py-2 border rounded-lg transition-all text-left text-sm ${
                                  isChecked 
                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-900 font-semibold' 
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-350 hover:text-slate-855'
                                }`}
                              >
                                <span className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] ${
                                  isChecked 
                                    ? 'bg-indigo-650 border-indigo-550 text-white' 
                                    : 'border-slate-300'
                                }`}>
                                  {isChecked && '✓'}
                                </span>
                                <span className="truncate">{t}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 italic mt-1 font-sans">
                    * महत्तम प्रश्न मर्यादा: २० प्रश्न (यादृच्छिकपणे निवडले जातील).
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Launch test button */}
          <button
            onClick={handleStartTest}
            disabled={launchingTest || stats.subjects.length === 0}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-550 hover:to-indigo-650 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 text-base hover:scale-[1.005]"
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

        {/* Past Tests History */}
        {!loading && stats.pastTests && stats.pastTests.length > 0 && (
          <div className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
              <Award className="w-5 h-5 text-indigo-650" />
              <h2 className="text-lg font-bold text-slate-800">मागील चाचण्यांचा इतिहास / Past Tests ({stats.pastTests.length})</h2>
            </div>
            
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {stats.pastTests.map((test) => {
                const percentage = test.total_questions > 0 ? Math.round((test.score / test.total_questions) * 100) : 0;
                const isSuccess = percentage >= 40;
                
                return (
                  <div 
                    key={test.id} 
                    onClick={() => router.push(`/results?test_id=${test.id}`)}
                    className="p-4 bg-slate-50 hover:bg-indigo-50/20 hover:border-indigo-250 border border-slate-200 rounded-xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group cursor-pointer"
                    title="चाचणी पुनरावलोकन व स्पष्टीकरण पहा"
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
                        <span className="text-[10px] text-slate-400 flex items-center font-sans">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(test.created_at)}
                        </span>
                      </div>
                      
                      <div className="text-sm font-bold text-slate-800 truncate">
                        {test.topics && test.topics.length > 0 ? test.topics.join(', ') : 'सामान्य'}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
                      {/* Score Badge */}
                      <div className="flex items-center space-x-2">
                        <div className="text-right">
                          <div className="text-xs text-slate-400 font-medium">गुण (Score)</div>
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
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
