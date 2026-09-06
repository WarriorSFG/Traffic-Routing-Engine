import React, { useState, useEffect, useMemo, useRef } from 'react';
import { marked } from 'marked';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { API_BASE } from '../config';

const bookIcons = {
  search: (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  book: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
};

// Custom Markdown Renderer that renders LaTeX equations via KaTeX
function renderMathMarkdown(markdownText) {
  if (!markdownText) return '';

  // 1. Process display math: $$...$$
  let processed = markdownText.replace(/\$\$([\s\S]+?)\$\$/g, (match, expr) => {
    try {
      return `<div class="katex-display-container">${katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false })}</div>`;
    } catch (_err) {
      return `<pre class="katex-error">${expr}</pre>`;
    }
  });

  // 2. Process inline math: $...$ (avoiding double $)
  processed = processed.replace(/(^|[^$])\$([^$\n]+?)\$(?!\$)/g, (match, prefix, expr) => {
    try {
      return `${prefix}<span class="katex-inline">${katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false })}</span>`;
    } catch (_err) {
      return `${prefix}<code>${expr}</code>`;
    }
  });

  // 3. Render markdown through marked
  marked.setOptions({
    gfm: true,
    breaks: false
  });

  return marked.parse(processed);
}

export default function ReferenceBookView() {
  const [bookData, setBookData] = useState(null);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showGlossary, setShowGlossary] = useState(false);
  const contentRef = useRef(null);

  // Fetch reference book data from API
  useEffect(() => {
    async function fetchReference() {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/reference`);
        const json = await res.json();
        if (json.success) {
          setBookData(json.data);
        }
      } catch (err) {
        console.error('Failed to load reference book:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchReference();
  }, []);

  const chapters = bookData?.chapters || [];

  // Filter chapters by search query
  const filteredChapters = useMemo(() => {
    if (!searchQuery.trim()) return chapters;
    const q = searchQuery.toLowerCase();
    return chapters.filter(
      (ch) => ch.title.toLowerCase().includes(q) || (ch.content && ch.content.toLowerCase().includes(q))
    );
  }, [chapters, searchQuery]);

  // Current active chapter
  const currentChapter = chapters[activeChapterIndex] || chapters[0];

  // Render HTML content with KaTeX
  const renderedHtml = useMemo(() => {
    if (!currentChapter) return '';
    return renderMathMarkdown(currentChapter.content || '');
  }, [currentChapter]);

  // Scroll to top when chapter changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activeChapterIndex]);

  // Glossary items extracted from Appendix A
  const glossaryItems = useMemo(() => {
    const appendix = chapters.find((c) => c.title.toLowerCase().includes('appendix a') || c.title.toLowerCase().includes('symbol glossary'));
    if (!appendix) return [];
    const lines = (appendix.content || '').split('\n');
    const items = [];
    for (const line of lines) {
      if (line.includes('|') && !line.includes('---') && !line.includes('Symbol')) {
        const parts = line.split('|').map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          items.push({ symbol: parts[0], meaning: parts[1] });
        }
      }
    }
    return items;
  }, [chapters]);

  if (loading) {
    return (
      <div className="book-loading-state">
        <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
        <h3 style={{ color: 'var(--text-main)', marginTop: 16 }}>Loading The Mathematical Reference...</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Preparing derivations and KaTeX equations</p>
      </div>
    );
  }

  return (
    <div className="reference-book-wrapper">
      {/* 1. Left Book Navigation Sidebar */}
      <aside className="book-sidebar">
        <div className="book-sidebar-header">
          <div className="book-badge">DIGITAL HANDBOOK</div>
          <h3 className="book-sidebar-title">Mathematical Reference</h3>
          <p className="book-sidebar-meta">SIH 2026 &bull; Problem 26137 &bull; {chapters.length} Chapters</p>
        </div>

        {/* Chapter Search Bar */}
        <div className="book-search-box">
          <span className="search-icon" style={{ display: 'flex', color: 'var(--text-muted)' }}>{bookIcons.search}</span>
          <input
            type="text"
            className="book-search-input"
            placeholder="Search equations, topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>&times;</button>
          )}
        </div>

        {/* Chapter List */}
        <nav className="book-toc-list">
          {filteredChapters.map((ch) => {
            const originalIndex = chapters.findIndex((c) => c.id === ch.id);
            const isActive = originalIndex === activeChapterIndex;
            return (
              <button
                key={ch.id}
                className={`toc-item ${isActive ? 'active' : ''}`}
                onClick={() => setActiveChapterIndex(originalIndex)}
              >
                <span className="toc-number">{originalIndex === 0 ? 'Intro' : originalIndex}</span>
                <span className="toc-title">{ch.title}</span>
                {isActive && <span className="toc-active-indicator" />}
              </button>
            );
          })}
        </nav>

        {/* Floating Quick Glossary Pill */}
        <div className="book-sidebar-footer">
          <button
            className="btn btn-secondary glossary-trigger-btn"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onClick={() => setShowGlossary(true)}
          >
            {bookIcons.book}
            <span>Symbol Glossary ({glossaryItems.length || 20})</span>
          </button>
        </div>
      </aside>

      {/* 2. Main Book Reading Pane */}
      <main className="book-main-pane" ref={contentRef}>
        {currentChapter ? (
          <article className="book-article">
            {/* Chapter Header */}
            <header className="article-header">
              <div className="article-chapter-meta">
                <span className="chapter-tag">
                  {activeChapterIndex === 0 ? 'OVERVIEW' : `CHAPTER ${activeChapterIndex}`}
                </span>
                <span className="reading-time">
                  Estimated read: {Math.max(1, Math.round((currentChapter.content?.length || 500) / 1200))} min
                </span>
              </div>
              <h1 className="article-title">{currentChapter.title}</h1>
              <div className="article-divider" />
            </header>

            {/* Chapter Content with Rendered KaTeX Math */}
            <div
              className="article-body math-rendered-content"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />

            {/* Bottom Chapter Pagination Footer */}
            <footer className="article-footer">
              <div className="pagination-buttons">
                {activeChapterIndex > 0 ? (
                  <button
                    className="btn btn-ghost pagination-btn"
                    onClick={() => setActiveChapterIndex(activeChapterIndex - 1)}
                  >
                    &larr; Previous: {chapters[activeChapterIndex - 1]?.title.slice(0, 28)}...
                  </button>
                ) : <div />}

                {activeChapterIndex < chapters.length - 1 && (
                  <button
                    className="btn btn-primary pagination-btn"
                    onClick={() => setActiveChapterIndex(activeChapterIndex + 1)}
                  >
                    Next: {chapters[activeChapterIndex + 1]?.title.slice(0, 28)}... &rarr;
                  </button>
                )}
              </div>
            </footer>
          </article>
        ) : (
          <div className="no-chapter-selected">
            <h3>No Chapter Selected</h3>
            <p>Please select a chapter from the table of contents.</p>
          </div>
        )}
      </main>

      {/* 3. Slide-out Symbol Glossary Drawer */}
      {showGlossary && (
        <div className="glossary-drawer-overlay" onClick={() => setShowGlossary(false)}>
          <div className="glossary-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="glossary-header">
              <div>
                <h3 style={{ color: 'var(--text-main)', fontSize: '1.15rem', fontWeight: 600 }}>
                  Mathematical Symbol Glossary
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 2 }}>
                  Quick reference from Appendix A of the Reference Handbook.
                </p>
              </div>
              <button className="btn-close-drawer" onClick={() => setShowGlossary(false)}>
                {bookIcons.close}
              </button>
            </div>

            <div className="glossary-content">
              <table className="glossary-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Definition & Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  {glossaryItems.length > 0 ? (
                    glossaryItems.map((item, idx) => (
                      <tr key={`gloss-${idx}`}>
                        <td className="glossary-sym" dangerouslySetInnerHTML={{ __html: renderMathMarkdown(item.symbol) }} />
                        <td className="glossary-desc">{item.meaning}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
                        Symbols are documented in Appendix A.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
