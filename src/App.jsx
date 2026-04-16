import React, { useState, useRef, useEffect } from 'react';
import {
  Search, Loader2, Info, ChevronDown, ChevronUp, X,
  ArrowUpRight, MapPin, SlidersHorizontal, Cpu, Sparkles,
} from 'lucide-react';
import { findMatches } from './matcher';
import { products } from './products';
import { getEmbeddingPipeline, productToText, embedText } from './embeddings';

// ── Static data ────────────────────────────────────────────────────────────
const categories     = ['All', ...new Set(products.map(p => p.category))];
const certifications = ['All', ...new Set(products.map(p => p.certification).filter(c => c !== 'None'))];

const domainSuggestions = [
  '6mm tempered glass for office partitions',
  '8mm clear toughened glass for balcony railings',
  '10mm heavy duty glass for shop fronts',
  '12mm acoustic glass for residential windows',
  'Double glazed unit for energy efficient facades',
  'Blue tinted UV glass for commercial building facade',
  'Frosted glass for bathroom shower enclosure',
  'Laminated safety glass for high wind applications',
  'Low-E coated insulated glass for cold climates',
  'Mirror glass for interior design project',
];

const MARQUEE_ITEMS = [
  'Float Glass', 'Tempered Glass', 'Laminated Safety Glass',
  'Insulated Glass Unit', 'Mirror Glass', 'Aluminium Hardware',
  'IS 2553', 'Low-E Coating', 'UV Protection', 'EN 12150',
  'Polished Edge', 'Frosted', 'Saint-Gobain', 'AIS Glass',
];

const SAMPLE_QUERIES = [
  '6mm tempered glass for office partitions, polished edges, clear',
  'Acoustic laminated glass, UV protection, high thickness',
  'Blue tinted facade glass for commercial building',
];

// ── Helpers ─────────────────────────────────────────────────────────────────
const getMatchType = (score, reason) => {
  if (score > 85) return 'Best Overall';
  const r = reason.toLowerCase();
  if (r.includes('price') || r.includes('budget') || r.includes('cost') || r.includes('affordable')) return 'Budget Match';
  if (r.includes('use case') || r.includes('application') || r.includes('office') || r.includes('building') || r.includes('home')) return 'Use Case Match';
  return 'Spec Match';
};

const MATCH_TYPE_CHIP = {
  'Best Overall':  'chip chip-gold',
  'Budget Match':  'chip chip-green',
  'Use Case Match':'chip chip-blue',
  'Spec Match':    'chip chip-slate',
};

const scoreColor = s => s >= 75 ? '#4ade80' : s >= 50 ? '#fbbf24' : '#f87171';
const scoreBg    = s => s >= 75
  ? 'linear-gradient(90deg,#22c55e88,#4ade80)'
  : s >= 50
  ? 'linear-gradient(90deg,#f59e0b88,#fbbf24)'
  : 'linear-gradient(90deg,#ef444488,#f87171)';

