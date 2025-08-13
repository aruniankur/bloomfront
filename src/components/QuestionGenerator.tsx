
import React, { useState, useMemo, useRef, useEffect } from 'react';
import jsPDF from 'jspdf';
import type { BloomCategory, BloomWeights, GeneratedQuestion, QuestionStatus, ApiGeneratedQuestionItem, QuestionType } from 'types';
import Slider from './shared/Slider';
import FileUploader from './shared/FileUploader';

const STEPS = ['Upload', 'Configure', 'Weights', 'Review'];
const bloomCategories: { name: BloomCategory, description: string }[] = [
    { name: 'Remembering', description: 'Recalling facts and basic concepts.' },
    { name: 'Understanding', description: 'Explaining ideas or concepts.' },
    { name: 'Applying', description: 'Using information in new situations.' },
    { name: 'Analyzing', description: 'Drawing connections among ideas.' },
    { name: 'Evaluating', description: 'Justifying a stand or decision.' },
    { name: 'Creating', description: 'Producing new or original work.' },
];

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the Data URL prefix to send only the Base64 string
      resolve(result.split(',')[1]);
    };
    reader.onerror = error => reject(error);
  });

const QuestionGenerator: React.FC = () => {
  const [step, setStep] = useState(1);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [userInput, setUserInput] = useState('');
  const [questionLength, setQuestionLength] = useState<'Short' | 'Medium' | 'Long'>('Medium');
  const [numQuestions, setNumQuestions] = useState({ text: 5, trueFalse: 0, mcq: 0 });
  const [bloomWeights, setBloomWeights] = useState<BloomWeights>({
    Remembering: 20, Understanding: 20, Applying: 20,
    Analyzing: 20, Evaluating: 10, Creating: 10,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [reviewFilter, setReviewFilter] = useState<QuestionType | 'all'>('all');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const totalWeight = useMemo(() => Object.values(bloomWeights).reduce((sum: number, w: number) => sum + w, 0), [bloomWeights]);
  const totalNumQuestions = useMemo(() => Object.values(numQuestions).reduce((sum, count) => sum + count, 0), [numQuestions]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
            setIsExportMenuOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
        document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [exportMenuRef]);

  const handleWeightChange = (category: BloomCategory, value: number) => {
    setBloomWeights(prev => ({ ...prev, [category]: value }));
  };

  const handleNumQuestionChange = (type: keyof typeof numQuestions, value: number) => {
    setNumQuestions(prev => ({ ...prev, [type]: value }));
  };

  const applyWeightPreset = (preset: 'balanced' | 'high-order' | 'recall') => {
    if (preset === 'balanced') {
      setBloomWeights({ Remembering: 17, Understanding: 17, Applying: 17, Analyzing: 17, Evaluating: 16, Creating: 16 });
    } else if (preset === 'high-order') {
      setBloomWeights({ Remembering: 10, Understanding: 10, Applying: 15, Analyzing: 25, Evaluating: 25, Creating: 15 });
    } else if (preset === 'recall') {
      setBloomWeights({ Remembering: 30, Understanding: 30, Applying: 15, Analyzing: 10, Evaluating: 10, Creating: 5 });
    }
  };
  
  const handleGenerate = async () => {
    if (!uploadedFile) {
        setError("Please upload a file to generate questions from.");
        return;
    }
    if (totalNumQuestions === 0) {
        setError("Please select at least one question to generate.");
        return;
    }
    setIsLoading(true);
    setError(null);
    setGeneratedQuestions([]);

    try {
        const fileContentBase64 = await fileToBase64(uploadedFile);

        const payload = {
            file: {
                filename: uploadedFile.name,
                content: fileContentBase64,
                mimeType: uploadedFile.type,
            },
            config: {
                userInput,
                questionLength,
                numQuestions,
                bloomWeights,
            }
        };

        const response = await fetch('https://bloomflask-production.up.railway.app/generatequestion', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Request failed: ${response.statusText}`);
      }
      
      const data: ApiGeneratedQuestionItem[] = await response.json();

      const questions: GeneratedQuestion[] = data.map((q, index): GeneratedQuestion | null => {
        switch (q.question_type) {
            case 'text':
                return {
                    id: index,
                    text: q.questioninfo,
                    status: 'pending',
                    question_type: q.question_type,
                };
            case 'TrueFalse':
                return {
                    id: index,
                    text: q.questioninfo.question,
                    status: 'pending',
                    question_type: q.question_type,
                    answer: q.questioninfo.answer,
                };
            case 'MCQ':
                return {
                    id: index,
                    text: q.questioninfo.question,
                    status: 'pending',
                    question_type: q.question_type,
                    options: q.questioninfo.options,
                    answer: q.questioninfo.answer,
                };
            default:
                return null;
        }
      }).filter((q): q is GeneratedQuestion => q !== null);


      setGeneratedQuestions(questions);
      setStep(4);
    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
      setError(`Failed to generate questions: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const updateQuestionStatus = (id: number, status: QuestionStatus) => {
    setGeneratedQuestions(prev => prev.map(q => q.id === id ? { ...q, status } : q));
  };

  const filteredQuestions = useMemo(() => {
    if (reviewFilter === 'all') return generatedQuestions;
    return generatedQuestions.filter(q => q.question_type === reviewFilter);
  }, [generatedQuestions, reviewFilter]);

  const acceptedQuestions = useMemo(() => generatedQuestions.filter(q => q.status === 'accepted'), [generatedQuestions]);

  const handleExportTXT = () => {
    if (acceptedQuestions.length === 0) return;
    const content = acceptedQuestions.map((q, index) => {
      let questionContent = `${index + 1}. ${q.text}`;
      if (q.question_type === 'TrueFalse') {
          questionContent += ` (True/False)\n   Answer: ${q.answer}`;
      } else if (q.question_type === 'MCQ' && q.options) {
          const optionsString = q.options.map((opt, i) => `   ${String.fromCharCode(97 + i)}) ${opt}`).join('\n');
          questionContent += `\n${optionsString}`;
          if (q.answer !== undefined) {
              const answerOption = q.answer as string;
              const answerIndex = q.options.findIndex(opt => opt === answerOption);
              const answerLabel = answerIndex !== -1 ? `${String.fromCharCode(97 + answerIndex)}) ${answerOption}` : answerOption;
              questionContent += `\n   Answer: ${answerLabel}`;
          }
      }
      return questionContent;
    }).join('\n\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bloomsphere-questions.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsExportMenuOpen(false);
  };

  const handleExportPDF = () => {
    if (acceptedQuestions.length === 0) return;
    const doc = new jsPDF();
    const margin = 15;
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = margin;

    const checkPageBreak = (neededHeight: number) => {
        if (yPos + neededHeight > pageHeight - margin) {
            doc.addPage();
            yPos = margin;
        }
    };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    checkPageBreak(20);
    doc.text("BloomSphere Generated Questions", doc.internal.pageSize.getWidth() / 2, yPos, { align: 'center' });
    yPos += 15;
    
    acceptedQuestions.forEach((q, index) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);

        const questionText = `${index + 1}. ${q.text}${q.question_type === 'TrueFalse' ? ' (True/False)' : ''}`;
        const textLines = doc.splitTextToSize(questionText, doc.internal.pageSize.getWidth() - margin * 2);
        
        checkPageBreak(textLines.length * 7);
        doc.text(textLines, margin, yPos);
        yPos += textLines.length * 7;

        if (q.question_type === 'MCQ' && q.options) {
            yPos += 2;
            doc.setFont('courier', 'normal');
            q.options.forEach((opt, i) => {
                const optionChar = `${String.fromCharCode(97 + i)})`;
                const optionText = `${optionChar} ${opt}`;
                const optionLines = doc.splitTextToSize(optionText, doc.internal.pageSize.getWidth() - margin * 2 - 8);
                checkPageBreak(optionLines.length * 7);
                doc.text(optionLines, margin + 8, yPos);
                yPos += optionLines.length * 7;
            });
        }
        
        if (q.answer !== undefined) {
            let answerString = '';
            if (q.question_type === 'TrueFalse') {
                answerString = `Answer: ${q.answer}`;
            } else if (q.question_type === 'MCQ' && q.options) {
                const answerOption = q.answer as string;
                const answerIndex = q.options.findIndex(opt => opt === answerOption);
                const answerLabel = answerIndex !== -1 ? `${String.fromCharCode(97 + answerIndex)}) ${answerOption}` : answerOption;
                answerString = `Answer: ${answerLabel}`;
            }

            if (answerString) {
                yPos += 3;
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                const answerLines = doc.splitTextToSize(answerString, doc.internal.pageSize.getWidth() - margin * 2 - 8);
                checkPageBreak(answerLines.length * 6);
                doc.text(answerLines, margin + 4, yPos);
                yPos += answerLines.length * 6;
            }
        }
        yPos += 10;
    });

    doc.save('bloomsphere-questions.pdf');
    setIsExportMenuOpen(false);
  };
  
  const renderStepContent = () => {
    switch (step) {
      case 1: // Upload
        return (
          <div className="text-center w-full">
            <h3 className="text-xl font-semibold text-slate-700 mb-2">Upload Source Document</h3>
            <p className="text-slate-500 mb-6">Upload a PDF document (max 10MB).</p>
            <div className="max-w-4xl mx-auto">
              <FileUploader onFileSelect={setUploadedFile} />
            </div>
          </div>
        );
      case 2: // Configure
        return (
          <div className="w-full">
            <h3 className="text-xl font-semibold text-slate-700 mb-6 text-center">Configure Generation</h3>
            <div className="max-w-5xl mx-auto space-y-8">
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg space-y-6">
                <h4 className="font-semibold text-slate-800">Question Types</h4>
                <Slider label="Number of Text Questions" min={0} max={10} value={numQuestions.text} onChange={(val) => handleNumQuestionChange('text', val)} />
                <Slider label="Number of True/False Questions" min={0} max={10} value={numQuestions.trueFalse} onChange={(val) => handleNumQuestionChange('trueFalse', val)} />
                <Slider label="Number of Multiple Choice (MCQ)" min={0} max={10} value={numQuestions.mcq} onChange={(val) => handleNumQuestionChange('mcq', val)} />
              </div>
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg space-y-6">
                 <h4 className="font-semibold text-slate-800">Question Details</h4>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Question Length <span className="text-slate-400">(for text questions)</span></label>
                  <div className="flex w-full bg-slate-100 rounded-lg p-1 border border-slate-200">
                      {(['Short', 'Medium', 'Long'] as const).map(option => (
                          <button key={option} type="button" onClick={() => setQuestionLength(option)}
                              className={`w-full text-center py-2 rounded-md text-sm font-semibold transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-slate-100 ${questionLength === option ? 'bg-white text-primary shadow-sm' : 'bg-transparent text-slate-500 hover:bg-white/60'}`}>
                              {option}
                          </button>
                      ))}
                  </div>
                </div>
                <textarea
                    placeholder="Optional: Enter any specific query or context..."
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary transition h-24"
                />
              </div>
            </div>
          </div>
        );
      case 3: // Weights
        return (
          <div className="w-full">
            <h3 className="text-xl font-semibold text-slate-700 mb-2 text-center">Adjust Bloom's Taxonomy Weights</h3>
            <p className="text-slate-500 mb-6 text-center">Set the relative importance for each category. Weights will be normalized.</p>
            <div className="max-w-6xl mx-auto">
              <div className="flex justify-center gap-2 mb-6">
                  <button onClick={() => applyWeightPreset('balanced')} className="px-4 py-1.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-full hover:bg-slate-200 transition-transform hover:scale-105">Balanced</button>
                  <button onClick={() => applyWeightPreset('high-order')} className="px-4 py-1.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-full hover:bg-slate-200 transition-transform hover:scale-105">High-Order</button>
                  <button onClick={() => applyWeightPreset('recall')} className="px-4 py-1.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-full hover:bg-slate-200 transition-transform hover:scale-105">Recall</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  {bloomCategories.map(({ name, description }) => (
                      <Slider key={name} label={name} helpText={description} min={0} max={100}
                          value={bloomWeights[name]} onChange={(val) => handleWeightChange(name, val)} />
                  ))}
              </div>
            </div>
          </div>
        );
      case 4: // Review
        return (
          <div>
            <h3 className="text-xl font-semibold text-slate-700 mb-6 text-center">Review Generated Questions</h3>
            <div className="flex flex-col md:flex-row gap-8">
              {/* Left Pane: Generated Questions */}
              <div className="flex-grow">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => setReviewFilter('all')} className={`px-3 py-1 text-sm rounded-full transition-all ${reviewFilter === 'all' ? 'bg-primary text-white shadow' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'}`}>All</button>
                    <button onClick={() => setReviewFilter('text')} className={`px-3 py-1 text-sm rounded-full transition-all ${reviewFilter === 'text' ? 'bg-primary text-white shadow' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'}`}>Text</button>
                    <button onClick={() => setReviewFilter('TrueFalse')} className={`px-3 py-1 text-sm rounded-full transition-all ${reviewFilter === 'TrueFalse' ? 'bg-primary text-white shadow' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'}`}>T/F</button>
                    <button onClick={() => setReviewFilter('MCQ')} className={`px-3 py-1 text-sm rounded-full transition-all ${reviewFilter === 'MCQ' ? 'bg-primary text-white shadow' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'}`}>MCQ</button>
                  </div>
                  <button onClick={handleGenerate} disabled={isLoading} className="text-sm text-primary hover:underline font-semibold disabled:text-slate-400 disabled:no-underline">
                    {isLoading ? 'Regenerating...' : 'Regenerate All'}
                  </button>
                </div>
                <div className="space-y-4">
                  {filteredQuestions.map(q => (
                    <div key={q.id} className="p-4 border border-slate-200 rounded-lg bg-slate-50/50 hover:shadow-md hover:border-primary-200 transition-all duration-300">
                      <p className="text-slate-800">{q.text}</p>
                       {q.question_type === 'TrueFalse' && <p className="text-sm text-slate-500 mt-1 italic">(True / False)</p>}
                       {q.question_type === 'MCQ' && q.options && (
                        <ul className="mt-3 space-y-1 pl-5 text-slate-700 list-[lower-alpha]">
                          {q.options.map((option, i) => (
                            <li key={i}>{option}</li>
                          ))}
                        </ul>
                      )}
                      <div className="flex items-center justify-end mt-3 gap-4">
                           <span className="text-xs font-semibold px-2 py-0.5 text-slate-600 bg-slate-200 rounded-full capitalize">{q.question_type}</span>
                           <button onClick={() => updateQuestionStatus(q.id, 'accepted')} className={`text-sm font-medium transition-colors ${q.status === 'accepted' ? 'text-green-600 font-bold' : 'text-slate-400 hover:text-green-600'}`}>Accept</button>
                           <button onClick={() => updateQuestionStatus(q.id, 'discarded')} className={`text-sm font-medium transition-colors ${q.status === 'discarded' ? 'text-red-600 font-bold' : 'text-slate-400 hover:text-red-600'}`}>Discard</button>
                      </div>
                    </div>
                  ))}
                  {filteredQuestions.length === 0 && <p className="text-slate-500 text-center py-8">No questions in this category.</p>}
                </div>
              </div>
              {/* Right Pane: Accepted Questions */}
              <div className="w-full md:w-1/3 md:max-w-sm flex-shrink-0">
                <div className="p-4 border border-green-200 bg-green-50 rounded-lg sticky top-8">
                  <h4 className="font-semibold text-green-800 mb-3">{acceptedQuestions.length} Accepted Question(s)</h4>
                  {acceptedQuestions.length > 0 ? (
                    <ul className="space-y-2 list-decimal list-inside text-sm text-green-900">
                       {acceptedQuestions.map(q => (
                        <li key={q.id}>
                          {q.text}
                          {q.question_type === 'MCQ' && q.options && (
                            <ul className="pl-5 mt-1 list-[lower-alpha] text-xs">
                              {q.options.map((opt, i) => <li key={i}>{opt}</li>)}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-green-700">Accept questions to see them here.</p>
                  )}
                  <div ref={exportMenuRef} className="mt-4 relative w-full">
                      <button
                          onClick={() => setIsExportMenuOpen(prev => !prev)}
                          disabled={acceptedQuestions.length === 0}
                          className="w-full bg-green-600 text-white font-bold py-2.5 px-4 rounded-md hover:bg-green-700 transition duration-300 disabled:bg-slate-400 disabled:cursor-not-allowed shadow hover:shadow-lg flex items-center justify-center gap-2"
                      >
                          Export Accepted
                          <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                      </button>
                      {isExportMenuOpen && (
                          <div className="absolute bottom-full mb-2 w-full bg-white rounded-md shadow-lg border border-slate-200 z-10 animate-fade-in-fast p-1">
                              <button onClick={handleExportPDF} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-md flex items-center gap-3 transition-colors">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
                                  Download as PDF
                              </button>
                              <button onClick={handleExportTXT} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-md flex items-center gap-3 transition-colors">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500" viewBox="0 0 20 20" fill="currentColor"><path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" /><path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h1a2 2 0 002-2V9a2 2 0 00-2-2h-1z" /></svg>
                                  Download as TXT
                              </button>
                          </div>
                      )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
    }
  };

  return (
    <div className="space-y-10">
      <style>{`
          .animate-fade-in-fast { animation: fadeInFast 0.2s ease-in-out forwards; }
          @keyframes fadeInFast { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      {/* Stepper UI */}
      <div className="flex items-center justify-center space-x-2 sm:space-x-4">
        {STEPS.map((s, index) => (
          <React.Fragment key={s}>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${step > index ? 'bg-primary text-white scale-105 shadow-lg' : step === index + 1 ? 'bg-primary-200 text-primary-700 ring-4 ring-primary-100' : 'bg-slate-200 text-slate-500'}`}>
                {step > index ? '✔' : index + 1}
              </div>
              <span className={`font-semibold text-sm sm:text-base ${step >= index + 1 ? 'text-slate-700' : 'text-slate-400'}`}>{s}</span>
            </div>
            {index < STEPS.length - 1 && <div className={`flex-1 h-1 rounded mx-2 ${step > index ? 'bg-primary' : 'bg-slate-200'}`}></div>}
          </React.Fragment>
        ))}
      </div>

      <div className="p-1 md:p-8 bg-white min-h-[400px] flex items-center justify-center">
        {renderStepContent()}
      </div>

       {error && (
        <div className="my-4 p-4 bg-red-100 border border-red-300 text-red-800 rounded-lg text-center">
            {error}
        </div>
      )}

      {/* Sticky Footer Navigation */}
      <footer className="sticky bottom-0 bg-white/80 backdrop-blur-sm p-4 border-t border-slate-200 -mx-10 -mb-10 mt-10 rounded-b-xl">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1 || isLoading}
            className="px-6 py-2.5 sm:px-8 text-sm font-bold text-slate-700 bg-slate-200 rounded-md hover:bg-slate-300 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105">
            Back
          </button>
          {step < 3 && (
            <button onClick={() => setStep(s => s + 1)} disabled={(step === 1 && !uploadedFile) || (step === 2 && totalNumQuestions === 0)}
              className="px-6 py-2.5 sm:px-8 text-sm font-bold text-white bg-primary rounded-md hover:bg-primary-600 transition-all duration-300 disabled:bg-slate-400 disabled:cursor-not-allowed shadow hover:shadow-lg hover:scale-105">
              Next
            </button>
          )}
          {step === 3 && (
            <button onClick={handleGenerate} disabled={totalWeight === 0 || isLoading || totalNumQuestions === 0}
              className="px-6 py-2.5 sm:px-8 text-sm font-bold text-white bg-primary rounded-md hover:bg-primary-600 transition-all duration-300 disabled:bg-slate-400 disabled:cursor-not-allowed shadow hover:shadow-lg hover:scale-105 flex items-center justify-center">
              {isLoading && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
              {isLoading ? 'Generating...' : 'Generate & Review'}
            </button>
          )}
          {step === 4 && (
             <button onClick={() => { setStep(1); setUploadedFile(null); setGeneratedQuestions([]); }}
              className="px-6 py-2.5 sm:px-8 text-sm font-bold text-white bg-primary rounded-md hover:bg-primary-600 transition-all duration-300 shadow hover:shadow-lg hover:scale-105">
              Start Over
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};

export default QuestionGenerator;
