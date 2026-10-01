import React, { useState, useEffect, useMemo } from 'react';
import {
  PenTool,
  Sparkles,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  RotateCcw,
  Save,
  Check,
  ChevronRight,
  TrendingUp,
  Award,
  Layers,
  FileText,
  Sliders,
  Send,
  Zap,
  HelpCircle,
  Eye,
  ExternalLink
} from 'lucide-react';
import API_BASE_URL from './config';

// Bilingual translations for Writing studio
const WRITING_TEXT = {
  en: {
    title: 'AI Writing Studio',
    subtitle: 'Practice essays, emails, and reflections with instant AI grammar, spelling, and CEFR grading.',
    tabPrompts: 'Guided Prompts',
    tabFree: 'Free Writing',
    tabPortfolio: 'My Portfolio',
    levelFilter: 'Level:',
    allLevels: 'All Levels',
    categoryFilter: 'Category:',
    allCategories: 'All Categories',
    selectPrompt: 'Select a Topic Prompt',
    customPromptTitle: 'Free Writing Topic',
    customPromptDesc: 'Write freely on any topic of your choice. Type an optional topic title below.',
    customTitlePlaceholder: 'e.g. My Thoughts on Climate Change or Recent Book Review...',
    writePlaceholder: 'Start writing your essay, letter, or thoughts here in English. Use paragraphs for better structure...',
    wordCount: 'words',
    target: 'Target',
    charCount: 'chars',
    sentences: 'sentences',
    estReadingTime: 'min read',
    assessBtn: 'Assess My Writing',
    assessing: 'Analyzing with AI...',
    clearBtn: 'Clear Text',
    savedToPortfolio: 'Saved to Portfolio!',
    savePortfolioBtn: 'Save to My Portfolio',
    savingPortfolio: 'Saving...',
    evaluationTitle: 'Assessment Results',
    overallScore: 'Overall Score',
    estimatedLevel: 'Estimated Level',
    rubricBreakdown: 'Rubric Performance',
    grammarSyntax: 'Grammar & Syntax',
    spellingPunct: 'Spelling & Punctuation',
    vocabularyVariety: 'Vocabulary Variety',
    coherenceFlow: 'Coherence & Flow',
    taskFulfillment: 'Task Fulfillment',
    tabIssues: 'Detected Issues',
    tabVocab: 'Vocabulary Upgrades',
    tabRewrite: 'Native AI Rewrite',
    tabActionPlan: 'Action Plan & Tips',
    noIssuesFound: 'Outstanding work! No major grammar or spelling errors were detected.',
    filterAll: 'All',
    filterGrammar: 'Grammar',
    filterSpelling: 'Spelling',
    filterPhrasing: 'Phrasing',
    originalText: 'Your Text',
    suggestedFix: 'Suggested Fix',
    whyRule: 'Why this matters:',
    betterAlternatives: 'Richer Alternatives:',
    keyStrengths: 'Key Strengths',
    growthAreas: 'Recommended Next Steps',
    nativeComparison: 'Compare your original writing with a polished, fluent native English version:',
    yourOriginal: 'Your Submission',
    nativeVersion: 'AI Polished Revision',
    portfolioTitle: 'Your Writing Portfolio',
    portfolioEmpty: 'No writing submissions yet. Pick a prompt and submit your first essay!',
    reviewedOn: 'Reviewed on',
    wordsCounted: 'words',
    viewReport: 'View Full Report',
    backToEditor: 'Edit / Try Another',
    tooShortError: 'Please write at least 15 words before requesting an evaluation.',
    modelBadge: 'Free Tier AI'
  },
  am: {
    title: 'የ AI ጽሑፍ ማዕከል',
    subtitle: 'ድርሰቶችን፣ ኢሜይሎችንና ሃሳቦችን ይጻፉ፤ በሰዋስው፣ ፊደል አጻጻፍ እና CEFR ፈጣን AI ውጤት ያግኙ።',
    tabPrompts: 'የተመረጡ ርዕሶች',
    tabFree: 'ነፃ ጽሑፍ',
    tabPortfolio: 'የጽሑፍ ታሪክ',
    levelFilter: 'ደረጃ:',
    allLevels: 'ሁሉም ደረጃዎች',
    categoryFilter: 'ምድብ:',
    allCategories: 'ሁሉም ምድቦች',
    selectPrompt: 'የጽሑፍ ርዕስ ይምረጡ',
    customPromptTitle: 'የነፃ ጽሑፍ ርዕስ',
    customPromptDesc: 'በፈለጉት ርዕስ ላይ በነፃነት ይጻፉ። ከፈለጉ የርዕሱን ስም ከታች ያስገቡ።',
    customTitlePlaceholder: 'ምሳሌ፦ ስለ አካባቢ ጥበቃ ያለኝ አስተያየት...',
    writePlaceholder: 'ድርሰትዎን ወይም መልእክትዎን እዚህ በእንግሊዝኛ ይጻፉ...',
    wordCount: 'ቃላት',
    target: 'ግቡ',
    charCount: 'ፊደላት',
    sentences: 'ዓረፍተ ነገሮች',
    estReadingTime: 'ደቂቃ ንባብ',
    assessBtn: 'ጽሑፌን ገምግም',
    assessing: 'AI እየገመገመ ነው...',
    clearBtn: 'አጽዳ',
    savedToPortfolio: 'በታሪክ ተቀምጧል!',
    savePortfolioBtn: 'ወደ ፖርትፎሊዮ አስቀምጥ',
    savingPortfolio: 'በማስቀመጥ ላይ...',
    evaluationTitle: 'የግምገማ ውጤት',
    overallScore: 'አጠቃላይ ውጤት',
    estimatedLevel: 'የተገመተ ደረጃ',
    rubricBreakdown: 'የመለኪያዎች አፈጻጸም',
    grammarSyntax: 'ሰዋስውና መዋቅር',
    spellingPunct: 'የፊደል አጻጻፍና ሥርዓተ-ነጥብ',
    vocabularyVariety: 'የቃላት ብልጽግና',
    coherenceFlow: 'ተያያዥነትና ፍሰት',
    taskFulfillment: 'የተልእኮ ምላሽ',
    tabIssues: 'የተገኙ ስህተቶች',
    tabVocab: 'የተሻሻሉ ቃላት',
    tabRewrite: 'የተስተካከለ ቅጂ',
    tabActionPlan: 'የማሻሻያ ምክሮች',
    noIssuesFound: 'ድንቅ ሥራ! ምንም ዓይነት ከባድ የሰዋስው ወይም የፊደል ስህተት አልተገኘም።',
    filterAll: 'ሁሉም',
    filterGrammar: 'ሰዋስው',
    filterSpelling: 'ፊደል',
    filterPhrasing: 'አገላለጽ',
    originalText: 'የእርስዎ ጽሑፍ',
    suggestedFix: 'የተስተካከለው',
    whyRule: 'ምክንያት:',
    betterAlternatives: 'የተሻሉ አገላለጾች:',
    keyStrengths: 'ጠንካራ ጎኖች',
    growthAreas: 'የሚቀጥሉ እርምጃዎች',
    nativeComparison: 'የእርስዎን ጽሑፍ ከተሻሻለው የእንግሊዝኛ ቅጂ ጋር ያወዳድሩ:',
    yourOriginal: 'የመጀመሪያ ጽሑፍዎ',
    nativeVersion: 'የተሻሻለ የእንግሊዝኛ ቅጂ',
    portfolioTitle: 'የጽሑፍ ፖርትፎሊዮ',
    portfolioEmpty: 'እስካሁን ምንም ጽሑፍ አልተገመገመም። ርዕስ መርጠው የመጀመሪያ ድርሰትዎን ይጻፉ!',
    reviewedOn: 'የተገመገመበት ቀን',
    wordsCounted: 'ቃላት',
    viewReport: 'ሙሉ ሪፖርት እይ',
    backToEditor: 'እንደገና ጻፍ / ሌላ ምረጥ',
    tooShortError: 'እባክዎ ከመገምገምዎ በፊት ቢያንስ 15 ቃላት ይጻፉ።',
    modelBadge: 'ነፃ AI ሞዴል'
  }
};

