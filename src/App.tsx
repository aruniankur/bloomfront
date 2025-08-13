import React, { useState } from 'react';
import QuestionGenerator from './components/QuestionGenerator';
import PaperScorer from './components/PaperScorer';

type Tab = 'generator' | 'scorer';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('generator');

  const tabStyles = "text-base sm:text-lg font-medium py-3 sm:py-4 px-2 sm:px-6 text-center transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 rounded-t-lg flex-1 flex items-center justify-center gap-2";
  const activeTabStyles = "text-primary bg-white scale-105 shadow-md";
  const inactiveTabStyles = "text-slate-500 hover:text-primary hover:bg-slate-100/50 scale-100";

  return (
    <div className="min-h-screen bg-primary-50 text-slate-800 font-sans">
      <div className="container mx-auto p-4 sm:p-6 md:p-8 max-w-7xl">
        <header className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-teal-500 py-2">
              BloomSphere
            </h1>
            <p className="mt-2 text-base sm:text-lg text-slate-600">AI-Powered Insights for Academic Excellence</p>
        </header>

        <div className="bg-slate-100/80 p-1.5 rounded-xl shadow-inner-lg backdrop-blur-sm">
          <nav className="flex border-b border-slate-200 bg-transparent rounded-t-lg">
              <button
                  onClick={() => setActiveTab('generator')}
                  className={`${tabStyles} ${activeTab === 'generator' ? activeTabStyles : inactiveTabStyles}`}
              >
                  <span>🎓</span>
                  <span className="hidden md:inline">Question </span>
                  <span>Generator</span>
              </button>
              <button
                  onClick={() => setActiveTab('scorer')}
                  className={`${tabStyles} ${activeTab === 'scorer' ? activeTabStyles : inactiveTabStyles}`}
              >
                  <span>📄</span>
                  <span className="hidden md:inline">Paper </span>
                  <span>Scorer</span>
              </button>
          </nav>
          <main className="bg-white shadow-lg rounded-b-xl p-4 sm:p-6 md:p-10">
              <div className={activeTab === 'generator' ? '' : 'hidden'}>
                <QuestionGenerator />
              </div>
              <div className={activeTab === 'scorer' ? '' : 'hidden'}>
                <PaperScorer />
              </div>
          </main>
        </div>
        <footer className="text-center mt-8 text-slate-500 text-sm">
          <p>Built with React, Tailwind CSS, and the Gemini API</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
