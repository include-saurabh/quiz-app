'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuizStore, Question } from '@/store/useQuizStore';
import { supabase } from '@/lib/supabase';
import { 
  Award, CheckCircle, XCircle, AlertCircle, Home, 
  RefreshCw, ChevronRight, Eye, ArrowRight 
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
        subject: q.subject,
        topic: q.topic,
        selected_option: selected !== undefined ? selected : null,
        correct_option: q.correct_option,
        is_correct: isCorrect,
      };
    });

    const percentage = Math.round((correct / questions.length) * 100);
    setStats({ correct, incorrect, unanswered, percentage });

    // 2. Insert into Supabase test_history via server-side API
    const saveResults = async () => {
      try {
        const finalUserId = user_id || useQuizStore.getState().user_id || useQuizStore.getState().initUserId();
        
        const res = await fetch('/api/save-test-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: finalUserId,
            testType: testType || 'topic-wise',
            topics: selectedTopics,
            score: correct,
            totalQuestions: questions.length,
            questionResults,
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to save test results');
        }

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
    resetQuiz();
    router.push('/');
  };

  if (!isClient || questions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800 font-mukta">
        <div className="animate-spin text-indigo-600 mb-4">
          <RefreshCw className="w-10 h-10" />
        </div>
        <p className="text-slate-500 text-sm">निकाल लोड होत आहेत...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-mukta text-slate-900 bg-slate-50 pb-16 px-4">
      
      {/* Top Header */}
      <header className="w-full max-w-2xl mx-auto py-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 sticky top-0 z-30">
        <h1 className="text-xl font-bold tracking-tight text-slate-850 flex items-center space-x-2">
          <Award className="w-5 h-5 text-indigo-600" />
          <span>चाचणीचा निकाल / Results</span>
        </h1>
        <button
          onClick={handleGoHome}
          className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-800 border border-slate-200 text-xs font-semibold rounded-xl transition-all flex items-center space-x-1 shadow-sm"
        >
          <Home className="w-3.5 h-3.5" />
          <span>डॅशबोर्ड</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-2xl mx-auto mt-6 flex-1 space-y-6">
        
        {/* Error notification if DB save fails */}
        {dbError && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start space-x-3 text-red-800">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" />
            <span className="text-sm">{dbError}</span>
          </div>
        )}

        {/* Circular / Large Score display */}
        <div className="p-8 bg-white border border-slate-200 rounded-2xl shadow-sm text-center space-y-4">
          <div className="w-28 h-28 mx-auto rounded-full bg-gradient-to-tr from-indigo-650 to-indigo-500 p-1 flex items-center justify-center shadow-md">
            <div className="w-full h-full bg-white rounded-full flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold text-slate-800 font-sans">{stats.percentage}%</span>
              <span className="text-[10px] text-indigo-650 uppercase tracking-widest font-semibold mt-0.5">टक्केवारी</span>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold">
              {stats.percentage >= 75 ? 'उत्कृष्ट कामगिरी! 🎉' : stats.percentage >= 40 ? 'चांगला प्रयत्न! 👍' : 'अजून सरावाची गरज आहे. 🎯'}
            </h2>
            <p className="text-slate-550 text-xs mt-1 sm:text-sm">आपला एकूण गुण आणि विश्लेषण खालीलप्रमाणे आहे.</p>
          </div>

          {/* Detailed stats grids */}
          <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto pt-2">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-emerald-600 font-sans font-bold text-lg">{stats.correct}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">बरोबर (Correct)</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-red-600 font-sans font-bold text-lg">{stats.incorrect}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">चूक (Wrong)</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-yellow-600 font-sans font-bold text-lg">{stats.unanswered}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">अनुत्तरित (Missed)</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleRetry}
            className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 text-sm sm:text-base hover:scale-[1.002]"
          >
            <RefreshCw className="w-4 h-4" />
            <span>पुन्हा प्रयत्न करा / Try Again</span>
          </button>
          <button
            onClick={handleGoHome}
            className="flex-1 py-3.5 bg-white hover:bg-slate-50 text-slate-705 border border-slate-200 font-bold rounded-xl transition-all flex items-center justify-center space-x-2 text-sm sm:text-base hover:scale-[1.002] shadow-sm"
          >
            <span>डॅशबोर्डवर जा</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Section: Question Review */}
        <div className="space-y-4 pt-4">
          <h3 className="text-lg font-bold text-slate-805">प्रश्नोत्तर पुनरावलोकन / Review Questions ({questions.length})</h3>
          
          <div className="space-y-4">
            {questions.map((q, idx) => {
              const selected = answers[q.id];
              const isCorrect = selected !== undefined && selected !== null && selected === q.correct_option;
              
              return (
                <div 
                  key={q.id}
                  className={`p-5 bg-white border rounded-2xl shadow-sm space-y-4 relative ${
                    selected === undefined || selected === null 
                      ? 'border-yellow-200 bg-yellow-50/10' 
                      : isCorrect 
                        ? 'border-emerald-200 bg-emerald-50/10' 
                        : 'border-red-200 bg-red-50/10'
                  }`}
                >
                  {/* Top Badge */}
                  <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                    <span className="text-xs font-semibold px-2 py-0.5 bg-slate-50 border border-slate-200 text-indigo-650 rounded-md">
                      {q.subject} • {q.topic}
                    </span>
                    <div className="flex items-center space-x-1.5">
                      {selected === undefined || selected === null ? (
                        <span className="text-xs text-yellow-600 font-semibold flex items-center space-x-1 bg-yellow-50 px-2 py-0.5 rounded-md border border-yellow-100">
                          <span>अनुत्तरित</span>
                        </span>
                      ) : isCorrect ? (
                        <span className="text-xs text-emerald-650 font-semibold flex items-center space-x-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>बरोबर</span>
                        </span>
                      ) : (
                        <span className="text-xs text-red-655 font-semibold flex items-center space-x-1 bg-red-50 px-2 py-0.5 rounded-md border border-red-100">
                          <XCircle className="w-3.5 h-3.5 text-red-500" />
                          <span>चूक</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Question Text */}
                  <h4 className="text-sm sm:text-base font-bold leading-relaxed text-slate-800">
                    <span className="font-sans mr-1">{idx + 1}.</span> {q.question_text}
                  </h4>

                  {/* Attached Math image review */}
                  {q.image_url && (
                    <div className="w-fit max-w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2 flex justify-start">
                      <img
                        src={q.image_url}
                        alt="Math figure review"
                        className="max-h-36 object-contain rounded"
                      />
                    </div>
                  )}

                  {/* Chosen Option & Correct Option display */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-center">
                      <span className="text-slate-500 font-medium">आपला पर्याय:</span>
                      <span className={`font-semibold mt-0.5 ${
                        selected === undefined || selected === null 
                          ? 'text-yellow-600 italic' 
                          : isCorrect 
                            ? 'text-emerald-600' 
                            : 'text-red-500'
                      }`}>
                        {selected !== undefined && selected !== null
                          ? q.options[selected]
                          : 'वेळ संपल्यामुळे उत्तर दिले नाही.'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-center">
                      <span className="text-slate-500 font-medium">योग्य पर्याय:</span>
                      <span className="text-emerald-600 font-semibold mt-0.5">
                        {q.options[q.correct_option]}
                      </span>
                    </div>
                  </div>

                  {/* Solution block */}
                  <div className={`p-4 rounded-xl space-y-1.5 text-xs sm:text-sm border ${
                    isCorrect 
                      ? 'bg-indigo-50/50 border-indigo-100 text-slate-700' 
                      : 'bg-rose-50/70 border-rose-100 text-slate-700'
                  }`}>
                    <div className={`font-bold flex items-center space-x-1 ${isCorrect ? 'text-indigo-750' : 'text-rose-750'}`}>
                      <ChevronRight className="w-4 h-4" />
                      <span>{isCorrect ? 'स्पष्टीकरण (Explanation):' : 'स्पष्टीकरण व विश्लेषण (Incorrect - Explanation):'}</span>
                    </div>
                    <p className="text-slate-655 leading-relaxed pl-5">
                      {q.explanation ? q.explanation : 'या प्रश्नाचे स्पष्टीकरण उपलब्ध नाही.'}
                    </p>
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