export default function Writing({ student, amharic = false, onNavigateToPractice }) {
  const T = amharic ? WRITING_TEXT.am : WRITING_TEXT.en;

  // View & Mode State
  const [activeTab, setActiveTab] = useState('prompts'); // 'prompts' | 'free' | 'portfolio'
  const [selectedLevel, setSelectedLevel] = useState(student?.cefrLevel || 'ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Prompts Library State
  const [prompts, setPrompts] = useState([]);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [activePrompt, setActivePrompt] = useState(null);

  // Editor State
  const [customTitle, setCustomTitle] = useState('');
  const [writingContent, setWritingContent] = useState('');
  const [isAssessing, setIsAssessing] = useState(false);
  const [assessError, setAssessError] = useState(null);

  // Assessment Result State
  const [assessment, setAssessment] = useState(null);
  const [resultSubTab, setResultSubTab] = useState('issues'); // 'issues' | 'vocab' | 'rewrite' | 'tips'
  const [issueFilter, setIssueFilter] = useState('ALL');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Portfolio State
  const [portfolio, setPortfolio] = useState([]);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [viewingPortfolioItem, setViewingPortfolioItem] = useState(null);

  // Fetch prompts on mount or level change
  useEffect(() => {
    async function loadPrompts() {
      setPromptsLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/writing/prompts?level=${selectedLevel}`);
        if (res.ok) {
          const data = await res.json();
          setPrompts(data.prompts || []);
          if (data.prompts && data.prompts.length > 0 && !activePrompt) {
            setActivePrompt(data.prompts[0]);
          }
        }
      } catch (err) {
        console.error('Error fetching writing prompts:', err);
      } finally {
        setPromptsLoading(false);
      }
    }
    loadPrompts();
  }, [selectedLevel]);

  // Fetch portfolio history when switching to portfolio tab
  useEffect(() => {
    if (activeTab === 'portfolio' && student?.studentId) {
      loadPortfolio();
    }
  }, [activeTab, student]);

  const loadPortfolio = async () => {
    if (!student?.studentId) return;
    setPortfolioLoading(true);
    try {
      const headers = student.token ? { 'Authorization': `Bearer ${student.token}` } : {};
      const res = await fetch(`${API_BASE_URL}/writing/history?studentId=${student.studentId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setPortfolio(data.submissions || []);
      }
    } catch (err) {
      console.error('Error loading writing portfolio:', err);
    } finally {
      setPortfolioLoading(false);
    }
  };

  // Text Stats
  const stats = useMemo(() => {
    const trimmed = writingContent.trim();
    if (!trimmed) {
      return { words: 0, chars: 0, sentences: 0, readTime: '0.0' };
    }
    const wordsArr = trimmed.match(/\b\w+\b/g) || [];
    const words = wordsArr.length;
    const chars = trimmed.length;
    const sentencesArr = trimmed.split(/[.!?]+/).filter(Boolean);
    const sentences = Math.max(sentencesArr.length, 1);
    const readTime = (words / 180).toFixed(1);
    return { words, chars, sentences, readTime };
  }, [writingContent]);

  // Filtered issues
  const filteredIssues = useMemo(() => {
    if (!assessment || !assessment.issues) return [];
    if (issueFilter === 'ALL') return assessment.issues;
    return assessment.issues.filter(
      (iss) => (iss.type || '').toLowerCase() === issueFilter.toLowerCase()
    );
  }, [assessment, issueFilter]);

  // Assess Writing Action
  const handleAssess = async () => {
    if (stats.words < 15) {
      setAssessError(T.tooShortError);
      return;
    }
    setAssessError(null);
    setIsAssessing(true);
    setAssessment(null);
    setIsSaved(false);

    try {
      const headers = student?.token
        ? { 'Authorization': `Bearer ${student.token}`, 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json' };

      const body = {
        text: writingContent,
        promptId: activeTab === 'prompts' ? activePrompt?.id : 'free-writing',
        promptTitle: activeTab === 'prompts' ? activePrompt?.title : customTitle || 'Free Writing',
        promptCategory: activeTab === 'prompts' ? activePrompt?.category : 'Free Writing',
        cefrLevel: student?.cefrLevel || 'B1'
      };

      const res = await fetch(`${API_BASE_URL}/writing/assess`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Evaluation service error');
      }

      const data = await res.json();
      setAssessment(data.assessment);
      setResultSubTab('issues');
    } catch (err) {
      console.error('Error during writing assessment:', err);
      setAssessError(err.message || 'Unable to assess writing. Please try again.');
    } finally {
      setIsAssessing(false);
    }
  };

  // Save to Portfolio Action
  const handleSaveToPortfolio = async () => {
    if (!assessment || !student?.studentId || isSaving || isSaved) return;
    setIsSaving(true);
    try {
      const headers = student?.token
        ? { 'Authorization': `Bearer ${student.token}`, 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json' };

      const body = {
        studentId: student.studentId,
        promptId: activeTab === 'prompts' ? activePrompt?.id : 'free-writing',
        promptTitle: activeTab === 'prompts' ? activePrompt?.title : customTitle || 'Free Writing',
        promptCategory: activeTab === 'prompts' ? activePrompt?.category : 'Free Writing',
        text: writingContent,
        wordCount: stats.words,
        overallScore: assessment.overallScore,
        cefrLevel: assessment.cefrLevel || student.cefrLevel,
        assessment: assessment
      };

      const res = await fetch(`${API_BASE_URL}/writing/save`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (res.ok) {
        setIsSaved(true);
        loadPortfolio();
      }
    } catch (err) {
      console.error('Error saving writing:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#10b981'; // Green
    if (score >= 65) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  };

  return (
    <div className="writing-container" style={{ padding: '2rem', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <div style={{ backgroundColor: 'var(--primary)', color: '#fff', padding: '8px', borderRadius: '10px', display: 'flex' }}>
              <PenTool size={22} />
            </div>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              {T.title}
            </h1>
            <span style={{
              backgroundColor: 'rgba(158, 40, 145, 0.1)',
              color: 'var(--primary)',
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Sparkles size={12} /> {T.modelBadge}
            </span>
          </div>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            {T.subtitle}
          </p>
        </div>

        {/* Top View Selector Tabs */}
        <div style={{
          display: 'flex',
          backgroundColor: 'rgba(0,0,0,0.04)',
          borderRadius: '14px',
          padding: '4px',
          gap: '4px'
        }}>
          <button
            onClick={() => { setActiveTab('prompts'); setViewingPortfolioItem(null); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
              backgroundColor: activeTab === 'prompts' ? '#ffffff' : 'transparent',
              color: activeTab === 'prompts' ? 'var(--primary)' : 'var(--text-muted)',
              boxShadow: activeTab === 'prompts' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            <BookOpen size={16} /> {T.tabPrompts}
          </button>

          <button
            onClick={() => { setActiveTab('free'); setViewingPortfolioItem(null); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
              backgroundColor: activeTab === 'free' ? '#ffffff' : 'transparent',
              color: activeTab === 'free' ? 'var(--primary)' : 'var(--text-muted)',
              boxShadow: activeTab === 'free' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            <Sliders size={16} /> {T.tabFree}
          </button>

          <button
            onClick={() => { setActiveTab('portfolio'); setViewingPortfolioItem(null); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
              backgroundColor: activeTab === 'portfolio' ? '#ffffff' : 'transparent',
              color: activeTab === 'portfolio' ? 'var(--primary)' : 'var(--text-muted)',
              boxShadow: activeTab === 'portfolio' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            <FileText size={16} /> {T.tabPortfolio}
            {portfolio.length > 0 && (
              <span style={{
                backgroundColor: 'var(--primary)',
                color: '#fff',
                fontSize: '0.7rem',
                padding: '1px 6px',
                borderRadius: '10px',
                fontWeight: 700
              }}>
                {portfolio.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* --- TAB 1: GUIDED PROMPTS & TAB 2: FREE WRITING --- */}
      {activeTab !== 'portfolio' && (
        <div style={{ display: 'grid', gridTemplateColumns: assessment ? '1fr 1fr' : '320px 1fr', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* LEFT COLUMN: Prompt Selector or Assessment Overview */}
          {activeTab === 'prompts' && !assessment && (
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '18px',
              padding: '1.25rem',
              border: '1px solid rgba(0,0,0,0.06)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
              maxHeight: 'calc(100vh - 160px)',
              overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {T.selectPrompt}
                </h3>
              </div>

              {/* Level Filter Pills */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {['ALL', 'A1', 'A2', 'B1', 'B2', 'C1'].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setSelectedLevel(lvl)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      backgroundColor: selectedLevel === lvl ? 'var(--primary)' : 'rgba(0,0,0,0.05)',
                      color: selectedLevel === lvl ? '#ffffff' : 'var(--text-muted)',
                      transition: 'all 0.15s'
                    }}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              {/* Prompt Card List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {promptsLoading ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', margin: '2rem 0' }}>Loading prompts...</p>
                ) : (
                  prompts.map((p) => {
                    const isSelected = activePrompt?.id === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          setActivePrompt(p);
                          setAssessment(null);
                        }}
                        style={{
                          padding: '1rem',
                          borderRadius: '12px',
                          border: isSelected ? '2px solid var(--primary)' : '1px solid rgba(0,0,0,0.08)',
                          backgroundColor: isSelected ? 'rgba(158, 40, 145, 0.03)' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          boxShadow: isSelected ? '0 4px 12px rgba(158, 40, 145, 0.08)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{
                            backgroundColor: 'rgba(158, 40, 145, 0.1)',
                            color: 'var(--primary)',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '6px'
                          }}>
                            {p.level}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {p.targetWords}
                          </span>
                        </div>
                        <h4 style={{ margin: '4px 0', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)' }}>
                          {p.title}
                        </h4>
                        <p style={{
                          margin: 0,
                          fontSize: '0.8rem',
                          color: 'var(--text-muted)',
                          lineHeight: 1.4,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}>
                          {p.instructions}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ASSESSMENT OVERVIEW (when assessment is ready, shows on the left/first column) */}
          {assessment && (
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              padding: '1.5rem',
              border: '1px solid rgba(0,0,0,0.06)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
              maxHeight: 'calc(100vh - 160px)',
              overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  {T.evaluationTitle}
                </h2>
                <button
                  onClick={() => { setAssessment(null); }}
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.05)',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: 'var(--text-muted)'
                  }}
                >
                  {T.backToEditor}
                </button>
              </div>

              {/* Big Score Card */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(158, 40, 145, 0.08) 0%, rgba(229, 169, 53, 0.08) 100%)',
                borderRadius: '16px',
                padding: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-around',
                border: '1px solid rgba(158, 40, 145, 0.15)',
                marginBottom: '1.5rem'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem', fontWeight: 900, color: getScoreColor(assessment.overallScore), lineHeight: 1 }}>
                    {assessment.overallScore}
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: '4px', textTransform: 'uppercase' }}>
                    {T.overallScore}
                  </div>
                </div>

                <div style={{ width: '1px', height: '40px', backgroundColor: 'rgba(0,0,0,0.1)' }} />

                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '1.75rem',
                    fontWeight: 800,
                    color: 'var(--primary)',
                    backgroundColor: '#ffffff',
                    padding: '2px 14px',
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(158, 40, 145, 0.1)',
                    display: 'inline-block'
                  }}>
                    {assessment.cefrLevel || 'B1'}
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: '4px', textTransform: 'uppercase' }}>
                    {T.estimatedLevel}
                  </div>
                </div>

                <div style={{ width: '1px', height: '40px', backgroundColor: 'rgba(0,0,0,0.1)' }} />

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {stats.words}
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: '4px', textTransform: 'uppercase' }}>
                    {T.wordCount}
                  </div>
                </div>
              </div>

              {/* Feedback Summary Quote */}
              {assessment.feedbackSummary && (
                <div style={{
                  padding: '1rem',
                  backgroundColor: 'rgba(0,0,0,0.02)',
                  borderRadius: '12px',
                  borderLeft: '4px solid var(--primary)',
                  marginBottom: '1.5rem',
                  fontSize: '0.9rem',
                  color: 'var(--text-main)',
                  lineHeight: 1.5
                }}>
                  "{assessment.feedbackSummary}"
                </div>
              )}

              {/* 5-Metric Breakdown */}
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {T.rubricBreakdown}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
                {assessment.metrics && Object.entries(assessment.metrics).map(([key, data]) => {
                  const score = typeof data === 'object' ? data.score : data;
                  const label = typeof data === 'object' ? data.label : '';
                  const feedback = typeof data === 'object' ? data.feedback : '';
                  const titleMap = {
                    grammar: T.grammarSyntax,
                    spelling: T.spellingPunct,
                    vocabulary: T.vocabularyVariety,
                    coherence: T.coherenceFlow,
                    taskRelevance: T.taskFulfillment
                  };

                  return (
                    <div key={key} style={{
                      padding: '0.75rem',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(0,0,0,0.015)',
                      border: '1px solid rgba(0,0,0,0.04)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                          {titleMap[key] || key}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {label && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                              {label}
                            </span>
                          )}
                          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: getScoreColor(score) }}>
                            {score}%
                          </span>
                        </div>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '6px',
                        backgroundColor: 'rgba(0,0,0,0.06)',
                        borderRadius: '3px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${score}%`,
                          height: '100%',
                          backgroundColor: getScoreColor(score),
                          borderRadius: '3px',
                          transition: 'width 0.5s ease-out'
                        }} />
                      </div>
                      {feedback && (
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {feedback}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Save to Portfolio Button */}
              <button
                onClick={handleSaveToPortfolio}
                disabled={isSaving || isSaved}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: isSaved ? '#10b981' : 'var(--primary)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: isSaving || isSaved ? 'default' : 'pointer',
                  boxShadow: '0 4px 12px rgba(158, 40, 145, 0.2)',
                  transition: 'all 0.2s'
                }}
              >
                {isSaved ? (
                  <>
                    <Check size={18} /> {T.savedToPortfolio}
                  </>
                ) : isSaving ? (
                  <>
                    <RotateCcw size={18} className="spin-animation" /> {T.savingPortfolio}
                  </>
                ) : (
                  <>
                    <Save size={18} /> {T.savePortfolioBtn}
                  </>
                )}
              </button>
            </div>
          )}

          {/* RIGHT COLUMN: Interactive Editor & Detailed Results Explorer */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Active Prompt Header Banner */}
            {activeTab === 'prompts' && activePrompt && (
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                padding: '1.25rem',
                border: '1px solid rgba(0,0,0,0.06)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <span style={{
                    backgroundColor: 'rgba(229, 169, 53, 0.12)',
                    color: '#b45309',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '6px'
                  }}>
                    {activePrompt.category}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {T.target}: {activePrompt.targetWords}
                  </span>
                </div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  {activePrompt.title}
                </h3>
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {activePrompt.instructions}
                </p>
                {activePrompt.keywords && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                    {activePrompt.keywords.map((kw) => (
                      <span key={kw} style={{
                        backgroundColor: 'rgba(0,0,0,0.04)',
                        color: 'var(--text-muted)',
                        fontSize: '0.72rem',
                        padding: '2px 8px',
                        borderRadius: '6px'
                      }}>
                        #{kw}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Free Writing Header input */}
            {activeTab === 'free' && (
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                padding: '1.25rem',
                border: '1px solid rgba(0,0,0,0.06)'
              }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                  {T.customPromptTitle}
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder={T.customTitlePlaceholder}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid rgba(0,0,0,0.1)',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            {/* Writing Textarea Editor */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              padding: '1.25rem',
              border: '1px solid rgba(0,0,0,0.06)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
            }}>
              <textarea
                value={writingContent}
                onChange={(e) => setWritingContent(e.target.value)}
                placeholder={T.writePlaceholder}
                rows={12}
                style={{
                  width: '100%',
                  border: 'none',
                  outline: 'none',
                  resize: 'vertical',
                  fontSize: '1rem',
                  lineHeight: 1.6,
                  fontFamily: "'Inter', system-ui, sans-serif",
                  color: 'var(--text-main)',
                  boxSizing: 'border-box',
                  minHeight: '220px'
                }}
              />

              {/* Bottom Live Metrics & Action Bar */}
              <div style={{
                borderTop: '1px solid rgba(0,0,0,0.06)',
                paddingTop: '1rem',
                marginTop: '0.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}>
                {/* Stats Pills */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: stats.words >= 20 ? 'var(--text-main)' : 'var(--text-muted)'
                  }}>
                    <strong>{stats.words}</strong> {T.wordCount}
                  </span>
                  <span style={{ color: 'rgba(0,0,0,0.2)' }}>•</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {stats.sentences} {T.sentences}
                  </span>
                  <span style={{ color: 'rgba(0,0,0,0.2)' }}>•</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Clock size={12} /> {stats.readTime} {T.estReadingTime}
                  </span>
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {writingContent && (
                    <button
                      onClick={() => setWritingContent('')}
                      style={{
                        padding: '8px 14px',
                        backgroundColor: 'transparent',
                        border: '1px solid rgba(0,0,0,0.1)',
                        borderRadius: '10px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        cursor: 'pointer'
                      }}
                    >
                      {T.clearBtn}
                    </button>
                  )}

                  <button
                    onClick={handleAssess}
                    disabled={isAssessing}
                    style={{
                      padding: '10px 22px',
                      background: 'linear-gradient(135deg, var(--primary) 0%, #b53ba7 100%)',
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      color: '#ffffff',
                      cursor: isAssessing ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(158, 40, 145, 0.25)',
                      opacity: isAssessing ? 0.7 : 1,
                      transition: 'all 0.2s'
                    }}
                  >
                    {isAssessing ? (
                      <>
                        <RotateCcw size={16} className="spin-animation" /> {T.assessing}
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} /> {T.assessBtn}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {assessError && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '8px 12px',
                  backgroundColor: '#fee2e2',
                  color: '#b91c1c',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <AlertCircle size={16} /> {assessError}
                </div>
              )}
            </div>

            {/* DETAILED RESULTS TABS & PANELS (when assessment is available) */}
            {assessment && (
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '20px',
                padding: '1.25rem',
                border: '1px solid rgba(0,0,0,0.06)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
              }}>
                {/* Result Explorer Sub-Tabs */}
                <div style={{
                  display: 'flex',
                  gap: '6px',
                  borderBottom: '1px solid rgba(0,0,0,0.06)',
                  paddingBottom: '0.75rem',
                  marginBottom: '1rem',
                  flexWrap: 'wrap'
                }}>
                  {[
                    { id: 'issues', label: T.tabIssues, count: assessment.issues?.length || 0 },
                    { id: 'vocab', label: T.tabVocab, count: assessment.vocabularyEnhancements?.length || 0 },
                    { id: 'rewrite', label: T.tabRewrite },
                    { id: 'tips', label: T.tabActionPlan }
                  ].map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => setResultSubTab(sub.id)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        backgroundColor: resultSubTab === sub.id ? 'rgba(158, 40, 145, 0.1)' : 'transparent',
                        color: resultSubTab === sub.id ? 'var(--primary)' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s'
                      }}
                    >
                      {sub.label}
                      {sub.count !== undefined && sub.count > 0 && (
                        <span style={{
                          backgroundColor: resultSubTab === sub.id ? 'var(--primary)' : 'rgba(0,0,0,0.1)',
                          color: resultSubTab === sub.id ? '#ffffff' : 'var(--text-muted)',
                          fontSize: '0.7rem',
                          padding: '1px 6px',
                          borderRadius: '10px'
                        }}>
                          {sub.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* SUB-PANEL 1: ISSUES */}
                {resultSubTab === 'issues' && (
                  <div>
                    {/* Category Filter for Issues */}
                    {assessment.issues && assessment.issues.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '1rem' }}>
                        {['ALL', 'grammar', 'spelling', 'punctuation', 'phrasing'].map((f) => (
                          <button
                            key={f}
                            onClick={() => setIssueFilter(f)}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              border: 'none',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              textTransform: 'capitalize',
                              backgroundColor: issueFilter === f ? 'var(--text-main)' : 'rgba(0,0,0,0.04)',
                              color: issueFilter === f ? '#ffffff' : 'var(--text-muted)'
                            }}
                          >
                            {f === 'ALL' ? T.filterAll : f}
                          </button>
                        ))}
                      </div>
                    )}

                    {filteredIssues.length === 0 ? (
                      <div style={{
                        padding: '2rem',
                        textAlign: 'center',
                        backgroundColor: 'rgba(16, 185, 129, 0.05)',
                        borderRadius: '12px',
                        border: '1px dashed #10b981'
                      }}>
                        <CheckCircle2 size={32} color="#10b981" style={{ marginBottom: '8px' }} />
                        <p style={{ margin: 0, fontWeight: 700, color: '#065f46', fontSize: '0.95rem' }}>
                          {T.noIssuesFound}
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {filteredIssues.map((issue, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: '1rem',
                              borderRadius: '12px',
                              backgroundColor: '#ffffff',
                              border: '1px solid rgba(0,0,0,0.07)',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <span style={{
                                backgroundColor: issue.type === 'grammar' ? '#fee2e2' : issue.type === 'spelling' ? '#fef3c7' : '#e0e7ff',
                                color: issue.type === 'grammar' ? '#b91c1c' : issue.type === 'spelling' ? '#b45309' : '#3730a3',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                textTransform: 'uppercase'
                              }}>
                                {issue.type || 'Error'}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                              <span style={{
                                textDecoration: 'line-through',
                                color: '#ef4444',
                                backgroundColor: '#fee2e2',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '0.88rem'
                              }}>
                                {issue.original}
                              </span>
                              <ArrowRight size={14} color="#6b7280" />
                              <span style={{
                                color: '#059669',
                                backgroundColor: '#d1fae5',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontWeight: 700,
                                fontSize: '0.88rem'
                              }}>
                                {issue.correction}
                              </span>
                            </div>

                            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                              <strong>{T.whyRule}</strong> {issue.explanation}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* SUB-PANEL 2: VOCABULARY UPGRADES */}
                {resultSubTab === 'vocab' && (
                  <div>
                    {(!assessment.vocabularyEnhancements || assessment.vocabularyEnhancements.length === 0) ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', margin: '2rem 0' }}>
                        No specific vocabulary upgrades needed for this piece!
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {assessment.vocabularyEnhancements.map((v, i) => (
                          <div
                            key={i}
                            style={{
                              padding: '1rem',
                              borderRadius: '12px',
                              backgroundColor: 'rgba(229, 169, 53, 0.04)',
                              border: '1px solid rgba(229, 169, 53, 0.2)'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                {T.originalText}:
                              </span>
                              <span style={{ backgroundColor: 'rgba(0,0,0,0.06)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
                                "{v.original}"
                              </span>
                            </div>

                            <div style={{ marginBottom: '6px' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#b45309' }}>
                                {T.betterAlternatives}
                              </span>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                                {(v.suggestions || []).map((sugg, si) => (
                                  <span
                                    key={si}
                                    style={{
                                      backgroundColor: '#ffffff',
                                      border: '1px solid rgba(229, 169, 53, 0.4)',
                                      color: '#92400e',
                                      padding: '3px 10px',
                                      borderRadius: '6px',
                                      fontSize: '0.82rem',
                                      fontWeight: 700
                                    }}
                                  >
                                    {sugg}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {v.context && (
                              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {v.context}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* SUB-PANEL 3: NATIVE REWRITE */}
                {resultSubTab === 'rewrite' && (
                  <div>
                    <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {T.nativeComparison}
                    </p>
                    <div style={{
                      backgroundColor: 'rgba(158, 40, 145, 0.03)',
                      borderRadius: '14px',
                      padding: '1.25rem',
                      border: '1px solid rgba(158, 40, 145, 0.15)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--primary)', fontWeight: 700, fontSize: '0.85rem' }}>
                        <Sparkles size={16} /> {T.nativeVersion}
                      </div>
                      <p style={{
                        margin: 0,
                        fontSize: '0.95rem',
                        lineHeight: 1.65,
                        color: 'var(--text-main)',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {assessment.improvedVersion || writingContent}
                      </p>
                    </div>
                  </div>
                )}

                {/* SUB-PANEL 4: ACTION PLAN & TIPS */}
                {resultSubTab === 'tips' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Strengths */}
                    {assessment.strengths && assessment.strengths.length > 0 && (
                      <div style={{
                        padding: '1rem',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(16, 185, 129, 0.05)',
                        border: '1px solid rgba(16, 185, 129, 0.2)'
                      }}>
                        <h5 style={{ margin: '0 0 8px 0', fontSize: '0.88rem', fontWeight: 800, color: '#065f46', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CheckCircle2 size={16} /> {T.keyStrengths}
                        </h5>
                        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#047857', lineHeight: 1.5 }}>
                          {assessment.strengths.map((s, idx) => (
                            <li key={idx} style={{ marginBottom: '4px' }}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Next Steps */}
                    {assessment.nextSteps && assessment.nextSteps.length > 0 && (
                      <div style={{
                        padding: '1rem',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(245, 158, 11, 0.05)',
                        border: '1px solid rgba(245, 158, 11, 0.2)'
                      }}>
                        <h5 style={{ margin: '0 0 8px 0', fontSize: '0.88rem', fontWeight: 800, color: '#92400e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <TrendingUp size={16} /> {T.growthAreas}
                        </h5>
                        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#b45309', lineHeight: 1.5 }}>
                          {assessment.nextSteps.map((step, idx) => (
                            <li key={idx} style={{ marginBottom: '4px' }}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB 3: STUDENT PORTFOLIO / SUBMISSION HISTORY --- */}
      {activeTab === 'portfolio' && (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {T.portfolioTitle}
            </h2>
            <button
              onClick={loadPortfolio}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid rgba(0,0,0,0.1)',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--text-muted)'
              }}
            >
              <RotateCcw size={14} /> Refresh
            </button>
          </div>

          {portfolioLoading ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', margin: '3rem 0' }}>Loading submissions...</p>
          ) : portfolio.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem 1.5rem',
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              border: '1px dashed rgba(0,0,0,0.1)'
            }}>
              <PenTool size={36} color="var(--primary)" style={{ opacity: 0.5, marginBottom: '12px' }} />
              <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                {T.portfolioEmpty}
              </h3>
              <button
                onClick={() => setActiveTab('prompts')}
                style={{
                  marginTop: '1rem',
                  padding: '8px 18px',
                  backgroundColor: 'var(--primary)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Start Writing
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {portfolio.map((item) => {
                const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                }) : 'Recent';

                return (
                  <div
                    key={item.id}
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '16px',
                      padding: '1.25rem',
                      border: '1px solid rgba(0,0,0,0.06)',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.02)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '1rem'
                    }}
                  >
                    <div style={{ flex: '1 1 300px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{
                          backgroundColor: 'rgba(158, 40, 145, 0.1)',
                          color: 'var(--primary)',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '6px'
                        }}>
                          {item.cefrLevel || 'B1'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {dateStr}
                        </span>
                        <span style={{ color: 'rgba(0,0,0,0.2)' }}>•</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {item.wordCount || 0} {T.wordsCounted}
                        </span>
                      </div>
                      <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        {item.promptTitle || 'Free Writing'}
                      </h4>
                      <p style={{
                        margin: 0,
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {item.text}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          fontSize: '1.5rem',
                          fontWeight: 900,
                          color: getScoreColor(item.overallScore || 0),
                          lineHeight: 1
                        }}>
                          {item.overallScore || 0}
                        </div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '2px' }}>
                          Score
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setWritingContent(item.text);
                          setAssessment(item.assessment);
                          setActiveTab('prompts');
                        }}
                        style={{
                          padding: '8px 14px',
                          backgroundColor: 'rgba(158, 40, 145, 0.08)',
                          color: 'var(--primary)',
                          border: 'none',
                          borderRadius: '10px',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Eye size={14} /> {T.viewReport}
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
  );
}
