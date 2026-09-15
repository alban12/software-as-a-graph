import React, { useState, useEffect } from 'react';
import {
  Lock,
  Mail,
  AlertCircle,
  Loader2,
  Wifi,
  Battery,
  Signal,
  CheckCircle2,
  Circle,
  Plus,
  MapPin,
  Star,
  Compass,
  User,
  Calendar,
  Flag,
  Search,
  Mountain,
  Shield,
  ChevronRight,
  Fingerprint,
  Layers,
  Sparkles,
  Sliders,
  Award,
  TrendingUp,
  Activity,
  Heart,
  Grid
} from 'lucide-react';

export default function ScreenPreview({
  nodeName = 'LoginView',
  variant = 'default',
  size = 'mini', // 'mini' | 'full'
  customState = null,
  onClick = null,
  viewElements = null,
  stateProps = null,
  onElementAction = null,
  initialEmail = 'alban@example.com',
  initialPassword = 'password123'
}) {
  const effectiveVariant = customState || variant;
  const isMini = size === 'mini';

  // State for LoginView inputs
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState(initialPassword);

  // State for Reminders & Landmarks
  const [checkedItems, setCheckedItems] = useState({ 0: false, 1: false, 2: true });
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [isFavorite, setIsFavorite] = useState(true);
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [hikeMetric, setHikeMetric] = useState('elevation'); // 'elevation' | 'heartRate' | 'pace'
  const [activeTab, setActiveTab] = useState('featured'); // 'featured' | 'list'

  useEffect(() => {
    setEmail(initialEmail);
  }, [initialEmail]);

  useEffect(() => {
    setPassword(initialPassword);
  }, [initialPassword]);

  const name = nodeName || '';

  // -------------------------------------------------------------
  // RENDERER 1: Reminders App (MakeItSo)
  // -------------------------------------------------------------
  if (name.includes('Reminder') || name.includes('MakeItSo') || name.includes('EmptyState')) {
    if (name.includes('Detail')) {
      return (
        <DeviceFrame isMini={isMini} onClick={onClick}>
          <div className="preview-nav-bar">
            <span className="nav-action">Cancel</span>
            <span className="nav-title">Details</span>
            <span className="nav-action bold" onClick={(e) => { e.stopPropagation(); onElementAction?.('saveReminder'); }}>Done</span>
          </div>
          <div className="preview-content-scroll">
            <div className="ios-card-group">
              <div className="ios-input-row">
                <input
                  type="text"
                  className="ios-text-input"
                  defaultValue="Review PR #42 (Guardrails)"
                  placeholder="Title"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="ios-divider" />
              <div className="ios-input-row">
                <input
                  type="text"
                  className="ios-text-input subtle"
                  defaultValue="Verify bidirectional view-model edges"
                  placeholder="Notes"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            <div className="ios-card-group">
              <div className="ios-toggle-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calendar size={isMini ? 11 : 14} color="#3b82f6" />
                  <span>Date</span>
                </div>
                <span className="ios-badge-pill">Today</span>
              </div>
              <div className="ios-divider" />
              <div className="ios-toggle-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Flag size={isMini ? 11 : 14} color="#f59e0b" />
                  <span>Flag</span>
                </div>
                <span className="ios-switch on" />
              </div>
            </div>

            <div className="ios-card-group delete-card">
              <div className="ios-destructive-row">Delete Reminder</div>
            </div>
          </div>
        </DeviceFrame>
      );
    }

    if (name.includes('Row')) {
      return (
        <DeviceFrame isMini={isMini} onClick={onClick}>
          <div className="preview-content-scroll centered">
            <div className="reminder-item-row standalone" style={{ width: '100%', padding: isMini ? '8px 10px' : '14px 16px' }}>
              <div
                className="reminder-checkbox"
                onClick={(e) => {
                  e.stopPropagation();
                  setCheckedItems((prev) => ({ ...prev, 0: !prev[0] }));
                }}
              >
                {checkedItems[0] ? (
                  <CheckCircle2 size={isMini ? 15 : 20} color="#38bdf8" />
                ) : (
                  <Circle size={isMini ? 15 : 20} color="#64748b" />
                )}
              </div>
              <div className="reminder-item-text" style={{ flex: 1 }}>
                <div className={`reminder-item-title ${checkedItems[0] ? 'completed' : ''}`}>
                  Build SaaG Extractor
                </div>
                <div className="reminder-item-subtitle">Due today · Priority High</div>
              </div>
              <Flag size={isMini ? 12 : 16} color="#f59e0b" fill="#f59e0b" />
            </div>
          </div>
        </DeviceFrame>
      );
    }

    // RemindersListView
    const reminderItems = [
      { id: 0, title: 'Release SaaG v1.0', date: 'Today, 5:00 PM', priority: 'high' },
      { id: 1, title: 'Extract Landmarks Benchmark', date: 'Tomorrow', priority: 'med' },
      { id: 2, title: 'Clean Architecture Verification', date: 'Completed', priority: 'low' }
    ];

    return (
      <DeviceFrame isMini={isMini} onClick={onClick}>
        <div className="preview-content-scroll">
          <div className="reminders-search-bar">
            <Search size={isMini ? 10 : 13} color="#64748b" />
            <span>Search reminders</span>
          </div>

          <div className="reminders-stats-grid">
            <div className="reminder-stat-card blue">
              <div className="stat-top">
                <Calendar size={isMini ? 12 : 18} />
                <span className="stat-count">3</span>
              </div>
              <div className="stat-label">Today</div>
            </div>
            <div className="reminder-stat-card orange">
              <div className="stat-top">
                <Flag size={isMini ? 12 : 18} />
                <span className="stat-count">1</span>
              </div>
              <div className="stat-label">Flagged</div>
            </div>
          </div>

          <div className="reminders-header">
            <div className="reminders-title">My Tasks</div>
          </div>

          <div className="reminders-list-group">
            {reminderItems.map((item) => {
              const isDone = Boolean(checkedItems[item.id]);
              return (
                <div
                  key={item.id}
                  className="reminder-item-row"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCheckedItems((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
                  }}
                >
                  <div className="reminder-checkbox">
                    {isDone ? (
                      <CheckCircle2 size={isMini ? 13 : 18} color="#38bdf8" />
                    ) : (
                      <Circle size={isMini ? 13 : 18} color="#64748b" />
                    )}
                  </div>
                  <div className="reminder-item-text">
                    <div className={`reminder-item-title ${isDone ? 'completed' : ''}`}>
                      {item.title}
                    </div>
                    <div className="reminder-item-subtitle">{item.date}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="new-reminder-bar"
            onClick={(e) => {
              e.stopPropagation();
              onElementAction?.('newReminder');
            }}
          >
            <Plus size={isMini ? 12 : 16} color="#38bdf8" />
            <span>New Reminder</span>
          </div>
        </div>
      </DeviceFrame>
    );
  }

  // -------------------------------------------------------------
  // RENDERER 2: Apple Landmarks App Components
  // -------------------------------------------------------------

  // 2.1 ContentView (Main TabView Container)
  if (name === 'ContentView') {
    return (
      <DeviceFrame isMini={isMini} onClick={onClick}>
        <div className="preview-tabview-container">
          <div className="preview-tab-content">
            {activeTab === 'featured' ? (
              <CategoryHomeContent isMini={isMini} onElementAction={onElementAction} />
            ) : (
              <LandmarkListContent isMini={isMini} favoritesOnly={favoritesOnly} setFavoritesOnly={setFavoritesOnly} />
            )}
          </div>
          {/* iOS Bottom Tab Bar */}
          <div className="ios-tab-bar">
            <div
              className={`tab-bar-item ${activeTab === 'featured' ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setActiveTab('featured'); }}
            >
              <Star size={isMini ? 12 : 18} fill={activeTab === 'featured' ? '#0ea5e9' : 'none'} />
              <span>Featured</span>
            </div>
            <div
              className={`tab-bar-item ${activeTab === 'list' ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setActiveTab('list'); }}
            >
              <Layers size={isMini ? 12 : 18} />
              <span>List</span>
            </div>
          </div>
        </div>
      </DeviceFrame>
    );
  }

  // 2.2 CategoryHome (Featured Landing Screen)
  if (name === 'CategoryHome') {
    return (
      <DeviceFrame isMini={isMini} onClick={onClick}>
        <CategoryHomeContent isMini={isMini} onElementAction={onElementAction} />
      </DeviceFrame>
    );
  }

  // 2.3 CategoryRow (Horizontal Category Scroller)
  if (name === 'CategoryRow') {
    return (
      <DeviceFrame isMini={isMini} onClick={onClick}>
        <div className="preview-content-scroll centered">
          <div className="category-row-container" style={{ width: '100%' }}>
            <div className="category-row-header">
              <span className="category-title">Featured Lakes</span>
              <span className="category-count">4 items</span>
            </div>
            <div className="category-horizontal-scroll">
              <div className="category-item-card">
                <div className="cat-img-box lake1"><Mountain size={isMini ? 14 : 22} color="#fff" /></div>
                <div className="cat-img-name">Lake McDonald</div>
              </div>
              <div className="category-item-card">
                <div className="cat-img-box lake2"><Mountain size={isMini ? 14 : 22} color="#fff" /></div>
                <div className="cat-img-name">Twin Lakes</div>
              </div>
              <div className="category-item-card">
                <div className="cat-img-box lake3"><Mountain size={isMini ? 14 : 22} color="#fff" /></div>
                <div className="cat-img-name">St. Mary Lake</div>
              </div>
            </div>
          </div>
        </div>
      </DeviceFrame>
    );
  }

  // 2.4 CategoryItem (Single Square Thumbnail Card)
  if (name === 'CategoryItem') {
    return (
      <DeviceFrame isMini={isMini} onClick={onClick}>
        <div className="preview-content-scroll centered">
          <div className="category-item-card standalone">
            <div className="cat-img-box standalone-box"><Mountain size={isMini ? 24 : 40} color="#fff" /></div>
            <div className="cat-img-name bold">Turtle Rock</div>
            <div className="cat-img-subtitle">Joshua Tree</div>
          </div>
        </div>
      </DeviceFrame>
    );
  }

  // 2.5 LandmarkRow (iOS Table Row)
  if (name === 'LandmarkRow') {
    return (
      <DeviceFrame isMini={isMini} onClick={onClick}>
        <div className="preview-content-scroll centered">
          <div className="landmark-list-row standalone" style={{ width: '100%', padding: isMini ? '8px 12px' : '14px 16px' }}>
            <div className="landmark-thumb">
              <Mountain size={isMini ? 12 : 18} color="#0ea5e9" />
            </div>
            <div style={{ flex: 1 }}>
              <div className="landmark-row-name">Turtle Rock</div>
              <div className="landmark-row-park">Joshua Tree National Park</div>
            </div>
            <Star size={isMini ? 11 : 16} color="#eab308" fill="#eab308" />
            <ChevronRight size={isMini ? 12 : 16} color="#64748b" />
          </div>
        </div>
      </DeviceFrame>
    );
  }

  // 2.6 CircleImage (Avatar / Clipped Circle)
  if (name === 'CircleImage') {
    return (
      <DeviceFrame isMini={isMini} onClick={onClick}>
        <div className="preview-content-scroll centered">
          <div className="circle-image-showcase">
            <div className="circle-image-ring">
              <Mountain size={isMini ? 28 : 52} color="#38bdf8" />
            </div>
            <div className="circle-image-label">CircleImage Component</div>
          </div>
        </div>
      </DeviceFrame>
    );
  }

  // 2.7 FavoriteButton (Star toggle button)
  if (name === 'FavoriteButton') {
    return (
      <DeviceFrame isMini={isMini} onClick={onClick}>
        <div className="preview-content-scroll centered">
          <div
            className="favorite-button-interactive"
            onClick={(e) => { e.stopPropagation(); setIsFavorite(!isFavorite); }}
          >
            <Star
              size={isMini ? 28 : 48}
              color={isFavorite ? '#eab308' : '#64748b'}
              fill={isFavorite ? '#eab308' : 'none'}
              className={isFavorite ? 'fav-glow' : ''}
            />
            <div className="fav-status-text">
              {isFavorite ? 'Favorite Saved ★' : 'Tap to Add Favorite ☆'}
            </div>
          </div>
        </div>
      </DeviceFrame>
    );
  }

  // 2.8 FeatureCard / PageView
  if (name === 'FeatureCard' || name === 'PageView') {
    return (
      <DeviceFrame isMini={isMini} onClick={onClick}>
        <div className="preview-content-scroll centered no-padding">
          <div className="featured-hero-card full-bleed">
            <div className="feature-overlay-gradient">
              <div className="feature-hero-badge">Featured Landmark</div>
              <div className="feature-hero-title">Lake McDonald</div>
              <div className="feature-hero-sub">Glacier National Park</div>
            </div>
          </div>
        </div>
      </DeviceFrame>
    );
  }

  // 2.9 ProfileHost & ProfileSummary & ProfileEditor
  if (name === 'ProfileHost' || name === 'ProfileSummary' || name === 'ProfileEditor') {
    const isEditorOnly = name === 'ProfileEditor';
    const showEditor = isEditorOnly || isProfileEditing;

    return (
      <DeviceFrame isMini={isMini} onClick={onClick}>
        <div className="preview-nav-bar">
          <span className="nav-action">{showEditor ? 'Cancel' : ''}</span>
          <span className="nav-title">Profile</span>
          {!isEditorOnly && (
            <span
              className="nav-action bold"
              onClick={(e) => { e.stopPropagation(); setIsProfileEditing(!isProfileEditing); }}
            >
              {isProfileEditing ? 'Done' : 'Edit'}
            </span>
          )}
        </div>
        <div className="preview-content-scroll">
          {showEditor ? (
            /* ProfileEditor Form */
            <div className="ios-form-container">
              <div className="ios-card-group">
                <div className="ios-input-row">
                  <span className="field-label">Username</span>
                  <input
                    type="text"
                    className="ios-text-input right-align"
                    defaultValue="John Appleseed"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="ios-divider" />
                <div className="ios-toggle-row">
                  <span>Enable Notifications</span>
                  <span className="ios-switch on" />
                </div>
              </div>

              <div className="ios-card-group">
                <div className="ios-toggle-row">
                  <span>Seasonal Goal</span>
                  <span className="ios-badge-pill">Spring 2026</span>
                </div>
                <div className="ios-divider" />
                <div className="ios-toggle-row">
                  <span>Goal Date</span>
                  <span className="date-picker-badge">Jun 21, 2026</span>
                </div>
              </div>
            </div>
          ) : (
            /* ProfileSummary View */
            <div className="profile-summary-container">
              <div className="profile-header-card">
                <div className="profile-avatar">
                  <User size={isMini ? 18 : 28} color="#ffffff" />
                </div>
                <div className="profile-name">John Appleseed</div>
                <div className="profile-membership">Landmark Explorer · Level 4</div>
              </div>

              <div className="ios-card-group" style={{ marginTop: 8 }}>
                <div className="ios-toggle-row">
                  <span>Notifications</span>
                  <span className="status-on-pill">On</span>
                </div>
                <div className="ios-divider" />
                <div className="ios-toggle-row">
                  <span>Seasonal Badges</span>
                  <span className="badge-count-pill">3 Badges</span>
                </div>
              </div>

              {/* Badges showcase carousel */}
              <div className="profile-badges-row">
                <div className="mini-badge-item">
                  <div className="mini-badge-hex gold"><Mountain size={isMini ? 10 : 16} color="#eab308" /></div>
                  <span>Earth Day</span>
                </div>
                <div className="mini-badge-item">
                  <div className="mini-badge-hex blue"><Sparkles size={isMini ? 10 : 16} color="#0ea5e9" /></div>
                  <span>Spring 26</span>
                </div>
                <div className="mini-badge-item">
                  <div className="mini-badge-hex green"><Award size={isMini ? 10 : 16} color="#10b981" /></div>
                  <span>10 Trails</span>
                </div>
              </div>

              {/* Recent Hike Section */}
              <div className="profile-recent-hike-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="hike-card-title">Recent Hike: Chilkoot Trail</span>
                  <span className="hike-card-metric">+420m</span>
                </div>
                <div className="mini-elevation-bar">
                  {[20, 45, 70, 90, 60, 85, 40, 65].map((val, i) => (
                    <div key={i} className="mini-bar-col" style={{ height: `${val}%` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </DeviceFrame>
    );
  }

  // 2.10 HikeDetail & HikeGraph & GraphCapsule & HikeBadge
  if (name.includes('Hike') || name.includes('Graph') || name === 'GraphCapsule' || name === 'HikeBadge') {
    if (name === 'HikeBadge') {
      return (
        <DeviceFrame isMini={isMini} onClick={onClick}>
          <div className="preview-content-scroll centered">
            <div className="hike-badge-container">
              <div className="hike-badge-hex">
                <Mountain size={isMini ? 24 : 44} color="#0ea5e9" />
              </div>
              <div className="hike-badge-caption">Earth Day 2026</div>
              <div className="hike-badge-sub">Awarded for Chilkoot Hike</div>
            </div>
          </div>
        </DeviceFrame>
      );
    }

    // HikeView & HikeDetail & HikeGraph
    return (
      <DeviceFrame isMini={isMini} onClick={onClick}>
        <div className="preview-content-scroll">
          <div className="reminders-title" style={{ fontSize: isMini ? '12px' : '16px', marginBottom: 6 }}>
            Chilkoot Trail
          </div>
          <div className="hike-stat-banner">
            <div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Distance</div>
              <div style={{ fontWeight: 700, color: '#38bdf8' }}>5.8 km</div>
            </div>
            <div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Elevation</div>
              <div style={{ fontWeight: 700, color: '#10b981' }}>+420 m</div>
            </div>
            <div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Avg Pace</div>
              <div style={{ fontWeight: 700, color: '#f59e0b' }}>16'42"</div>
            </div>
          </div>

          {/* Metric Selector Buttons */}
          <div className="hike-metric-buttons">
            <button
              className={`metric-pill ${hikeMetric === 'elevation' ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setHikeMetric('elevation'); }}
            >
              Elevation
            </button>
            <button
              className={`metric-pill ${hikeMetric === 'heartRate' ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setHikeMetric('heartRate'); }}
            >
              Heart Rate
            </button>
            <button
              className={`metric-pill ${hikeMetric === 'pace' ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setHikeMetric('pace'); }}
            >
              Pace
            </button>
          </div>

          {/* Elevation Bar Chart with capsules */}
          <div className="elevation-chart-container">
            {[35, 55, 40, 75, 95, 80, 60, 85, 70, 90, 65, 45].map((h, idx) => (
              <div key={idx} className="chart-bar-wrapper">
                <div
                  className={`chart-bar-fill ${hikeMetric}`}
                  style={{ height: `${h}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      </DeviceFrame>
    );
  }

  // 2.11 Badge & BadgeBackground & BadgeSymbol & RotatedBadgeSymbol
  if (name.includes('Badge') || name.includes('Symbol')) {
    const isSymbolOnly = name.includes('Symbol');
    return (
      <DeviceFrame isMini={isMini} onClick={onClick}>
        <div className="preview-content-scroll centered">
          <div className="badge-hexagon-wrapper">
            <div className={`badge-hexagon ${isSymbolOnly ? 'symbol-mode' : ''}`}>
              <Mountain size={isMini ? 26 : 50} color={isSymbolOnly ? "#f59e0b" : "#38bdf8"} />
              {!isSymbolOnly && <div className="badge-subtitle">2026 Trail Badge</div>}
              {name.includes('Rotated') && (
                <div className="rotated-rays">
                  <div className="ray r1" />
                  <div className="ray r2" />
                  <div className="ray r3" />
                </div>
              )}
            </div>
          </div>
        </div>
      </DeviceFrame>
    );
  }

  // 2.12 LandmarkDetail (Map header + Circle avatar + Info)
  if (name.includes('Detail')) {
    return (
      <DeviceFrame isMini={isMini} onClick={onClick}>
        <div className="preview-content-scroll no-padding">
          {/* Map Header */}
          <div className="landmark-map-header">
            <div className="map-pin-indicator">
              <MapPin size={isMini ? 14 : 20} color="#ef4444" fill="#ef4444" />
            </div>
          </div>

          {/* Overlapping Circle Photo Avatar */}
          <div className="landmark-circle-avatar-wrapper">
            <div className="landmark-avatar-circle">
              <Mountain size={isMini ? 20 : 32} color="#38bdf8" />
            </div>
          </div>

          {/* Details Body */}
          <div className="landmark-detail-body">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="landmark-title">Turtle Rock</div>
              <Star
                size={isMini ? 12 : 16}
                color={isFavorite ? '#eab308' : '#64748b'}
                fill={isFavorite ? '#eab308' : 'none'}
                onClick={(e) => { e.stopPropagation(); setIsFavorite(!isFavorite); }}
                style={{ cursor: 'pointer' }}
              />
            </div>
            <div className="landmark-park">Joshua Tree National Park</div>
            <div className="landmark-state">California</div>
            <div className="ios-divider" style={{ margin: '8px 0' }} />
            <div style={{ fontSize: isMini ? '9px' : '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
              About Turtle Rock
            </div>
            <div style={{ fontSize: isMini ? '8px' : '11px', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
              Descriptive rock formations and natural wilderness trail in Joshua Tree.
            </div>
          </div>
        </div>
      </DeviceFrame>
    );
  }

  // 2.13 LandmarkList (Filter toggle + park items)
  if (name.includes('List')) {
    return (
      <DeviceFrame isMini={isMini} onClick={onClick}>
        <LandmarkListContent
          isMini={isMini}
          favoritesOnly={favoritesOnly}
          setFavoritesOnly={setFavoritesOnly}
        />
      </DeviceFrame>
    );
  }

  // 2.14 MapView
  if (name.includes('Map')) {
    return (
      <DeviceFrame isMini={isMini} onClick={onClick}>
        <div className="interactive-map-view">
          <div className="map-grid-pattern" />
          <div className="map-pin-pulse">
            <MapPin size={isMini ? 22 : 36} color="#ef4444" fill="#ef4444" />
          </div>
          <div className="map-location-badge">
            <Compass size={isMini ? 10 : 14} />
            <span>34.011° N, 116.166° W</span>
          </div>
          <div className="apple-maps-legal">Apple Maps</div>
        </div>
      </DeviceFrame>
    );
  }

  // -------------------------------------------------------------
  // RENDERER 3: Biometric Approval View
  // -------------------------------------------------------------
  if (name.includes('Biometric') || name.includes('Approval')) {
    return (
      <DeviceFrame isMini={isMini} onClick={onClick}>
        <div className="preview-content-scroll centered">
          <div className="biometric-modal-card">
            <div className="faceid-icon-circle">
              <Fingerprint size={isMini ? 26 : 42} color="#c084fc" />
            </div>
            <div className="biometric-title">Biometric Approval</div>
            <div className="biometric-desc">
              Confirm your FaceID before secure token dispatch.
            </div>
            <button
              className="swiftui-btn interactive"
              style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)', marginTop: 8 }}
              onClick={(e) => {
                e.stopPropagation();
                onElementAction?.('approveSession');
              }}
            >
              Approve Session
            </button>
          </div>
        </div>
      </DeviceFrame>
    );
  }

  // -------------------------------------------------------------
  // RENDERER 4: Authentication LoginView (AuthSample)
  // -------------------------------------------------------------
  const tfElement = viewElements?.find((e) => e.type === 'textField');
  const sfElement = viewElements?.find((e) => e.type === 'secureField');
  const btnElement = viewElements?.find((e) => e.type === 'button');

  const emailPlaceholder = tfElement?.label || 'Email';
  const passwordPlaceholder = sfElement?.label || 'Password';
  const buttonLabel = btnElement?.label || 'Sign In';

  return (
    <DeviceFrame isMini={isMini} onClick={onClick}>
      <div className="swiftui-screen-body">
        <div className="app-brand-badge">
          <Lock size={isMini ? 12 : 20} />
        </div>

        <div className="screen-heading">
          <div className="screen-title">{name || 'Sign In'}</div>
          <div className="screen-subtitle">SwiftUI Component</div>
        </div>

        {/* Form Fields */}
        <div className="swiftui-form">
          <div className="swiftui-input" onClick={(e) => e.stopPropagation()}>
            <Mail size={isMini ? 10 : 14} className="input-icon" />
            <input
              className="swiftui-field-input"
              type="text"
              placeholder={emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="swiftui-input" onClick={(e) => e.stopPropagation()}>
            <Lock size={isMini ? 10 : 14} className="input-icon" />
            <input
              className="swiftui-field-input"
              type="password"
              placeholder={passwordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Error Banner */}
          {effectiveVariant === 'error' && (
            <div className="swiftui-error-callout">
              <AlertCircle size={isMini ? 10 : 14} />
              <span>Password must be at least 6 characters.</span>
            </div>
          )}

          {/* Action Button */}
          <button
            type="button"
            className={`swiftui-btn interactive ${effectiveVariant === 'loading' ? 'loading' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onElementAction?.('submit', { email, password });
            }}
            title="Click to trigger dataflow simulation"
            style={{ border: 'none', cursor: 'pointer' }}
          >
            {effectiveVariant === 'loading' ? (
              <div className="spinner-wrapper">
                <Loader2 size={isMini ? 12 : 16} className="spin-animation" />
                {!isMini && <span>Signing In...</span>}
              </div>
            ) : (
              <span>{buttonLabel}</span>
            )}
          </button>
        </div>
      </div>
    </DeviceFrame>
  );
}

// -------------------------------------------------------------
// Sub-Components for CategoryHome & LandmarkList
// -------------------------------------------------------------
function CategoryHomeContent({ isMini, onElementAction }) {
  return (
    <div className="preview-content-scroll no-padding">
      <div className="category-home-nav">
        <span className="cat-nav-title">Featured</span>
        <div className="cat-nav-profile-btn" onClick={(e) => { e.stopPropagation(); onElementAction?.('openProfile'); }}>
          <User size={isMini ? 11 : 16} color="#0ea5e9" />
        </div>
      </div>

      {/* Featured Card */}
      <div className="featured-hero-card">
        <div className="feature-overlay-gradient">
          <div className="feature-hero-badge">Featured</div>
          <div className="feature-hero-title">Lake McDonald</div>
          <div className="feature-hero-sub">Glacier National Park</div>
        </div>
      </div>

      {/* Featured Section */}
      <div className="category-section-block">
        <div className="category-section-heading">Featured Rivers</div>
        <div className="category-horizontal-scroll">
          <div className="category-item-card">
            <div className="cat-img-box river1"><Mountain size={isMini ? 12 : 20} color="#fff" /></div>
            <div className="cat-img-name">Chilkoot Trail</div>
          </div>
          <div className="category-item-card">
            <div className="cat-img-box river2"><Mountain size={isMini ? 12 : 20} color="#fff" /></div>
            <div className="cat-img-name">Silver Salmon</div>
          </div>
        </div>
      </div>

      {/* Lakes Section */}
      <div className="category-section-block">
        <div className="category-section-heading">Featured Lakes</div>
        <div className="category-horizontal-scroll">
          <div className="category-item-card">
            <div className="cat-img-box lake1"><Mountain size={isMini ? 12 : 20} color="#fff" /></div>
            <div className="cat-img-name">Twin Lakes</div>
          </div>
          <div className="category-item-card">
            <div className="cat-img-box lake2"><Mountain size={isMini ? 12 : 20} color="#fff" /></div>
            <div className="cat-img-name">St. Mary Lake</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LandmarkListContent({ isMini, favoritesOnly, setFavoritesOnly }) {
  const landmarks = [
    { id: 1, name: 'Turtle Rock', park: 'Joshua Tree', fav: true },
    { id: 2, name: 'Silver Salmon Creek', park: 'Lake Clark', fav: true },
    { id: 3, name: 'Chilkoot Trail', park: 'Klondike', fav: false },
    { id: 4, name: 'St. Mary Falls', park: 'Glacier', fav: false },
    { id: 5, name: 'Twin Lakes', park: 'Lake Clark', fav: false }
  ];

  return (
    <div className="preview-content-scroll">
      <div className="reminders-header">
        <div className="reminders-title">Landmarks</div>
      </div>

      {/* Favorites only filter row */}
      <div className="ios-card-group" style={{ marginBottom: 8 }}>
        <div
          className="ios-toggle-row"
          onClick={(e) => { e.stopPropagation(); setFavoritesOnly(!favoritesOnly); }}
        >
          <span>Favorites only</span>
          <span className={`ios-switch ${favoritesOnly ? 'on' : 'off'}`} />
        </div>
      </div>

      {/* List */}
      <div className="landmark-list-group">
        {landmarks
          .filter((l) => !favoritesOnly || l.fav)
          .map((l) => (
            <div key={l.id} className="landmark-list-row">
              <div className="landmark-thumb">
                <Mountain size={isMini ? 10 : 14} color="#0ea5e9" />
              </div>
              <div style={{ flex: 1 }}>
                <div className="landmark-row-name">{l.name}</div>
                <div className="landmark-row-park">{l.park}</div>
              </div>
              {l.fav && <Star size={isMini ? 9 : 12} color="#eab308" fill="#eab308" />}
              <ChevronRight size={isMini ? 10 : 14} color="#64748b" />
            </div>
          ))}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Shared Device Bezel Frame
// -------------------------------------------------------------
function DeviceFrame({ isMini, onClick, children }) {
  return (
    <div
      className={`iphone-device-frame ${isMini ? 'frame-mini' : 'frame-full'}`}
      onClick={onClick}
      title={isMini ? 'Click frame to enlarge screen preview' : undefined}
    >
      <div className="device-bezel">
        {/* Dynamic Island */}
        <div className="dynamic-island">
          <div className="camera-lens" />
        </div>

        {/* Status Bar */}
        <div className="ios-status-bar">
          <span className="status-time">9:41</span>
          <div className="status-icons">
            <Signal size={isMini ? 8 : 12} />
            <Wifi size={isMini ? 8 : 12} />
            <Battery size={isMini ? 9 : 14} />
          </div>
        </div>

        {/* Nested Screen Layout */}
        <div className="device-screen-scroll-container">
          {children}
        </div>

        {/* Home Indicator */}
        <div className="home-indicator" />
      </div>
    </div>
  );
}
