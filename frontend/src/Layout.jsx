import React from 'react';
import { FileText, BarChart2, LogOut, Mic } from 'lucide-react';

// Amharic translation map for all UI navigation / experience strings
export const AM = {
  practice:          'ልምምድ',
  sessions:          'ክፍለ ጊዜዎች',
  progress:          'እድገት',
  logout:            'ውጣ',
  startNow:          'አሁን ጀምር',
  yourTurn:          'ተራህ ነው — አሁን ተናገር',
  aiSpeaking:        'AI እየተናገረ ነው…',
  thinking:          'እያሰበ ነው…',
  settingUp:         'እያዘጋጀ ነው…',
  recording:         'እየቀዳ ነው…',
  finishing:         'ክፍለ ጊዜ እያጠናቀቀ…',
  startConversation: 'ውይይት ጀምር',
  endEarly:          'ቀደም ብሎ አጠናቅቅ',
  practiceAgain:     'እንደገና ልምምድ',
  nextLesson:        'ቀጣይ ትምህርት',
  returnHome:        'ወደ ዋና ገጽ ተመለስ',
  viewDetails:       'ዝርዝር ውጤት',
  exitSession:       'ክፍለ ጊዜ ውጣ',
  passed:            'አለፉ! ✅',
  passedBadge:       'አለፈ',
  notYet:            'ገና አልተጠናቀቀም ❌',
  totalAnswers:      'ጠቅላላ መልሶች',
  overallScore:      'አጠቃላይ ውጤት',
  turnLimit:         'የዙር ገደብ',
  generalPractice:   'ጠቅላላ ልምምድ',
  noSessions:        'እስካሁን ምንም ክፍለ ጊዜ አልተጠናቀቀም',
  reviewSession:     'ክፍለ ጊዜ ይገምግሙ',
  backToHistory:     'ወደ ታሪክ ተመለስ',
  turnLimitReached:  'የዙር ገደብ ደርሷል',
  language:          'EN',
  languageAm:        'አማ',
  // Session result strings
  canAdvance:        'ወደ ቀጣይ ትምህርት ማለፍ ይቻላል',
  passRequirement:   'ለማለፍ ቢያንስ 60% ያስፈልጋል',
  summary:           'ያጠናቀቁት መልሶች ላይ የተመሰረተ ዳሰሳ ይኸው ነው።',
  niceResponse:      'ጥሩ ምላሽ።',
  tipGrammar:        'ሙሉ ዓረፍተ ነገር ይጠቀሙ፡ ርዕሰ ጉዳይ + ግስ + ነገር።',
  tipAccuracy:       'ጥያቄውን ቀጥታ ይመልሱና ዋና ዝርዝሮችን ያካትቱ።',
  resultDetails:     'የውጤት ዝርዝር',
  strongWork:        'በዚህ መለኪያ ጠንካራ አፈጻጸም አሳዩ።',
  partialCredit:     'ውጤቱ በሰጡት መልሶች ላይ የተመሰረተ ነው።',
  conversationReview:'የውይይት ግምገማ',
  answer:            'መልስ',
  strongAnswer:      'ጠንካራ መልስ',
  partlyCorrect:     'በከፊል ትክክል',
  needsImprovement:  'ማሻሻያ ያስፈልጋል',
  suggestion:        'ምክር',
  tryPrefix:         'ሞክር',
  issueLabel:        'ችግር',
  scoreEarned:       'የተገኘ ውጤት',
  scoreMissed:       'ያመለጠ ውጤት',
  quickTip:          'ፈጣን ምክር',
  nextMetric:        'ቀጣይ መለኪያ',
  unlocked:          'አዲስ ደረጃ ተከፍቷል!',
  mandatoryAssessment: 'አዲስ CEFR ደረጃ ደርሰዋል። አስፈላጊ ፈተናውን ያጠናቅቁ።',
  takeTest:          'CEFR ፈተና ይውሰዱ',
  close:             'ዝጋ',
  levelCompletePrompt: 'የአሁኑን CEFR ደረጃ አጠናቅቀዋል! አዲስ ደረጃዎን ለመወሰን ውጫዊ ፈተና ይውሰዱ።',
  practiceSession:   'ልምምድ ክፍለ ጊዜ',
  objective:         'ከ AI አጋርዎ ጋር ይነጋገሩ።',
  fastMode:          'ልምምድ ሁነታ',
  techInfo:          'ፈጣን ምላሽ ከ Groq ፣ Deepgram እና Cartesia ጋር።',
  wakingUp:          'አገልጋይ እያነቃ ነው… (50 ሰከንድ ሊወስድ ይችላል)',
  aiPartner:         'AI አጋር',
  you:               'እርስዎ',
  error:             'ስህተት',
  typeMessage:       'መልዕክትዎን ይጻፉ…',
  selectLevel:       'አዲስ CEFR ደረጃ ይምረጡ:',
  choose:            'ምረጡ',
  updateLevel:       'ደረጃ አዘምን',
  pleaseSpeakEnglish:'እባክዎ ለዚህ ትምህርት በእንግሊዝኛ ይናገሩ።',
  goodMorning:       'እንደምን አደሩ',
  goodAfternoon:     'እንደምን ዋሉ',
  goodEvening:       'እንደምን አመሹ',
  continueJourney:   'የእንግሊዝኛ ትምህርትዎን ይቀጥሉ።',
  dayStreak:         'ተከታታይ ቀናት',
  sessionsCompleted: 'የተጠናቀቁ ክፍለ ጊዜዎች',
  to:                'ወደ',
  cefrProgress:      'የCEFR እድገት',
  activeMission:     'ንቁ ትምህርት',
  learningPathway:   'የመማሪያ መንገድ',
  loadingRoadmap:    'የመማሪያ መንገዱን በመጫን ላይ…',
  vocabularyWords:   'ቃላት',
  current:           'የአሁኑ',
  // Login page translations
  loginMasterTitle:  'የእንግሊዝኛ መናገርዎን ያሻሽሉ',
  loginMasterDesc:   'ከእኛ የ AI አጋር ጋር ይለማመዱ እና ቅልጥፍና እና ሰዋስው ላይ ፈጣን ግብረመልስ ያግኙ።',
  loginFeat1:        'በይነተገናኝ የ AI ውይይቶች',
  loginFeat2:        'የቀጥታ ንግግር ወደ ጽሑፍ መቀየር',
  loginFeat3:        'በCEFR ላይ የተመሰረተ የደረጃ ክትትል',
  loginFeat4:        'ዝርዝር የስራ አፈጻጸም ግብረመልስ',
  loginWelcome:      'እንኳን ደህና መጡ',
  loginWelcomeDesc:  'ለመቀጠል እባክዎ የተማሪ መለያዎን ያስገቡ',
  studentIdLabel:    'የተማሪ መለያ',
  studentIdPlaceholder: 'ምሳሌ student001',
  authenticating:    'በማጣራት ላይ…',
  signInBtn:         'ግባ',
  loginNeedHelp:     'እርዳታ ይፈልጋሉ? አስተዳዳሪዎን ያነጋግሩ።',
};

