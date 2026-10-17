import { useState, useEffect, useRef, useMemo } from 'react';
import { sendChatMessage, getAiStatus } from '../../api/client';
import { formatCampusDate, parseCampusDate } from '../../utils/dateUtils';
import styles from './FloatingAiChat.module.css';

/**
 * Lightweight safe markdown formatter for assistant responses.
 * Parses headers, bold, bullet lists, inline code, and paragraphs.
 */
function FormattedMessage({ text }) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let currentList = [];
  let keyIndex = 0;

  function flushList() {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`list-${keyIndex++}`}>
          {currentList.map((item, idx) => (
            <li key={idx}>{parseInline(item)}</li>
          ))}
        </ul>
      );
      currentList = [];
    }
  }

  function parseInline(str) {
    // Regex matches **bold**, *italic*, and `code`
    const parts = [];
    let remaining = str;
    let inlineIdx = 0;

    while (remaining.length > 0) {
      // Bold match: **text**
      const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
      // Code match: `code`
      const codeMatch = remaining.match(/`([^`]+)`/);
      // Italic match: *text*
      const italicMatch = remaining.match(/\*([^*]+)\*/);

      // Find earliest match
      const matches = [
        boldMatch ? { type: 'bold', index: boldMatch.index, len: boldMatch[0].length, content: boldMatch[1] } : null,
        codeMatch ? { type: 'code', index: codeMatch.index, len: codeMatch[0].length, content: codeMatch[1] } : null,
        italicMatch && (!boldMatch || italicMatch.index !== boldMatch.index)
          ? { type: 'italic', index: italicMatch.index, len: italicMatch[0].length, content: italicMatch[1] }
          : null,
      ].filter(Boolean);

      if (matches.length === 0) {
        parts.push(remaining);
        break;
      }

      matches.sort((a, b) => a.index - b.index);
      const first = matches[0];

      if (first.index > 0) {
        parts.push(remaining.substring(0, first.index));
      }

      if (first.type === 'bold') {
        parts.push(<strong key={`b-${inlineIdx++}`}>{first.content}</strong>);
      } else if (first.type === 'code') {
        parts.push(<code key={`c-${inlineIdx++}`}>{first.content}</code>);
      } else if (first.type === 'italic') {
        parts.push(<em key={`i-${inlineIdx++}`}>{first.content}</em>);
      }

      remaining = remaining.substring(first.index + first.len);
    }

    return parts;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) {
      flushList();
      continue;
    }

    // Header 3 or 4: ### Header
    if (line.startsWith('### ')) {
      flushList();
      elements.push(<h3 key={`h3-${keyIndex++}`}>{parseInline(line.replace('### ', ''))}</h3>);
    } else if (line.startsWith('#### ')) {
      flushList();
      elements.push(<h4 key={`h4-${keyIndex++}`}>{parseInline(line.replace('#### ', ''))}</h4>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      currentList.push(line.substring(2));
    } else {
      flushList();
      elements.push(<p key={`p-${keyIndex++}`}>{parseInline(line)}</p>);
    }
  }

  flushList();

  return <div className={styles.markdownContent}>{elements}</div>;
}

export default function FloatingAiChat({ activePage = 'dashboard', reportingDate = '2026-10-14' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);

  const reportingDateObj = useMemo(() => parseCampusDate(reportingDate) || new Date(), [reportingDate]);
  const reportingDateLabel = useMemo(() => formatCampusDate(reportingDateObj, {
    weekday: 'long',
    includeYear: true,
  }), [reportingDateObj]);

  const initialWelcomeMessage = useMemo(() => ({
    id: 'welcome-0',
    role: 'assistant',
    text: `### Welcome to Campus AI
I am grounded directly in live **MongoDB Atlas** telemetry and digital twin records for the campus.

**Operational Reporting Date:** ${reportingDateLabel}

You can ask me about:
- **Active Energy & Solar Yield** (kW demand, kWh totals, rooftop PV offset)
- **Campus Headcount & Utilization** (monitored rooms, capacity, high-density alerts)
- **Operational Incidents & Alarms** (severity breakdown, open alerts)
- **Academic Timetables & Sections** (lecture schedules, cohort distributions)
- **Facility Maintenance & Congestion** (open work orders, pedestrian flow)`,
    domain: 'Executive Campus Overview',
    sources: [{ name: 'MongoDB Atlas Digital Twin', collection: 'Telemetry Clusters' }],
    reportingPeriod: reportingDateLabel,
    suggestedFollowUps: [
      'What is our current energy demand and solar output?',
      'Show campus headcount and overall room utilization.',
      'Are there any critical operational alerts right now?',
    ],
    timestamp: 'Live Baseline',
  }), [reportingDateLabel]);

  const [messages, setMessages] = useState(() => {
    try {
      const stored = sessionStorage.getItem('unitwin_ai_chat_history');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Ignore storage read error
    }
    return [initialWelcomeMessage];
  });

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Sync messages to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem('unitwin_ai_chat_history', JSON.stringify(messages));
    } catch {
      // Ignore storage write error
    }
  }, [messages]);

  // Load AI configuration status once
  useEffect(() => {
    let isMounted = true;
    async function loadStatus() {
      try {
        const status = await getAiStatus();
        if (isMounted && status) {
          setAiStatus(status);
        }
      } catch {
        // Fallback silently
      }
    }
    loadStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    if (isOpen && !isMinimized && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized, isLoading]);

  // Focus input field when opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, isMinimized]);

  // Keyboard shortcut ESC to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSendMessage = async (queryText) => {
    const textToSend = (queryText || inputValue).trim();
    if (!textToSend || isLoading) return;

    const userMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setIsLoading(true);

    try {
      const payload = {
        message: textToSend,
        pageContext: activePage,
        asOfDate: reportingDate ? `${reportingDate}T23:59:59.999+05:30` : undefined,
        history: newMessages.slice(-6).map((m) => ({
          role: m.role,
          text: m.text,
        })),
      };

      const res = await sendChatMessage(payload);

      if (res && res.success) {
        const assistantMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          text: res.answer,
          domain: res.domain,
          sources: res.sources,
          isGeminiPowered: res.isGeminiPowered,
          model: res.model,
          notice: res.notice,
          reportingPeriod: res.reportingPeriod,
          actualCutoffApplied: res.actualCutoffApplied,
          temporalScope: res.temporalScope,
          suggestedFollowUps: res.suggestedFollowUps || [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        const errorMessage = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text: `⚠️ **Unable to process query**: ${res?.error || 'Service temporarily unreachable.'}`,
          sources: [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (err) {
      const errorMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: `⚠️ **Connection Error**: Could not connect to Campus AI backend (${err.message}). Please verify the backend API server is running on port 5001.`,
        sources: [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([initialWelcomeMessage]);
    try {
      sessionStorage.removeItem('unitwin_ai_chat_history');
    } catch {
      // Ignore
    }
  };

  // Quick contextual starter suggestions based on active page
  const getContextualPrompts = () => {
    switch (activePage) {
      case 'energy':
        return [
          { icon: '⚡', text: 'What is our current solar yield vs grid power import?' },
          { icon: '🔌', text: 'Which campus appliances consume the highest wattage?' },
          { icon: '📊', text: 'Summarize total energy consumption and solar generation.' },
        ];
      case 'occupancy':
        return [
          { icon: '👥', text: 'Which campus rooms currently exceed 70% capacity?' },
          { icon: '🏫', text: 'Show total campus headcount and overall utilization rate.' },
          { icon: '🚪', text: 'What is the current occupancy status of Room C-101?' },
        ];
      case 'alerts':
        return [
          { icon: '🚨', text: 'How many High and Critical alerts are currently active?' },
          { icon: '⚡', text: 'Show active alerts for solar generation and power load.' },
          { icon: '📋', text: 'List top operational tripwires requiring facility intervention.' },
        ];
      case 'maintenance':
        return [
          { icon: '🔧', text: 'How many maintenance work orders are Open vs In Progress?' },
          { icon: '⚠️', text: 'List all High-priority open maintenance work orders.' },
          { icon: '❄️', text: 'What is the status of campus HVAC and plumbing maintenance?' },
        ];
      case 'congestion':
        return [
          { icon: '🚶', text: 'Which campus areas currently have High congestion levels?' },
          { icon: '⏱️', text: 'What are the estimated queue wait times at campus bottlenecks?' },
          { icon: '🧭', text: 'What crowd management actions are currently recommended?' },
        ];
      case 'analytics':
        return [
          { icon: '📅', text: 'Show master timetable slot distribution across weekdays.' },
          { icon: '🎓', text: 'How many academic sections are registered under CSE vs ECE?' },
          { icon: '🏢', text: 'What is the distribution of cataloged rooms across campus blocks?' },
        ];
      case 'dashboard':
      default:
        return [
          { icon: '🏛️', text: 'Provide an executive summary of current campus operations.' },
          { icon: '⚡', text: 'What is our live energy demand and rooftop solar output?' },
          { icon: '👥', text: 'Show total campus headcount and monitored room utilization.' },
        ];
    }
  };

  return (
    <>
      {/* Floating launcher trigger button */}
      {!isOpen && (
        <button
          className={styles.floatingLauncher}
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          title="Campus AI — Ask about your campus"
          aria-label="Open Campus AI Assistant — Ask about your campus"
        >
          <div className={styles.launcherIconWrap} aria-hidden="true">
            <svg
              className={styles.launcherIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
              <path d="M5 3v4" />
              <path d="M19 17v4" />
              <path d="M3 5h4" />
              <path d="M17 19h4" />
            </svg>
          </div>
          <div className={styles.launcherText}>
            <span className={styles.launcherTitle}>Campus AI</span>
            <span className={styles.launcherSubtitle}>Ask about your campus</span>
          </div>
        </button>
      )}

      {/* Floating Chat Modal Panel */}
      {isOpen && (
        <aside
          className={`${styles.chatContainer} ${isMinimized ? styles.chatContainerMinimized : ''}`}
          aria-label="Campus AI Assistant Dialog"
        >
          {/* Header */}
          <div className={styles.chatHeader}>
            <div className={styles.headerLeft}>
              <div className={styles.botAvatar}>
                <svg
                  className={styles.botAvatarIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
                  <rect x="4" y="8" width="16" height="12" rx="3" />
                  <path d="M9 13v2" />
                  <path d="M15 13v2" />
                </svg>
              </div>
              <div className={styles.headerTitles}>
                <div className={styles.headerTitleRow}>
                  <span className={styles.headerTitle}>Campus AI</span>
                  <span className={styles.aiIndicator}>
                    <span className={styles.aiIndicatorDot} />
                    {aiStatus?.geminiConfigured ? 'Gemini 2.5' : 'Atlas Grounded'}
                  </span>
                </div>
                <span className={styles.headerSubtitle}>
                  Smart Operations · {formatCampusDate(reportingDateObj, { month: 'short', day: 'numeric', includeYear: true })}
                </span>
              </div>
            </div>

            <div className={styles.headerActions}>
              {/* Minimize / Maximize */}
              <button
                className={styles.headerBtn}
                onClick={() => setIsMinimized((prev) => !prev)}
                title={isMinimized ? 'Expand window' : 'Minimize window'}
                aria-label={isMinimized ? 'Expand window' : 'Minimize window'}
              >
                {isMinimized ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                )}
              </button>

              {/* Close */}
              <button
                className={styles.headerBtn}
                onClick={() => setIsOpen(false)}
                title="Close chat"
                aria-label="Close chat"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Expanded Content View */}
          {!isMinimized && (
            <>
              {/* Context Banner */}
              <div className={styles.contextBanner}>
                <span className={styles.contextTag}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  Page Context: {activePage.charAt(0).toUpperCase() + activePage.slice(1)}
                </span>
                <button
                  className={styles.contextClear}
                  onClick={handleClearHistory}
                  title="Clear conversation history"
                >
                  Clear History
                </button>
              </div>

              {/* Message Feed */}
              <div className={styles.messagesArea}>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`${styles.messageRow} ${
                      msg.role === 'user' ? styles.messageRowUser : styles.messageRowAssistant
                    }`}
                  >
                    <div className={msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant}>
                      {msg.role === 'user' ? (
                        <div>{msg.text}</div>
                      ) : (
                        <FormattedMessage text={msg.text} />
                      )}

                      {/* Assistant Provenance & Metadata */}
                      {msg.role === 'assistant' && (
                        <div className={styles.provenanceBox}>
                          {msg.reportingPeriod && (
                            <span className={styles.provenanceTime} title={`Cutoff Applied: ${msg.actualCutoffApplied || ''}`}>
                              📅 As of {msg.reportingPeriod}
                            </span>
                          )}
                          {msg.sources && msg.sources.map((s, idx) => (
                            <span key={idx} className={styles.provenancePill} title={`Collection: ${s.collection}`}>
                              🗄️ {s.name || s.collection}
                            </span>
                          ))}
                          {msg.isGeminiPowered ? (
                            <span className={`${styles.provenancePill} ${styles.provenanceGemini}`}>
                              ✨ Gemini Synthesized
                            </span>
                          ) : (
                            <span className={`${styles.provenancePill} ${styles.provenanceFallback}`}>
                              ⚡ Atlas Telemetry
                            </span>
                          )}
                        </div>
                      )}

                      {/* Follow-up suggestions */}
                      {msg.role === 'assistant' &&
                        msg.suggestedFollowUps &&
                        msg.suggestedFollowUps.length > 0 && (
                          <div className={styles.followUpsContainer}>
                            <span className={styles.followUpsTitle}>Suggested Inquiries</span>
                            {msg.suggestedFollowUps.map((fu, idx) => (
                              <button
                                key={idx}
                                className={styles.followUpChip}
                                onClick={() => handleSendMessage(fu)}
                                disabled={isLoading}
                              >
                                ↳ {fu}
                              </button>
                            ))}
                          </div>
                        )}
                    </div>
                    {msg.timestamp && <span className={styles.messageTime}>{msg.timestamp}</span>}
                  </div>
                ))}

                {/* Loading state indicator */}
                {isLoading && (
                  <div className={`${styles.messageRow} ${styles.messageRowAssistant}`}>
                    <div className={styles.loadingBubble}>
                      <div className={styles.typingDots}>
                        <span className={styles.dot} />
                        <span className={styles.dot} />
                        <span className={styles.dot} />
                      </div>
                      <span>Querying MongoDB Atlas telemetry...</span>
                    </div>
                  </div>
                )}

                {/* Starter Chips Grid (Show when only initial welcome message is present) */}
                {messages.length === 1 && !isLoading && (
                  <div className={styles.starterChipsGrid}>
                    <span className={styles.followUpsTitle}>
                      Quick Inquiries ({activePage.toUpperCase()})
                    </span>
                    {getContextualPrompts().map((p, idx) => (
                      <button
                        key={idx}
                        className={styles.starterChip}
                        onClick={() => handleSendMessage(p.text)}
                      >
                        <span className={styles.starterChipIcon}>{p.icon}</span>
                        <span>{p.text}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Form */}
              <div className={styles.chatInputArea}>
                <form
                  className={styles.inputForm}
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                >
                  <input
                    ref={inputRef}
                    className={styles.chatInput}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={`Ask about ${activePage} or campus telemetry...`}
                    disabled={isLoading}
                    maxLength={1500}
                  />
                  <button
                    type="submit"
                    className={styles.sendButton}
                    disabled={!inputValue.trim() || isLoading}
                    title="Send inquiry"
                    aria-label="Send inquiry"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </form>
                <div className={styles.inputFooterText}>
                  <span>Grounded strictly in MongoDB Atlas campus datasets</span>
                  <span>•</span>
                  <span>Enter to send</span>
                </div>
              </div>
            </>
          )}
        </aside>
      )}
    </>
  );
}