// ── Component ────────────────────────────────────────────────────────────────
export default function App() {
  // Search state
  const [query, setQuery]           = useState('');
  const [isSearching, setSearching] = useState(false);
  const [hasSearched, setSearched]  = useState(false);
  const [results, setResults]       = useState([]);
  const [searchError, setError]     = useState(null);
  const [showSuggestions, setSugg]  = useState(false);
  const [showFilters, setFilters]   = useState(false);
  const suggRef = useRef(null);

  // Embedding / pipeline state
  const pipeRef       = useRef(null);
  const embeddingsRef = useRef(null);
  const [modelLoading, setModelLoading] = useState(true);
  const [modelError, setModelError]     = useState(false);

  // Filter state
  const [filters, setF] = useState({
    category: 'All', certification: 'All',
    maxPrice: 10000, minThickness: 0, maxThickness: 30, inStock: false,
  });
  const setFilter = patch => setF(prev => ({ ...prev, ...patch }));
  const resetFilters = () => setF({ category: 'All', certification: 'All', maxPrice: 10000, minThickness: 0, maxThickness: 30, inStock: false });
  const activeCount = [
    filters.category !== 'All', filters.certification !== 'All',
    filters.maxPrice < 10000, filters.minThickness > 0,
    filters.maxThickness < 30, filters.inStock,
  ].filter(Boolean).length;

  // ── Init embeddings on mount ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const texts = products.map(productToText);
        const pipe  = await getEmbeddingPipeline(texts);
        pipeRef.current = pipe;
        const embs = {};
        for (const p of products) embs[p.id] = await embedText(pipe, productToText(p));
        embeddingsRef.current = embs;
      } catch { setModelError(true); }
      finally  { setModelLoading(false); }
    })();
  }, []);

  // ── Close suggestions on outside click ──────────────────────────────────
  useEffect(() => {
    const h = e => { if (suggRef.current && !suggRef.current.contains(e.target)) setSugg(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── Search ───────────────────────────────────────────────────────────────
  const handleSearch = async e => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    setSearching(true); setSearched(true); setError(null); setSugg(false);
    try {
      const matches = await findMatches(query, { ...filters }, pipeRef.current, embeddingsRef.current);
      setResults(filters.inStock ? matches.filter(m => m.inStock) : matches);
    } catch (err) {
      setError(err.message || 'Search failed. Check your API key.');
      setResults([]);
    } finally { setSearching(false); }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: "'Inter', sans-serif" }}>

      {/* ── Pipeline status tiny bar ──────────────────────────────────────── */}
      {modelLoading && (
        <div style={{ background: 'rgba(71,119,255,0.07)', borderBottom: '1px solid rgba(71,119,255,0.12)', padding: '7px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 11, color: '#7A9FFF', letterSpacing: '0.02em' }}>
          <Loader2 size={11} className="spin-anim" /> Initializing semantic search index...
        </div>
      )}
      {!modelLoading && !modelError && (
        <div style={{ background: 'rgba(0,201,167,0.05)', borderBottom: '1px solid rgba(0,201,167,0.1)', padding: '6px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 11, color: '#00C9A7', letterSpacing: '0.025em' }}>
          <span className="pulse-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: '#00C9A7', display: 'inline-block', flexShrink: 0 }} />
          3-stage pipeline ready · TF-IDF vector search + Groq LLM · {Object.keys(embeddingsRef.current || {}).length} products indexed
        </div>
      )}
      {!modelLoading && modelError && (
        <div style={{ background: 'rgba(255,75,92,0.06)', borderBottom: '1px solid rgba(255,75,92,0.12)', padding: '6px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 11, color: '#FF4B5C' }}>
          <Info size={11} /> Search index failed — LLM-only matching active
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(7,7,15,0.82)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '0 28px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 62 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#4777FF,#00C9A7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800, color: '#fff', flexShrink: 0, fontFamily: 'Syne, sans-serif' }}>
              A
            </div>
            <div>
              <div className="syne" style={{ fontSize: 18, color: 'var(--text)', lineHeight: 1.1 }}>AmalGus</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 1 }}>Glass Marketplace</div>
            </div>
          </div>
          {/* Tagline */}
          <div className="syne" style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
            India's Smartest Glass Discovery
            <span style={{ color: 'rgba(71,119,255,0.5)', fontSize: 14 }}>✦</span>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', padding: '76px 24px 56px', overflow: 'hidden' }}>
        {/* Gradient blobs */}
        <div className="blob-1" style={{ position: 'absolute', top: '5%', left: '8%', width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(71,119,255,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div className="blob-2" style={{ position: 'absolute', bottom: '5%', right: '8%', width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,201,167,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
        {/* Large decorative BG text */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', userSelect: 'none', overflow: 'hidden' }}>
          <span className="syne" style={{ fontSize: 'clamp(70px, 20vw, 210px)', color: 'rgba(255,255,255,0.016)', letterSpacing: '-0.05em', whiteSpace: 'nowrap' }}>AMALGUS</span>
        </div>

        {/* Center content */}
        <div style={{ maxWidth: 860, margin: '0 auto', position: 'relative', zIndex: 10, textAlign: 'center' }}>
          {/* Eyebrow pill */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(71,119,255,0.09)', border: '1px solid rgba(71,119,255,0.18)', borderRadius: 100, padding: '6px 16px', marginBottom: 28, fontSize: 11, color: '#7A9FFF', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            <span className="pulse-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: '#4777FF', display: 'inline-block', flexShrink: 0 }} />
            AI-Powered · 3-Stage Matching · Groq API
          </div>

          {/* Main heading */}
          <h1 className="syne" style={{ fontSize: 'clamp(44px, 9vw, 88px)', lineHeight: 1.0, marginBottom: 22, color: 'var(--text)' }}>
            Smart Glass<br />
            <span className="gradient-text" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, letterSpacing: '-0.03em' }}>Discovery</span>
          </h1>

          <p style={{ fontSize: 16, color: 'rgba(234,228,216,0.38)', maxWidth: 460, margin: '0 auto 44px', lineHeight: 1.7 }}>
            Describe what you need in plain English. Our 3-stage AI engine — hard filter, vector search, and Groq LLM — finds your perfect glass match.
          </p>

          {/* ── Search form ──────────────────────────────────────────── */}
          <form onSubmit={handleSearch}>
            <div ref={suggRef} style={{ position: 'relative', maxWidth: 680, margin: '0 auto' }}>
              <div className="search-box">
                <textarea
                  rows={3}
                  placeholder={'e.g. "6mm tempered glass for office partitions, polished edges, clear"'}
                  value={query}
                  onChange={e => { setQuery(e.target.value); setSugg(true); }}
                  disabled={isSearching}
                />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)' }}>
                    {query.length > 0 ? `${query.length} chars` : 'Describe your requirements…'}
                  </span>
                  <button type="submit" className="btn-primary" disabled={isSearching || !query.trim()}>
                    {isSearching
                      ? <><Loader2 size={14} className="spin-anim" /> Analyzing…</>
                      : <><Search size={14} /> Find Matches <ArrowUpRight size={13} /></>}
                  </button>
                </div>
              </div>

              {/* Suggestions dropdown */}
              {showSuggestions && !isSearching && query.length >= 10 &&
                domainSuggestions.some(s =>
                  s.toLowerCase().includes(query.toLowerCase()) ||
                  query.toLowerCase().split(' ').some(w => w.length > 3 && s.toLowerCase().includes(w))
                ) && (
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, background: '#0D0D1A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden', zIndex: 100, boxShadow: '0 20px 60px rgba(0,0,0,0.65)' }}>
                  {domainSuggestions
                    .filter(s =>
                      s.toLowerCase().includes(query.toLowerCase()) ||
                      query.toLowerCase().split(' ').some(w => w.length > 3 && s.toLowerCase().includes(w))
                    )
                    .slice(0, 3)
                    .map((sug, i) => (
                      <div
                        key={i}
                        className="suggestion-row"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { setQuery(sug); setSugg(false); }}
                      >
                        <Search size={12} style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                        {sug}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </form>

          {/* Sample query chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 22, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>Try →</span>
            {SAMPLE_QUERIES.map((q, i) => (
              <button
                key={i}
                type="button"
                className="btn-ghost"
                onClick={() => { setQuery(q); setSugg(false); }}
                disabled={isSearching}
              >
                "{q}"
              </button>
            ))}
          </div>

          {/* Filter toggle */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 26 }}>
            <button
              type="button"
              className={`btn-filter${showFilters ? ' active' : ''}`}
              onClick={() => setFilters(prev => !prev)}
            >
              <SlidersHorizontal size={13} />
              Filters
              {activeCount > 0 && (
                <span style={{ background: '#4777FF', color: '#fff', borderRadius: 100, width: 18, height: 18, fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  {activeCount}
                </span>
              )}
              {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {activeCount > 0 && (
              <button type="button" className="btn-ghost" onClick={resetFilters}>
                <X size={11} /> Reset
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── Filter Panel ─────────────────────────────────────────────────── */}
      {showFilters && (
        <div className="fade-up" style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px 28px' }}>
          <div style={{ background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '24px 28px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: '20px 24px' }}>
              {/* Category */}
              <div>
                <div className="spec-label" style={{ marginBottom: 8 }}>Category</div>
                <select value={filters.category} onChange={e => setFilter({ category: e.target.value })}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {/* Certification */}
              <div>
                <div className="spec-label" style={{ marginBottom: 8 }}>Certification</div>
                <select value={filters.certification} onChange={e => setFilter({ certification: e.target.value })}>
                  {certifications.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {/* Price */}
              <div>
                <div className="spec-label" style={{ marginBottom: 8 }}>
                  Max Price <span style={{ color: '#4777FF', textTransform: 'none', letterSpacing: 0 }}>₹{filters.maxPrice.toLocaleString()}</span>
                </div>
                <input type="range" min={0} max={10000} step={100} value={filters.maxPrice} onChange={e => setFilter({ maxPrice: +e.target.value })} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.18)', marginTop: 4 }}>
                  <span>₹0</span><span>₹10,000/sqm</span>
                </div>
              </div>
              {/* Thickness */}
              <div>
                <div className="spec-label" style={{ marginBottom: 8 }}>Thickness (mm)</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="number" placeholder="Min" min={0} max={30} value={filters.minThickness || ''} onChange={e => setFilter({ minThickness: +e.target.value || 0 })} style={{ flex: 1 }} />
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>–</span>
                  <input type="number" placeholder="Max" min={0} max={30} value={filters.maxThickness || ''} onChange={e => setFilter({ maxThickness: +e.target.value || 0 })} style={{ flex: 1 }} />
                </div>
              </div>
              {/* InStock */}
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={filters.inStock} onChange={e => setFilter({ inStock: e.target.checked })} style={{ width: 16, height: 16 }} />
                  <span style={{ fontSize: 13, color: 'rgba(234,228,216,0.55)' }}>In Stock Only</span>
                </label>
              </div>
              {/* Info */}
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <div style={{ background: 'rgba(71,119,255,0.07)', border: '1px solid rgba(71,119,255,0.12)', borderRadius: 10, padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Info size={12} style={{ color: '#7A9FFF', flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 11, color: 'rgba(71,119,255,0.7)', lineHeight: 1.5 }}>Filters apply before AI matching</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Marquee Divider ──────────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)', margin: '28px 0', padding: '11px 0', overflow: 'hidden', background: 'rgba(255,255,255,0.01)' }}>
        <div className="marquee-track">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.17)', padding: '0 22px', flexShrink: 0 }}>
              {item}
              <span style={{ marginLeft: 22, color: 'rgba(71,119,255,0.35)' }}>✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Results ──────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px 100px' }}>

        {/* Error banner */}
        {searchError && (
          <div className="fade-up" style={{ background: 'rgba(255,75,92,0.07)', border: '1px solid rgba(255,75,92,0.18)', borderRadius: 16, padding: '18px 22px', display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 32 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,75,92,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Info size={16} style={{ color: '#FF4B5C' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: '#FF4B5C', fontSize: 14, marginBottom: 4 }}>Search Failed</div>
              <div style={{ fontSize: 13, color: 'rgba(255,75,92,0.75)', lineHeight: 1.6 }}>{searchError}</div>
              <button onClick={() => setError(null)} style={{ marginTop: 10, fontSize: 11, color: '#FF4B5C', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontFamily: "'Inter', sans-serif" }}>Dismiss</button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!hasSearched && !searchError && (
          <div style={{ textAlign: 'center', padding: '56px 0' }}>
            <div className="syne" style={{ fontSize: 'clamp(32px, 6vw, 58px)', color: 'rgba(234,228,216,0.04)', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 16 }}>
              FIND YOUR GLASS
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.18)' }}>
              Use the search above · AI analyzes specs, certifications &amp; context
            </p>
          </div>
        )}

        {/* Loading state */}
        {isSearching && (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <div style={{ width: 46, height: 46, borderRadius: '50%', border: '2px solid rgba(71,119,255,0.15)', borderTopColor: '#4777FF', margin: '0 auto 20px', animation: 'spin-slow 0.75s linear infinite' }} className="spin-anim" />
            <div className="syne" style={{ fontSize: 22, color: 'rgba(234,228,216,0.65)', marginBottom: 8 }}>Analyzing Requirements</div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.02em' }}>
              Hard Filter → Vector Search → Groq LLM Re-ranking…
            </p>
          </div>
        )}

        {/* Results grid */}
        {hasSearched && !isSearching && results.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 28 }}>
              <h2 className="syne" style={{ fontSize: 30, color: 'var(--text)', letterSpacing: '-0.02em' }}>Top Matches</h2>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.22)' }}>{results.length} products ranked by AI</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))', gap: 20 }}>
              {results.slice(0, 5).map((match, idx) => {
                const matchType = getMatchType(match.matchScore, match.matchReason);
                const col = scoreColor(match.matchScore);
                return (
                  <div
                    key={match.id}
                    className="glass-card fade-up"
                    style={{ borderRadius: 22, overflow: 'hidden', animationDelay: `${idx * 65}ms`, display: 'flex', flexDirection: 'column' }}
                  >
                    {/* Score accent stripe */}
                    <div style={{ height: 3, background: scoreBg(match.matchScore), flexShrink: 0 }} />

                    <div style={{ padding: '20px 24px 0', flex: 1 }}>
                      {/* Row 1: badges */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 6 }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <span className="chip chip-neutral">{match.category}</span>
                          {match.inStock && (
                            <span className="chip chip-teal" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#00C9A7', display: 'inline-block' }} />
                              In Stock
                            </span>
                          )}
                        </div>
                        <span className={MATCH_TYPE_CHIP[matchType]}>{matchType}</span>
                      </div>

                      {/* Product name */}
                      <h3 className="syne" style={{ fontSize: 21, lineHeight: 1.15, color: 'var(--text)', marginBottom: 18 }}>
                        {match.name}
                      </h3>

                      {/* Match score */}
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.27)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>AI Match Score</span>
                          <span className="syne" style={{ fontSize: 26, color: col, lineHeight: 1, letterSpacing: '-0.04em' }}>
                            {match.matchScore}<span style={{ fontSize: 13, color: 'rgba(255,255,255,0.22)', fontFamily: 'Inter,sans-serif', fontWeight: 400 }}>%</span>
                          </span>
                        </div>
                        <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 100, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 100, background: scoreBg(match.matchScore), width: `${match.matchScore}%`, transition: 'width 0.9s cubic-bezier(0.22,1,0.36,1)' }} />
                        </div>
                      </div>

                      {/* AI reason box */}
                      <div style={{ background: 'rgba(71,119,255,0.05)', border: '1px solid rgba(71,119,255,0.1)', borderRadius: 14, padding: '14px 16px', marginBottom: 22, position: 'relative' }}>
                        <Sparkles size={13} style={{ color: 'rgba(71,119,255,0.35)', position: 'absolute', top: 14, right: 14 }} />
                        <p style={{ fontSize: 13, color: 'rgba(234,228,216,0.55)', fontStyle: 'italic', lineHeight: 1.7, paddingRight: 20, marginBottom: 12 }}>
                          "{match.matchReason}"
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {(match.highlightedAttributes || []).map((attr, i) => (
                            <span key={i} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 100, background: 'rgba(71,119,255,0.09)', color: '#7A9FFF', border: '1px solid rgba(71,119,255,0.14)', fontWeight: 500 }}>
                              ✓ {attr}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Spec grid 2×3 */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px 20px', marginBottom: 22 }}>
                        {[
                          { label: 'Thickness',    value: `${match.thickness}mm` },
                          { label: 'Dimensions',   value: `${match.width} × ${match.height} cm` },
                          { label: 'Color',        value: match.color },
                          { label: 'Edge Finish',  value: match.edgeFinish },
                          { label: 'Coating',      value: match.coating },
                          { label: 'Certification',value: match.certification !== 'None' ? match.certification : '—' },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <div className="spec-label">{label}</div>
                            <div className="spec-value">{value}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Card footer */}
                    <div style={{ padding: '14px 24px 20px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{match.supplier}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgba(255,255,255,0.22)', marginTop: 2 }}>
                          <MapPin size={10} /> {match.location}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div className="spec-label">Wholesale</div>
                          <div className="syne" style={{ fontSize: 20, letterSpacing: '-0.03em', color: 'var(--text)', lineHeight: 1 }}>
                            ₹{match.pricePerSqm.toLocaleString()}
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter,sans-serif', fontWeight: 400 }}>/sqm</span>
                          </div>
                        </div>
                        <button className="btn-quote">
                          Quote <ArrowUpRight size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* No results */}
        {hasSearched && !isSearching && results.length === 0 && !searchError && (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <div style={{ fontSize: 42, marginBottom: 16, opacity: 0.3 }}>⊘</div>
            <div className="syne" style={{ fontSize: 24, color: 'rgba(234,228,216,0.5)', marginBottom: 10 }}>No Results Found</div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)', maxWidth: 340, margin: '0 auto 24px', lineHeight: 1.7 }}>
              Try relaxing your filters or rephrasing your query with different keywords.
            </p>
            <button className="btn-ghost" onClick={resetFilters} style={{ padding: '10px 22px', fontSize: 13 }}>
              Reset all filters
            </button>
          </div>
        )}
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.25)', padding: '30px 28px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="syne" style={{ fontSize: 20, color: 'var(--text)' }}>AmalGus</span>
              <span style={{ color: 'rgba(71,119,255,0.4)', fontSize: 14 }}>✦</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.18)' }}>India's Smartest Glass Marketplace</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.15)' }}>
              <Cpu size={10} />
              Hard Filter → TF-IDF Vector → Groq LLM Re-ranking
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.1)' }}>
            © 2026 AmalGus Marketplace · Powered by Groq AI + React + Vite · Prototype — mock data only
          </div>
        </div>
      </footer>
    </div>
  );
}