export const EN = {
  practice:          'Practice',
  sessions:          'Sessions',
  progress:          'Progress',
  logout:            'Logout',
  startNow:          'Start Now',
  yourTurn:          'Your Turn (Speak Now)',
  aiSpeaking:        'AI is speaking…',
  thinking:          'Thinking…',
  settingUp:         'Setting up…',
  recording:         'Recording',
  finishing:         'Finishing session…',
  startConversation: 'Start Conversation',
  endEarly:          'End Early',
  practiceAgain:     'Practice Again',
  nextLesson:        'Next Lesson',
  returnHome:        'Return to Dashboard',
  viewDetails:       'View Result Details',
  exitSession:       'Exit Session',
  passed:            'You Passed! ✅',
  passedBadge:       'Passed',
  notYet:            'Not Yet Complete ❌',
  totalAnswers:      'Total answers',
  overallScore:      'Overall Score',
  turnLimit:         'Turn Limit',
  generalPractice:   'General Practice',
  noSessions:        "You haven't completed any sessions yet.",
  reviewSession:     'Review Session',
  backToHistory:     'Back to History',
  turnLimitReached:  'Turn limit reached',
  language:          'አማ',
  languageAm:        'EN',
  // Session result strings
  canAdvance:        'You can advance to the next lesson',
  passRequirement:   'A score of 60% or above is required to pass',
  summary:           'Here is your assessment summary based on the answers you completed.',
  niceResponse:      'Nice clear response.',
  tipGrammar:        'Use full basic patterns: subject + verb + object.',
  tipAccuracy:       'Answer the question directly and include the key details.',
  resultDetails:     'Result details',
  strongWork:        'Strong work across the answers for this metric.',
  partialCredit:     'This score is based on your answers, with partial credit for understandable responses.',
  conversationReview:'Conversation Review',
  answer:            'Answer',
  strongAnswer:      'Strong answer',
  partlyCorrect:     'Partly correct',
  needsImprovement:  'Needs improvement',
  suggestion:        'Suggestion',
  tryPrefix:         'Try',
  issueLabel:        'Issue',
  scoreEarned:       'Score earned',
  scoreMissed:       'Score missed',
  quickTip:          'Quick Tip',
  nextMetric:        'Next Metric',
  unlocked:          'New Level Unlocked!',
  mandatoryAssessment: 'You have reached a new CEFR level. Please complete the mandatory assessment.',
  takeTest:          'Take the CEFR Test',
  close:             'Close',
  levelCompletePrompt: 'You have completed the current CEFR level! Please take the external CEFR test to determine your new level.',
  practiceSession:   'Practice Session',
  objective:         'Talk naturally with your AI partner.',
  fastMode:          'Ready to Practice',
  techInfo:          'Experience sub-second response times powered by Groq, Deepgram, and Cartesia.',
  wakingUp:          'Waking up server… (can take 50s)',
  aiPartner:         'AI Partner',
  you:               'You',
  error:             'Realtime STT failed',
  typeMessage:       'Type your message here…',
  selectLevel:       'Select your new CEFR level:',
  choose:            'Choose',
  updateLevel:       'Update Level',
  pleaseSpeakEnglish:'Please respond in English for this lesson.',
  goodMorning:       'Good morning',
  goodAfternoon:     'Good afternoon',
  goodEvening:       'Good evening',
  continueJourney:   "Let's continue your journey in English.",
  dayStreak:         'Day Streak',
  sessionsCompleted: 'Sessions Completed',
  to:                'to',
  cefrProgress:      'CEFR Progress',
  activeMission:     'Active Mission',
  learningPathway:   'Learning Pathway',
  loadingRoadmap:    'Loading roadmap...',
  vocabularyWords:   'vocabulary words',
  current:           'Current',
  // Login page translations
  loginMasterTitle:  'Master Your English Speaking',
  loginMasterDesc:   'Practice with our AI-powered partner and get instant feedback on your fluency and grammar.',
  loginFeat1:        'Interactive AI Conversations',
  loginFeat2:        'Real-time Speech Transcription',
  loginFeat3:        'CEFR-based Level Tracking',
  loginFeat4:        'Detailed Performance Feedback',
  loginWelcome:      'Welcome Back',
  loginWelcomeDesc:  'Please enter your Student ID to continue',
  studentIdLabel:    'Student ID',
  studentIdPlaceholder: 'e.g. student001',
  authenticating:    'Authenticating...',
  signInBtn:         'Sign In',
  loginNeedHelp:     'Need help? Contact your administrator.',
};

