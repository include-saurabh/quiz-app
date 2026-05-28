'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuizStore, Question } from '@/store/useQuizStore';
import { 
  ArrowRight, Timer, AlertCircle, VolumeX, Eye, 
  HelpCircle, ChevronRight, CornerDownRight, Home, RefreshCw 
} from 'lucide-react';

export default function QuizPage() {
  const router = useRouter();
  
  // Zustand Store hooks
  const isPlaying = useQuizStore((state) => state.isPlaying);
  const questions = useQuizStore((state) => state.questions);
  const currentIndex = useQuizStore((state) => state.currentIndex);
  const answers = useQuizStore((state) => state.answers);
  const timeLeft = useQuizStore((state) => state.timeLeft);
  const timePerQuestion = useQuizStore((state) => state.timePerQuestion);
  const timerActive = useQuizStore((state) => state.timerActive);
  
  const tickTimer = useQuizStore((state) => state.tickTimer);
  const selectOption = useQuizStore((state) => state.selectOption);
  const nextQuestion = useQuizStore((state) => state.nextQuestion);
  const setTimerActive = useQuizStore((state) => state.setTimerActive);
  const loadQuizBackupState = useQuizStore((state) => state.loadQuizBackupState);
  const resetQuiz = useQuizStore((state) => state.resetQuiz);

  // Local component states
  const [toastMessage, setToastMessage] = useState<string>('');
  const [hasRestored, setHasRestored] = useState<boolean>(false);
  const [isClient, setIsClient] = useState<boolean>(false);

  const currentQuestion = questions[currentIndex] as Question | undefined;
  const selectedAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;
  const isAnswered = selectedAnswer !== undefined;

  // 1. Safe Client hydration checking
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 2. Load Backup State if not currently playing (e.g. refreshed page)
  useEffect(() => {
    if (isClient && !isPlaying && !hasRestored) {
      const restored = loadQuizBackupState();
      setHasRestored(true);
      if (!restored) {
        router.push('/');
      }
    }
  }, [isPlaying, isClient, hasRestored, loadQuizBackupState, router]);

  // 3. Tab Visibility API Listener (Pauses timer and backups state)
  useEffect(() => {
    if (!isPlaying) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTimerActive(false);
      } else {
        setTimerActive(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPlaying, setTimerActive]);

  // 4. Timer interval tick
  useEffect(() => {
    if (!isPlaying || !timerActive) return;

    const timer = setInterval(() => {
      tickTimer();
    }, 1000);

    return () => clearInterval(timer);
  }, [isPlaying, timerActive, tickTimer]);

  // 5. Timer Expiry toast handler
  useEffect(() => {
    const handleTimerExpired = (e: Event) => {
      const customEvent = e as CustomEvent;
      const isLast = customEvent.detail?.isLast;

      setToastMessage('वेळ संपली!');
      setTimeout(() => setToastMessage(''), 3000);

      if (isLast) {
        router.push('/results');
      }
    };

    window.addEventListener('quiz-timer-expired', handleTimerExpired);
    return () => {
      window.removeEventListener('quiz-timer-expired', handleTimerExpired);
    };
  }, [router]);

  // Handle Option Click
  const handleOptionClick = (optionIdx: number) => {
    if (isAnswered || !currentQuestion) return;
    setTimerActive(false);
    selectOption(currentQuestion.id, optionIdx);
  };

  // Handle Next Click
  const handleNextClick = () => {
    const hasMore = nextQuestion();
    if (!hasMore) {
      router.push('/results');
    }
  };

  const handleQuitQuiz = () => {
    if (confirm('तुम्हाला खरोखर चाचणी थांबवायची आहे का? आपली प्रगती गमावली जाईल.')) {
      resetQuiz();
      router.push('/');
    }
  };

  if (!isClient || !currentQuestion) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800 font-mukta">
        <div className="animate-spin text-indigo-650 mb-4">
          <RefreshCw className="w-10 h-10" />
        </div>
        <p className="text-slate-500 text-sm">चाचणी लोड होत आहे...</p>
      </div>
    );
  }

  // Calculate timer circle path dash offset for animations
  const progressPercent = (timeLeft / timePerQuestion) * 100;
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="min-h-screen flex flex-col font-mukta text-slate-900 bg-slate-50 pb-16 px-4">
      
      {/* Quiz Header */}
      <header className="w-full max-w-2xl mx-auto py-4 flex items-center justify-between border-b border-slate-200 sticky top-0 bg-slate-50/90 backdrop-blur-sm z-30">
        <button
          onClick={handleQuitQuiz}
          className="text-slate-600 hover:text-slate-900 transition-colors text-sm font-semibold flex items-center space-x-1"
        >
          <Home className="w-4 h-4" />
          <span>थांबवा</span>
        </button>

        <div className="text-center">
          <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">प्रगती / Progress</span>
          <div className="text-base font-extrabold text-slate-800 font-sans mt-0.5">
            {currentIndex + 1} / {questions.length}
          </div>
        </div>

        {/* Dynamic Circular Timer */}
        <div className="relative w-12 h-12 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="24"
              cy="24"
              r={radius}
              className="stroke-slate-200"
              strokeWidth="3.5"
              fill="transparent"
            />
            <circle
              cx="24"
              cy="24"
              r={radius}
              className={`transition-all duration-1000 ${
                timeLeft <= 10 
                  ? 'stroke-red-500 drop-shadow-[0_0_4px_rgba(239,68,68,0.3)]' 
                  : 'stroke-indigo-600'
              }`}
              strokeWidth="3.5"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>
          <span className={`absolute text-sm font-bold font-sans ${timeLeft <= 10 ? 'text-red-500 font-extrabold' : 'text-slate-800'}`}>
            {timeLeft}
          </span>
        </div>
      </header>

      {/* Main Quiz Section */}
      <main className="w-full max-w-2xl mx-auto mt-6 flex-1 flex flex-col space-y-6">
        
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 px-5 py-3 bg-red-600 border border-red-500 text-white rounded-xl shadow-lg flex items-center space-x-2 z-50 animate-bounce">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="font-bold text-sm tracking-wide">{toastMessage}</span>
          </div>
        )}

        {/* Card: Question & Attached Image */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
          <span className="inline-block text-xs font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-650 rounded-md border border-indigo-100">
            {currentQuestion.subject} • {currentQuestion.topic}
          </span>
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 leading-relaxed">
            {currentQuestion.question_text}
          </h2>

          {/* Attached Math Figure / Image */}
          {currentQuestion.image_url && (
            <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center p-3 relative group">
              <img
                src={currentQuestion.image_url}
                alt="Math figure for the question"
                className="max-h-60 object-contain rounded-lg transition-transform group-hover:scale-[1.01]"
              />
              <div className="absolute top-2 right-2 p-1 bg-white rounded-md border border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                <Eye className="w-4 h-4 text-indigo-600" />
              </div>
            </div>
          )}
        </div>

        {/* List: 4 Options */}
        <div className="space-y-3">
          {currentQuestion.options.map((option, idx) => {
            const isCorrect = idx === currentQuestion.correct_option;
            const isSelected = selectedAnswer !== null && idx === selectedAnswer;
            
            // Visual styles
            let optionStyles = 'border-slate-200 bg-white text-slate-700 hover:border-slate-350 hover:bg-slate-50';
            let iconText = '';
            let indicatorBg = 'border-slate-250 text-slate-500';

            if (isAnswered) {
              if (isCorrect) {
                optionStyles = 'border-emerald-500 bg-emerald-50 text-emerald-900';
                indicatorBg = 'bg-emerald-600 border-emerald-500 text-white';
                iconText = '✓';
              } else if (isSelected) {
                optionStyles = 'border-red-500 bg-red-50 text-red-900';
                indicatorBg = 'bg-red-650 border-red-500 text-white';
                iconText = '×';
              } else {
                optionStyles = 'border-slate-100 bg-slate-50/50 text-slate-400 opacity-60';
                indicatorBg = 'border-slate-150 text-slate-350';
              }
            }

            return (
              <button
                key={idx}
                disabled={isAnswered}
                onClick={() => handleOptionClick(idx)}
                className={`w-full p-4 border rounded-xl flex items-center justify-between text-left text-sm sm:text-base font-semibold transition-all relative ${optionStyles} ${
                  !isAnswered ? 'cursor-pointer hover:scale-[1.002] shadow-sm' : 'cursor-default'
                }`}
              >
                <div className="flex items-center space-x-3.5 pr-4">
                  <span className={`w-6 h-6 rounded-lg border text-xs font-bold font-sans flex items-center justify-center shrink-0 ${indicatorBg}`}>
                    {iconText || String.fromCharCode(65 + idx)}
                  </span>
                  <span>{option}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Solution & Explanation reveals below options */}
        {isAnswered && (
          <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-2xl space-y-3 animate-fade-in shadow-sm">
            <div className="flex items-center space-x-2 text-indigo-700">
              <CornerDownRight className="w-5 h-5" />
              <h3 className="font-bold text-sm sm:text-base">स्पष्टीकरण (Solution & Explanation):</h3>
            </div>
            <p className="text-slate-650 text-sm leading-relaxed pl-7">
              {currentQuestion.explanation}
            </p>
          </div>
        )}

        {/* Action button "पुढे" (Next) */}
        {isAnswered && (
          <button
            onClick={handleNextClick}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-750 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 text-base hover:scale-[1.002]"
          >
            <span>{currentIndex === questions.length - 1 ? 'निकाल पहा' : 'पुढे'}</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

      </main>
    </div>
  );
}
