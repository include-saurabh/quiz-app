'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuizStore, Question } from '@/store/useQuizStore';
import { supabase } from '@/lib/supabase';
import { 
  Award, CheckCircle, XCircle, AlertCircle, Home, 
  RefreshCw, ChevronRight, HelpCircle, Eye, ArrowRight 
} from 'lucide-react';

export default function ResultsPage() {
  const router = useRouter();
  
  // Zustand Store
  const user_id = useQuizStore((state) => state.user_id);
  const questions = useQuizStore((state) => state.questions);
  const answers = useQuizStore((state) => state.answers);
  const testType = useQuizStore((state) => state.testType);
  const selectedTopics = useQuizStore((state) => state.selectedTopics);
  const resetQuiz = useQuizStore((state) => state.resetQuiz);

  const [isClient, setIsClient] = useState(false);
  const [submitting, setSubmitting] = useState(true);
  const [dbError, setDbError] = useState<string>('');
  const [stats, setStats] = useState({
    correct: 0,
    incorrect: 0,
    unanswered: 0,
    percentage: 0,
  });

  const hasSubmitted = useRef(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Calculate results and save to Database on mount
  useEffect(() => {
    if (!isClient || questions.length === 0 || hasSubmitted.current) return;
    hasSubmitted.current = true;

    // 1. Calculate scores
    let correct = 0;
    let incorrect = 0;
    let unanswered = 0;

    const questionResults = questions.map((q) => {
      const selected = answers[q.id];
      const isCorrect = selected !== undefined && selected !== null && selected === q.correct_option;
      
      if (selected === undefined || selected === null) {
        unanswered++;
      } else if (isCorrect) {
        correct++;
      } else {
        incorrect++;
      }

      return {
        question_id: q.id,
        topic: q.topic,
        selected_option: selected !== undefined ? selected : null,
        correct_option: q.correct_option,
        is_correct: isCorrect,
      };
    });

    const percentage = Math.round((correct / questions.length) * 100);
    setStats({ correct, incorrect, unanswered, percentage });

    // 2. Insert into Supabase test_history
    const saveResults = async () => {
      try {
        const { error } = await supabase.from('test_history').insert({
          user_id: user_id || crypto.randomUUID(), // Fallback if user_id is empty
          test_type: testType || 'topic-wise',
          topics: selectedTopics,
          score: correct,
          total_questions: questions.length,
          question_results: questionResults,
        });

        if (error) throw error;

        // 3. Asynchronously trigger AI weak topics regeneration
        fetch('/api/insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user_id }),
        }).catch(err => console.error('Failed to trigger async insights:', err));

      } catch (err: any) {
        console.error('Error inserting test history:', err);
        setDbError('निकाल डेटाबेसमध्ये जतन करताना अडचण आली.');
      } finally {
        setSubmitting(false);
      }
    };

    saveResults();
  }, [isClient, questions, answers, user_id, testType, selectedTopics]);

  const handleGoHome = () => {
    resetQuiz();
    router.push('/');
  };

  const handleRetry = () => {
    // Retry goes back to dashboard for fresh config
    resetQuiz();
    router.push('/');
  };

  if (!isClient || questions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white font-mukta">
        <div className="animate-spin text-indigo-500 mb-4">
          <RefreshCw className="w-10 h-10" />
        </div>
        <p className="text-slate-400 text-sm">निकाल लोड होत आहेत...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-mukta text-slate-100 bg-slate-950 pb-16 px-4">
      
      {/* Top Header */}
      <header className="w-full max-w-2xl mx-auto py-6 border-b border-slate-900 flex justify-between items-center bg-slate-950 sticky top-0 z-30">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center space-x-2">
          <Award className="w-5 h-5 text-indigo-400" />
          <span>चाचणीचा निकाल / Results</span>
        </h1>
        <button
          onClick={handleGoHome}
          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-850 text-xs font-semibold rounded-xl transition-all flex items-center space-x-1"
        >
          <Home className="w-3.5 h-3.5" />
          <span>डॅशबोर्ड</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-2xl mx-auto mt-6 flex-1 space-y-6">
        
        {/* Error notification if DB save fails */}
        {dbError && (
          <div className="p-4 bg-red-950/40 border border-red-900/50 rounded-2xl flex items-start space-x-3 text-red-200">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400 mt-0.5" />
            <span className="text-sm">{dbError}</span>
          </div>
        )}

        {/* Circular / Large Score display */}
        <div className="p-8 bg-slate-900/40 border border-slate-900 rounded-2xl shadow-xl backdrop-blur-md text-center space-y-4">
          <div className="w-28 h-28 mx-auto rounded-full bg-gradient-to-tr from-indigo-650 to-indigo-500 p-1 flex items-center justify-center shadow-lg shadow-indigo-650/20">
            <div className="w-full h-full bg-slate-950 rounded-full flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold text-white font-sans">{stats.percentage}%</span>
              <span className="text-[10px] text-indigo-400 uppercase tracking-widest font-semibold mt-0.5">टक्केवारी</span>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold">
              {stats.percentage >= 75 ? 'उत्कृष्ट कामगिरी! 🎉' : stats.percentage >= 40 ? 'चांगला प्रयत्न! 👍' : 'अजून सरावाची गरज आहे. 🎯'}
            </h2>
            <p className="text-slate-400 text-xs mt-1 sm:text-sm">आपला एकूण गुण आणि विश्लेषण खालीलप्रमाणे आहे.</p>
          </div>

          {/* Detailed stats grids */}
          <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto pt-2">
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-900">
              <div className="text-emerald-450 font-sans font-bold text-lg">{stats.correct}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">बरोबर (Correct)</div>
            </div>
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-900">
              <div className="text-red-450 font-sans font-bold text-lg">{stats.incorrect}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">चूक (Wrong)</div>
            </div>
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-900">
              <div className="text-yellow-555 font-sans font-bold text-lg">{stats.unanswered}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">अनुत्तरित (Missed)</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleRetry}
            className="flex-1 py-3.5 bg-indigo-650 hover:bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-650/20 transition-all flex items-center justify-center space-x-2 text-sm sm:text-base hover:scale-[1.005]"
          >
            <RefreshCw className="w-4 h-4" />
            <span>पुन्हा प्रयत्न करा / Try Again</span>
          </button>
          <button
            onClick={handleGoHome}
            className="flex-1 py-3.5 bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-850 font-bold rounded-xl transition-all flex items-center justify-center space-x-2 text-sm sm:text-base hover:scale-[1.005]"
          >
            <span>डॅशबोर्डवर जा</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Section: Question Review */}
        <div className="space-y-4 pt-4">
          <h3 className="text-lg font-bold text-slate-200">प्रश्नोत्तर पुनरावलोकन / Review Questions ({questions.length})</h3>
          
          <div className="space-y-4">
            {questions.map((q, idx) => {
              const selected = answers[q.id];
              const isCorrect = selected !== undefined && selected !== null && selected === q.correct_option;
              
              return (
                <div 
                  key={q.id}
                  className={`p-5 bg-slate-900/25 border rounded-2xl shadow-md space-y-4 backdrop-blur-md relative ${
                    selected === undefined || selected === null 
                      ? 'border-yellow-900/30' 
                      : isCorrect 
                        ? 'border-emerald-950/50' 
                        : 'border-red-950/50'
                  }`}
                >
                  {/* Top Badge */}
                  <div className="flex justify-between items-center pb-2.5 border-b border-slate-900">
                    <span className="text-xs font-semibold px-2 py-0.5 bg-slate-950/70 border border-slate-850 text-indigo-400 rounded-md">
                      {q.topic}
                    </span>
                    <div className="flex items-center space-x-1.5">
                      {selected === undefined || selected === null ? (
                        <span className="text-xs text-yellow-500 font-semibold flex items-center space-x-1 bg-yellow-500/5 px-2 py-0.5 rounded-md border border-yellow-500/10">
                          <span>अनुत्तरित</span>
                        </span>
                      ) : isCorrect ? (
                        <span className="text-xs text-emerald-400 font-semibold flex items-center space-x-1 bg-emerald-500/5 px-2 py-0.5 rounded-md border border-emerald-500/10">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>बरोबर</span>
                        </span>
                      ) : (
                        <span className="text-xs text-red-400 font-semibold flex items-center space-x-1 bg-red-500/5 px-2 py-0.5 rounded-md border border-red-500/10">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>चूक</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Question Text */}
                  <h4 className="text-sm sm:text-base font-bold leading-relaxed">
                    <span className="font-sans mr-1">{idx + 1}.</span> {q.question_text}
                  </h4>

                  {/* Attached Math image review */}
                  {q.image_url && (
                    <div className="w-fit max-w-full overflow-hidden rounded-lg border border-slate-850 bg-slate-950 p-2 flex justify-start">
                      <img
                        src={q.image_url}
                        alt="Math figure review"
                        className="max-h-36 object-contain rounded"
                      />
                    </div>
                  )}

                  {/* Chosen Option & Correct Option display */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-900 flex flex-col justify-center">
                      <span className="text-slate-500 font-medium">आपला पर्याय:</span>
                      <span className={`font-semibold mt-0.5 ${
                        selected === undefined || selected === null 
                          ? 'text-yellow-555 italic' 
                          : isCorrect 
                            ? 'text-emerald-400' 
                            : 'text-red-400'
                      }`}>
                        {selected !== undefined && selected !== null
                          ? q.options[selected]
                          : 'वेळ संपल्यामुळे उत्तर दिले नाही.'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-900 flex flex-col justify-center">
                      <span className="text-slate-500 font-medium">योग्य पर्याय:</span>
                      <span className="text-emerald-400 font-semibold mt-0.5">
                        {q.options[q.correct_option]}
                      </span>
                    </div>
                  </div>

                  {/* Solution block */}
                  <div className="p-4 bg-indigo-950/10 border border-indigo-950/30 rounded-xl space-y-1.5 text-xs sm:text-sm">
                    <div className="font-bold text-indigo-400 flex items-center space-x-1">
                      <ChevronRight className="w-4 h-4" />
                      <span>स्पष्टीकरण:</span>
                    </div>
                    <p className="text-slate-450 leading-relaxed pl-5">{q.explanation}</p>
                  </div>

                </div>
              );
            })}
          </div>
        </div>

      </main>
    </div>
  );
}