function Layout({ student, currentView, setCurrentView, onLogout, amharic, setAmharic, children }) {
  const T = amharic ? AM : EN;

  const navItems = [
    { view: 'DASHBOARD', label: T.practice,  Icon: Mic },
    { view: 'HISTORY',   label: T.sessions,  Icon: FileText },
    { view: 'PROGRESS',  label: T.progress,  Icon: BarChart2 },
  ];

  return (
    <div className="layout-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-container" style={{ width: '100%' }}>
            <div className="logo-icon">
              <span style={{ position: 'relative', top: '-1px' }}>Y</span>
            </div>
            <div className="logo-text">
              <span className="logo-title">Yimaru</span>
              <span className="logo-subtitle">Academy</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(({ view, label, Icon }) => (
            <button
              key={view}
              className={`nav-item ${currentView === view || (view === 'DASHBOARD' && currentView === 'SESSION') ? 'active' : ''}`}
              onClick={() => setCurrentView(view)}
            >
              <Icon size={20} className="nav-icon" />
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile-bottom">
            <img src="/alice_avatar.png" alt="User Avatar" className="user-avatar" />
            <div className="user-info-bottom">
              <span className="user-name-bottom">{student.name}</span>
              <span className="user-level-bottom">{student.cefrLevel} Level</span>
            </div>
          </div>
          <button className="nav-item logout-btn" onClick={onLogout}>
            <LogOut size={20} className="nav-icon" />
            {T.logout}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Language toggle button — floating absolute top right */}
        <div style={{ position: 'absolute', top: '2.5rem', right: '4rem', zIndex: 100 }}>
          <button
            onClick={() => setAmharic(!amharic)}
            title={amharic ? 'Switch to English' : 'ወደ አማርኛ ቀይር'}
            style={{
              background: amharic ? '#9E2891' : '#f1f5f9',
              color:      amharic ? '#ffffff' : '#64748b',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '0.85rem',
              fontWeight: '700',
              cursor: 'pointer',
              letterSpacing: '0.05em',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              transition: 'all 0.2s',
            }}
          >
            {amharic ? AM.languageAm : EN.language}
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}

export default Layout;
