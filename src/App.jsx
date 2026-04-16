import React, { useState, useRef, useEffect } from 'react';
import { Search, Filter, Box, Ruler, Award, MapPin, Package, CheckCircle2, ChevronRight, Loader2, Info, Cpu } from 'lucide-react';
import { findMatches } from './matcher';
import { products } from './products';
import { getEmbeddingPipeline, productToText, embedText } from './embeddings';

// Extract unique categories and certifications for the filters
const categories = ['All', ...new Set(products.map(p => p.category))];
const certifications = ['All', ...new Set(products.map(p => p.certification).filter(c => c !== 'None'))];

const domainSuggestions = [
  "6mm tempered glass for office partitions",
  "8mm clear toughened glass for balcony railings",
  "10mm clear heavy duty glass for shop fronts",
  "12mm thick acoustic glass for residential windows",
  "Double glazed unit (DGU) for energy efficient facades",
  "Blue tinted glass for commercial building facade",
  "Privacy frosted glass for bathroom shower enclosure"
];

const App = () => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const suggestionRef = useRef(null);

  // Embedding pipeline refs — populated once on mount, never re-computed
  const pipeRef = useRef(null);
  const embeddingsRef = useRef(null); // { [productId]: number[] }
  const [modelLoading, setModelLoading] = useState(true);
  const [modelError, setModelError] = useState(null);

  // Filters state
  const [filters, setFilters] = useState({
    category: 'All',
    certification: 'All',
    maxPrice: 10000,
    minThickness: 0,
    maxThickness: 30,
    inStock: false,
  });

  // ── Embedding pipeline initialization ──────────────────────────────────
  // Loads Xenova/all-MiniLM-L6-v2 on mount (browser WASM, ~25MB first load)
  // then pre-computes embeddings for all products. Cached in refs.
  useEffect(() => {
    async function initEmbeddings() {
      try {
        setModelLoading(true);
        // Build TF-IDF index from all product texts (pure JS, instant)
        const productTexts = products.map(productToText);
        const pipe = await getEmbeddingPipeline(productTexts);
        pipeRef.current = pipe;

        // Embed each product as a sparse TF-IDF vector
        const embeddings = {};
        for (const product of products) {
          const text = productToText(product);
          embeddings[product.id] = await embedText(pipe, text);
        }
        embeddingsRef.current = embeddings;
        console.log(`[App] TF-IDF indexed ${Object.keys(embeddings).length} products`);
      } catch (err) {
        console.error('[App] Failed to build search index:', err);
        setModelError('Search index failed — LLM-only matching active.');
      } finally {
        setModelLoading(false);
      }
    }
    initEmbeddings();
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target)) {
        // Removing focus from textarea collapses the suggestion box naturally
        // We use a small trick: blur won't close the dropdown, so we clear filtered state
        // by just letting the user type further. We add a dedicated state instead:
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sampleQueries = [
    "6mm tempered glass for office partitions, polished edges, clear",
    "Acoustic laminated glass for home, high thickness",
    "Blue tinted UV protection facade glass for a commercial building",
  ];

  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    setSearchError(null);
    setShowSuggestions(false);
    try {
      // Pass embedding pipe and pre-computed product embeddings for the vector stage.
      // If model is still loading, both refs will be null and matcher gracefully skips Stage 2.
      const matches = await findMatches(
        query,
        { ...filters },
        pipeRef.current,
        embeddingsRef.current
      );

      let finalMatches = matches;
      if (filters.inStock) {
        finalMatches = matches.filter((m) => m.inStock);
      }

      setResults(finalMatches);
    } catch (error) {
      console.error(error);
      setSearchError(
        error.message || 'An unexpected error occurred. Please check your API key and try again.'
      );
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 75) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getScoreTextColor = (score) => {
    if (score >= 75) return 'text-green-700';
    if (score >= 50) return 'text-yellow-700';
    return 'text-red-700';
  };

  const handleApplySample = (q) => {
    setQuery(q);
    setShowSuggestions(false);
  };

  const getMatchType = (score, reason) => {
    if (score > 85) return 'Best Overall';
    const reasonLower = reason.toLowerCase();
    if (reasonLower.includes('price') || reasonLower.includes('budget') || reasonLower.includes('cost') || reasonLower.includes('affordable')) {
      return 'Budget Match';
    }
    if (reasonLower.includes('use case') || reasonLower.includes('application') || reasonLower.includes('project') || reasonLower.includes('office') || reasonLower.includes('building') || reasonLower.includes('home')) {
      return 'Use Case Match';
    }
    return 'Spec Match';
  };

  const getMatchTypeStyle = (matchType) => {
    switch (matchType) {
      case 'Best Overall': return 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white border-transparent shadow-sm';
      case 'Budget Match': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Use Case Match': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
      {/* Model Loading Banner — shown on first load while WASM model downloads */}
      {modelLoading && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm px-4 py-2.5 flex items-center justify-center gap-3 shadow-md">
          <Loader2 size={15} className="animate-spin flex-shrink-0" />
          <span>
            <strong>Initializing semantic search index...</strong>
          </span>
        </div>
      )}
      {!modelLoading && modelError && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs px-4 py-2 flex items-center justify-center gap-2">
          <Info size={13} className="flex-shrink-0" />
          {modelError}
        </div>
      )}
      {!modelLoading && !modelError && (
        <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs px-4 py-2 flex items-center justify-center gap-2">
          <Cpu size={13} className="flex-shrink-0" />
          <span><strong>3-stage pipeline ready</strong> — TF-IDF vector search + LLM re-ranking active · {Object.keys(embeddingsRef.current || {}).length} products indexed</span>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
                <Box size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">AmalGus</h1>
                <p className="text-xs font-semibold text-blue-600 tracking-wider uppercase">India's Smartest Glass Marketplace</p>
              </div>
            </div>
            
            <button 
              className="md:hidden flex items-center justify-center p-2 rounded-md bg-slate-100 text-slate-600"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <Filter size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex flex-col md:flex-row gap-8">
        
        {/* Left Sidebar (Filters) */}
        <aside className={`md:w-72 flex-shrink-0 ${isSidebarOpen ? 'block' : 'hidden'} md:block bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit sticky top-28`}>
          <div className="flex items-center gap-2 mb-6 text-slate-800 font-bold text-lg">
            <Filter size={20} className="text-blue-600" />
            Filters
          </div>

          {/* Category */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Category</label>
            <select 
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            >
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          {/* Certification */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Certification</label>
            <select 
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
              value={filters.certification}
              onChange={(e) => setFilters({ ...filters, certification: e.target.value })}
            >
              {certifications.map(cert => <option key={cert} value={cert}>{cert}</option>)}
            </select>
          </div>

          {/* Max Price */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2 flex justify-between">
              Max Price <span className="text-blue-600 font-bold">₹{filters.maxPrice}</span>
            </label>
            <input 
              type="range" 
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              min="0" max="10000" step="100"
              value={filters.maxPrice}
              onChange={(e) => setFilters({ ...filters, maxPrice: parseInt(e.target.value) })}
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>₹0/sqm</span>
              <span>₹10,000/sqm</span>
            </div>
          </div>

          {/* Thickness */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Thickness (mm)</label>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Min" min="0" max="30"
                value={filters.minThickness || ''}
                onChange={(e) => setFilters({ ...filters, minThickness: parseInt(e.target.value) || 0 })}
              />
              <span className="text-slate-400">-</span>
              <input 
                type="number" 
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Max" min="0" max="30"
                value={filters.maxThickness || ''}
                onChange={(e) => setFilters({ ...filters, maxThickness: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          {/* In Stock Toggle */}
          <div className="mb-6 flex items-center">
            <input 
              type="checkbox" 
              id="inStock"
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer accent-blue-600"
              checked={filters.inStock}
              onChange={(e) => setFilters({ ...filters, inStock: e.target.checked })}
            />
            <label htmlFor="inStock" className="ml-2 text-sm font-medium text-slate-700 cursor-pointer">
              In Stock Only
            </label>
          </div>

          {/* Warning Note */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg flex items-start gap-2 border border-blue-100">
            <Info size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800 leading-tight">These filters apply <strong>before</strong> AI matching to narrow the dataset.</p>
          </div>
        </aside>

        {/* Right Content Area */}
        <div className="flex-grow w-full max-w-4xl flex flex-col gap-8">
          
          {/* Smart Search Panel */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
              <Search size={150} />
            </div>
            
            <h2 className="text-xl font-bold text-slate-900 mb-2">Smart Product Matcher</h2>
            <p className="text-slate-500 mb-6 max-w-2xl text-sm">
              Describe the glass product you need in plain English. Our AI analyzes technical specifications, certifications, and project context to find your perfect match.
            </p>

            <form onSubmit={handleSearch}>
              <div className="relative" ref={suggestionRef}>
                <textarea
                  className="w-full h-32 pl-4 pr-4 py-4 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-base shadow-inner resize-none"
                  placeholder='e.g. "6mm tempered glass for office partitions, polished edges, clear"'
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
                  disabled={isSearching}
                />
                
                {/* Query Suggestions Dropdown */}
                {showSuggestions && query.length >= 10 && !isSearching && domainSuggestions.some(s => s.toLowerCase().includes(query.toLowerCase()) || query.toLowerCase().split(' ').some(w => w.length > 3 && s.toLowerCase().includes(w))) && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg ring-1 ring-slate-900/5 shadow-blue-900/5 overflow-hidden">
                    {domainSuggestions
                      .filter(s => s.toLowerCase().includes(query.toLowerCase()) || query.toLowerCase().split(' ').some(w => w.length > 3 && s.toLowerCase().includes(w)))
                      .slice(0, 3)
                      .map((suggestion, idx) => (
                        <div 
                          key={idx} 
                          className="px-4 py-3 hover:bg-slate-50 cursor-pointer flex items-center gap-3 text-sm text-slate-700 border-b last:border-0 border-slate-100 transition-colors"
                          onMouseDown={(e) => e.preventDefault()} // prevent blur before click
                          onClick={() => { setQuery(suggestion); setShowSuggestions(false); }}
                        >
                          <Search size={14} className="text-slate-400 flex-shrink-0" />
                          <span className="truncate">{suggestion}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Sample Queries */}
              <div className="mt-4">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Sample Queries</span>
                <div className="flex flex-wrap gap-2">
                  {sampleQueries.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={isSearching}
                      onClick={() => handleApplySample(q)}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium rounded-full cursor-pointer transition-colors border border-blue-100 text-left"
                    >
                      "{q}"
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button 
                  type="submit"
                  disabled={isSearching || !query.trim()}
                  className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold shadow-lg shadow-slate-900/20 transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:-translate-y-0"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Analyzing Matches...
                    </>
                  ) : (
                    <>
                      <Search size={20} />
                      Find Best Matches
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Results Area */}
          <div className="flex flex-col gap-6">
            {/* Inline Error Banner */}
            {searchError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 text-red-500">
                  <Info size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-red-800 mb-1">Search Failed</h4>
                  <p className="text-sm text-red-700 leading-relaxed">{searchError}</p>
                  <button onClick={() => setSearchError(null)} className="mt-3 text-xs font-semibold text-red-600 underline">Dismiss</button>
                </div>
              </div>
            )}
            {!hasSearched ? (
              <div className="text-center py-24 bg-slate-50 rounded-2xl border border-slate-200 border-dashed">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-500">
                  <Box size={28} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">Ready to Source</h3>
                <p className="text-slate-500 text-sm">Enter a search query to explore intelligent product matches.</p>
              </div>
            ) : isSearching ? (
              <div className="text-center py-24 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex flex-col justify-center items-center">
                  <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Analyzing Requirements...</h3>
                  <p className="text-slate-500 text-sm">Generating intelligent matches via AI.</p>
                </div>
              </div>
            ) : results.length > 0 ? (
              <>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xl font-bold text-slate-900">Top Matches</h3>
                  <span className="text-sm font-medium text-slate-500">{results.length} products found</span>
                </div>
                
                <div className="grid grid-cols-1 gap-6">
                  {results.slice(0, 5).map((match, idx) => {
                    const matchType = getMatchType(match.matchScore, match.matchReason);
                    return (
                    <div key={match.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl hover:shadow-blue-900/5 transition-all p-6 flex flex-col group relative">
                      
                      {/* Match Explainer Badge */}
                      <div className={`absolute top-0 right-0 rounded-bl-xl px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border-b border-l z-10 ${getMatchTypeStyle(matchType)}`}>
                        {matchType}
                      </div>

                      {/* Top Row: Name, Score, Badges */}
                      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md">{match.category}</span>
                            {match.inStock && (
                              <span className="text-[10px] font-bold tracking-wider uppercase bg-green-50 text-green-600 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> In Stock
                              </span>
                            )}
                          </div>
                          <h4 className="text-xl font-bold text-slate-900 group-hover:text-blue-700 transition-colors leading-tight">{match.name}</h4>
                        </div>

                        {/* Match Score */}
                        <div className="flex flex-col md:items-end w-full md:w-48 flex-shrink-0">
                          <span className={`text-2xl font-black ${getScoreTextColor(match.matchScore)} leading-none mb-1`}>
                            {match.matchScore}% <span className="text-xs font-semibold text-slate-400">Match</span>
                          </span>
                          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${getScoreColor(match.matchScore)} transition-all duration-1000 ease-out`}
                              style={{ width: `${match.matchScore}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>

                      {/* AI Match Reason & Attributes */}
                      <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50 mb-5 relative">
                        <Award className="absolute top-4 right-4 text-blue-200" size={24} />
                        <p className="text-sm font-medium text-slate-700 italic leading-relaxed pr-8">"{match.matchReason}"</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {match.highlightedAttributes && match.highlightedAttributes.map((attr, i) => (
                            <span key={i} className="text-xs px-2 py-1 bg-white border border-blue-200 text-blue-700 font-semibold rounded-md shadow-sm">✓ {attr}</span>
                          ))}
                        </div>
                      </div>

                      {/* Specifications */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                        <div>
                          <p className="text-xs text-slate-400 font-medium mb-0.5">Thickness</p>
                          <p className="text-sm font-semibold text-slate-800">{match.thickness}mm</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 font-medium mb-0.5">Dimensions</p>
                          <p className="text-sm font-semibold text-slate-800">{match.width} × {match.height} cm</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 font-medium mb-0.5">Color / Tint</p>
                          <p className="text-sm font-semibold text-slate-800">{match.color}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 font-medium mb-0.5">Edge Finish</p>
                          <p className="text-sm font-semibold text-slate-800">{match.edgeFinish}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 font-medium mb-0.5">Coating</p>
                          <p className="text-sm font-semibold text-slate-800">{match.coating}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 font-medium mb-0.5">Certification</p>
                          <p className="text-sm font-semibold text-slate-800">{match.certification !== 'None' ? match.certification : '—'}</p>
                        </div>
                      </div>

                      {/* Footer: Price, Supplier, CTA */}
                      <div className="mt-auto pt-5 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-start">
                          <div>
                            <p className="text-xs text-slate-400 font-medium mb-0.5">Supplier</p>
                            <p className="text-sm font-bold text-slate-900">{match.supplier}</p>
                            <div className="flex items-center gap-1 text-slate-500 text-xs mt-0.5">
                              <MapPin size={12} /> {match.location}
                            </div>
                          </div>
                          <div className="text-right sm:text-left h-full flex flex-col justify-between">
                            <p className="text-xs text-slate-400 font-medium mb-0.5">Wholesale Price</p>
                            <p className="text-lg font-black text-slate-900 leading-none">₹{match.pricePerSqm}<span className="text-xs text-slate-500 font-normal">/sqm</span></p>
                          </div>
                        </div>

                        <button className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2">
                          Request Quote <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )})}
                </div>
              </>
            ) : (
              <div className="text-center py-24 bg-white rounded-2xl border border-red-100 shadow-sm relative overflow-hidden">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                  <Search size={28} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">No Matching Products Found</h3>
                <p className="text-slate-500 text-sm max-w-sm mx-auto mb-6">
                  We couldn't find any glass products that closely match your complex requirements based on the current filters.
                </p>
                <button 
                  onClick={() => setFilters({ category: 'All', certification: 'All', maxPrice: 10000, minThickness: 0, maxThickness: 30, inStock: false })}
                  className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-full shadow-sm"
                >
                  Clear Hard Filters 
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm">
          <p>© 2026 AmalGus Marketplace. Intelligent Building Materials Procurement.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
