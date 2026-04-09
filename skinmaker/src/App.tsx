import React, { useState, useCallback } from 'react'
import './App.css'

interface Token {
  name: string
  label: string
  default: string
  group: string
}

interface PresetSkin {
  key: string
  name: string
  category: 'light' | 'dark'
  bg: string
  accent: string
  surface: string
  surface2: string
  mood: string[]
}

const KNOWN_TOKEN_NAMES = new Set<string>()

const PRESET_SKINS: PresetSkin[] = [
  { key: 'nordic-glass', name: 'Nordic Glass', category: 'dark', bg: '#090e14', accent: '#00d4c8', surface: 'rgba(16,28,38,0.68)', surface2: 'rgba(20,34,46,0.76)', mood: ['quiet', 'architectural'] },
  { key: 'graphite-hifi', name: 'Graphite Hi-Fi', category: 'dark', bg: '#060a0d', accent: '#00e5ff', surface: 'rgba(10,18,24,0.76)', surface2: 'rgba(14,24,32,0.82)', mood: ['machined', 'audio'] },
  { key: 'champagne-studio', name: 'Champagne Studio', category: 'light', bg: '#f2ede3', accent: '#c48060', surface: 'rgba(255,252,248,0.82)', surface2: 'rgba(245,238,228,0.8)', mood: ['warm', 'editorial'] },
  { key: 'emerald-atelier', name: 'Emerald Atelier', category: 'dark', bg: '#0a120a', accent: '#8ab878', surface: 'rgba(18,26,16,0.74)', surface2: 'rgba(22,32,20,0.8)', mood: ['crafted', 'calm'] },
  { key: 'ember-night', name: 'Ember Night', category: 'dark', bg: '#0a0606', accent: '#e87840', surface: 'rgba(18,12,10,0.74)', surface2: 'rgba(24,16,12,0.8)', mood: ['dramatic', 'focused'] },
  { key: 'ink-and-stone', name: 'Ink & Stone', category: 'light', bg: '#f4efe4', accent: '#49615c', surface: '#fbf8f0', surface2: '#e8e0d0', mood: ['neutral', 'classic'] },
  { key: 'warm-analog', name: 'Warm Analog', category: 'light', bg: '#f7f0e5', accent: '#bc6c25', surface: '#fff8ef', surface2: '#f1e3d0', mood: ['warm', 'familiar'] },
  { key: 'midnight-neon', name: 'Midnight Neon', category: 'dark', bg: '#091017', accent: '#31f0c8', surface: '#101c29', surface2: '#132434', mood: ['electric', 'cyber'] },
  { key: 'classic-noir', name: 'Classic Noir', category: 'dark', bg: '#0a0a0a', accent: '#d4af37', surface: '#141414', surface2: '#1e1e1e', mood: ['gold', 'elegant'] },
]

const TOKEN_GROUPS = [
  {
    label: 'Background',
    key: 'bg',
    tokens: [
      { name: '--bg-app', label: 'App Background', default: '#f7f0e5', group: 'bg' },
      { name: '--bg-gradient', label: 'Background Gradient', default: '', group: 'bg' },
      { name: '--bg-vignette', label: 'Background Vignette', default: '', group: 'bg' },
    ]
  },
  {
    label: 'Glass Surfaces',
    key: 'surface',
    tokens: [
      { name: '--surface', label: 'Card Surface', default: '#fff8ef', group: 'surface' },
      { name: '--surface-2', label: 'Elevated Surface', default: '#f1e3d0', group: 'surface' },
      { name: '--surface-3', label: 'Recessed Surface', default: '#e8dcc8', group: 'surface' },
      { name: '--surface-glass-blur', label: 'Glass Blur', default: '', group: 'surface' },
      { name: '--surface-inner-light', label: 'Inner Light', default: '', group: 'surface' },
      { name: '--surface-inner-highlight', label: 'Top Highlight', default: '', group: 'surface' },
      { name: '--surface-specular', label: 'Specular Highlight', default: '', group: 'surface' },
      { name: '--surface-edge-light', label: 'Edge Light', default: '', group: 'surface' },
    ]
  },
  {
    label: 'Borders & Edges',
    key: 'border',
    tokens: [
      { name: '--border', label: 'Border', default: '#d7b99a', group: 'border' },
      { name: '--border-subtle', label: 'Subtle Border', default: '#d7b99a', group: 'border' },
      { name: '--border-strong', label: 'Strong Border', default: '#a37f58', group: 'border' },
      { name: '--highlight-rim', label: 'Rim Highlight', default: 'rgba(255,255,255,0.12)', group: 'border' },
    ]
  },
  {
    label: 'Depth & Shadows',
    key: 'shadow',
    tokens: [
      { name: '--shadow-soft', label: 'Soft Shadow', default: '0 4px 16px rgba(98,55,16,0.12)', group: 'shadow' },
      { name: '--shadow-elevated', label: 'Elevated Shadow', default: '0 10px 32px rgba(98,55,16,0.16)', group: 'shadow' },
      { name: '--shadow-floating', label: 'Floating Shadow', default: '0 20px 56px rgba(98,55,16,0.2)', group: 'shadow' },
      { name: '--shadow-inset', label: 'Inset Shadow', default: 'inset 0 2px 6px rgba(0,0,0,0.08)', group: 'shadow' },
    ]
  },
  {
    label: 'Primary Text',
    key: 'text',
    tokens: [
      { name: '--text', label: 'Text', default: '#3d3128', group: 'text' },
      { name: '--text-primary', label: 'Text Primary', default: '#3d3128', group: 'text' },
      { name: '--text-muted', label: 'Muted Text', default: '#736154', group: 'text' },
      { name: '--text-secondary', label: 'Text Secondary', default: '#736154', group: 'text' },
      { name: '--text-inverted', label: 'Inverted Text', default: '#fffaf5', group: 'text' },
      { name: '--text-disabled', label: 'Disabled Text', default: '#9f907d', group: 'text' },
      { name: '--text-link', label: 'Link', default: '#8d4a0f', group: 'text' },
    ]
  },
  {
    label: 'Accent',
    key: 'accent',
    tokens: [
      { name: '--accent', label: 'Primary Accent', default: '#bc6c25', group: 'accent' },
      { name: '--accent-soft', label: 'Soft Accent', default: 'rgba(188,108,37,0.15)', group: 'accent' },
      { name: '--accent-glow', label: 'Accent Glow', default: 'rgba(188,108,37,0.25)', group: 'accent' },
      { name: '--focus-ring', label: 'Focus Ring', default: 'rgba(188,108,37,0.3)', group: 'accent' },
    ]
  },
  {
    label: 'State Indicators',
    key: 'state',
    tokens: [
      { name: '--state-ok', label: 'OK / Success', default: '#4f7b5a', group: 'state' },
      { name: '--state-completed', label: 'Completed', default: '#4f7b5a', group: 'state' },
      { name: '--state-warn', label: 'Warning', default: '#c27a20', group: 'state' },
      { name: '--state-overdue', label: 'Overdue', default: '#b63f2a', group: 'state' },
      { name: '--state-conflict', label: 'Conflict', default: '#8b3d88', group: 'state' },
      { name: '--state-readonly', label: 'Read Only', default: '#8a7b6d', group: 'state' },
      { name: '--state-drag-active', label: 'Drag Active', default: '#bc6c25', group: 'state' },
      { name: '--state-drop-target', label: 'Drop Target', default: 'rgba(188,108,37,0.2)', group: 'state' },
    ]
  },
  {
    label: 'Calendar & Events',
    key: 'calendar',
    tokens: [
      { name: '--timeline-now', label: 'Timeline Now', default: '#bc6c25', group: 'calendar' },
      { name: '--calendar-grid-line', label: 'Grid Line', default: '#d7b99a', group: 'calendar' },
      { name: '--day-today-ring', label: 'Today Ring', default: '#bc6c25', group: 'calendar' },
      { name: '--event-default', label: 'Event Block', default: '#cf8a4d', group: 'calendar' },
      { name: '--task-default', label: 'Task Block', default: '#8c6249', group: 'calendar' },
      { name: '--reminder-default', label: 'Reminder', default: '#f09e5c', group: 'calendar' },
      { name: '--busy-block-hint', label: 'Busy Hint', default: 'rgba(188,108,37,0.16)', group: 'calendar' },
      { name: '--free-slot-hint', label: 'Free Hint', default: 'rgba(73,97,92,0.12)', group: 'calendar' },
      { name: '--selected-range', label: 'Selected Range', default: 'rgba(188,108,37,0.2)', group: 'calendar' },
    ]
  },
  {
    label: 'Navigation',
    key: 'nav',
    tokens: [
      { name: '--nav-rail-fill', label: 'Rail Fill', default: '#f0ebe0', group: 'nav' },
      { name: '--nav-rail-glass-blur', label: 'Rail Blur', default: '', group: 'nav' },
      { name: '--topbar-glass-blur', label: 'Topbar Blur', default: '', group: 'nav' },
      { name: '--nav-item-fill', label: 'Item Fill', default: '#fff8ef', group: 'nav' },
      { name: '--nav-item-hover', label: 'Item Hover', default: '#f1e3d0', group: 'nav' },
      { name: '--nav-item-active', label: 'Item Active', default: '#bc6c25', group: 'nav' },
      { name: '--nav-item-active-glow', label: 'Active Glow', default: 'rgba(188,108,37,0.2)', group: 'nav' },
      { name: '--nav-item-text', label: 'Item Text', default: '#736154', group: 'nav' },
      { name: '--nav-item-active-text', label: 'Active Text', default: '#fffaf5', group: 'nav' },
    ]
  },
  {
    label: 'Icon Wells',
    key: 'icon',
    tokens: [
      { name: '--icon-tile-fill', label: 'Tile Fill', default: '#f1e3d0', group: 'icon' },
      { name: '--icon-tile-active', label: 'Tile Active', default: '#bc6c25', group: 'icon' },
      { name: '--icon-tile-glow', label: 'Tile Glow', default: 'rgba(188,108,37,0.15)', group: 'icon' },
    ]
  },
  {
    label: 'Buttons',
    key: 'button',
    tokens: [
      { name: '--button-primary-fill', label: 'Primary Fill', default: '#bc6c25', group: 'button' },
      { name: '--button-primary-edge', label: 'Primary Edge', default: '#a05018', group: 'button' },
      { name: '--button-primary-glow', label: 'Primary Glow', default: '', group: 'button' },
      { name: '--button-primary-text', label: 'Primary Text', default: '#fffaf5', group: 'button' },
      { name: '--button-secondary-fill', label: 'Secondary Fill', default: '#f1e3d0', group: 'button' },
      { name: '--button-secondary-edge', label: 'Secondary Edge', default: '#d7b99a', group: 'button' },
      { name: '--button-secondary-text', label: 'Secondary Text', default: '', group: 'button' },
      { name: '--button-quiet-fill', label: 'Quiet Fill', default: 'transparent', group: 'button' },
      { name: '--button-quiet-text', label: 'Quiet Text', default: '', group: 'button' },
      { name: '--button-pressed-fill', label: 'Pressed Fill', default: '#e8dcc8', group: 'button' },
    ]
  },
  {
    label: 'Overlays & Modals',
    key: 'modal',
    tokens: [
      { name: '--modal-fill', label: 'Modal Fill', default: '#fff8ef', group: 'modal' },
      { name: '--modal-glass-blur', label: 'Modal Blur', default: '', group: 'modal' },
      { name: '--modal-edge', label: 'Modal Edge', default: '#d7b99a', group: 'modal' },
      { name: '--modal-inner-light', label: 'Modal Inner Light', default: '', group: 'modal' },
      { name: '--overlay-backdrop', label: 'Overlay Backdrop', default: 'rgba(40,30,20,0.55)', group: 'modal' },
      { name: '--overlay-blur', label: 'Overlay Blur', default: 'blur(8px)', group: 'modal' },
    ]
  },
]

TOKEN_GROUPS.forEach(group => {
  group.tokens.forEach(token => {
    KNOWN_TOKEN_NAMES.add(token.name)
  })
})

function buildInitialValues() {
  const values: Record<string, string> = {}
  TOKEN_GROUPS.forEach(group => {
    group.tokens.forEach(token => {
      values[token.name] = token.default
    })
  })
  return values
}

function inferCategoryFromColor(value: string): 'light' | 'dark' {
  const rgb = rgbaToRgb(value)
  const match = rgb.match(/rgb\((\d+),(\d+),(\d+)\)/)
  if (!match) {
    const hex = rgb.startsWith('#') ? rgb.slice(1) : ''
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
      return luminance > 0.62 ? 'light' : 'dark'
    }
    return 'dark'
  }
  const r = parseInt(match[1], 10)
  const g = parseInt(match[2], 10)
  const b = parseInt(match[3], 10)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance > 0.62 ? 'light' : 'dark'
}

function App() {
  const [values, setValues] = useState<Record<string, string>>(buildInitialValues)
  const [passthroughVars, setPassthroughVars] = useState<Record<string, string>>({})
  const [skinName, setSkinName] = useState('my-custom-skin')
  const [activeSkin, setActiveSkin] = useState<string | null>(null)
  const [showExport, setShowExport] = useState(false)
  const [exportFormat, setExportFormat] = useState<'json' | 'css'>('json')
  const [copied, setCopied] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [layoutDensity, setLayoutDensity] = useState<'compact' | 'comfortable' | 'expanded'>('comfortable')

  const textMuted = values['--text-muted'] || '#736154'
  const text1 = values['--text'] || '#3d3128'

  const handleValueChange = useCallback((name: string, value: string) => {
    setValues(prev => ({ ...prev, [name]: value }))
    setPassthroughVars(prev => {
      if (!(name in prev)) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
    setActiveSkin(null)
  }, [])

  const applySkin = useCallback((preset: PresetSkin) => {
    const jsonPath = `/skins/${preset.key}.json`
    fetch(jsonPath)
      .then(r => r.json())
      .then(skin => {
        const newValues: Record<string, string> = { ...buildInitialValues() }
        const extraVars: Record<string, string> = {}
        Object.entries(skin.vars).forEach(([k, v]) => { newValues[k] = v as string })
        Object.entries(skin.vars).forEach(([k, v]) => {
          if (!KNOWN_TOKEN_NAMES.has(k)) extraVars[k] = v as string
        })
        setValues(newValues)
        setPassthroughVars(extraVars)
        setActiveSkin(preset.key)
        setSkinName(skin.name || preset.key)
      })
      .catch(() => {
        const isDark = preset.category === 'dark'
        const bg = preset.bg
        const surface = preset.surface
        const surface2 = preset.surface2
        const text = isDark ? '#e4e4ec' : '#3d3128'
        const muted = isDark ? '#8888a0' : '#736154'
        const inv = isDark ? '#0a0a0e' : '#fffaf5'
        setValues({
          ...buildInitialValues(),
          '--bg-app': bg,
          '--surface': surface,
          '--surface-2': surface2,
          '--text': text,
          '--text-primary': text,
          '--text-muted': muted,
          '--text-secondary': muted,
          '--text-inverted': inv,
          '--accent': preset.accent,
          '--accent-soft': preset.accent + '22',
          '--nav-rail-fill': isDark ? 'rgba(6,8,14,0.97)' : 'rgba(238,230,218,0.95)',
          '--nav-item-fill': surface,
          '--nav-item-active': preset.accent,
          '--nav-item-text': muted,
          '--nav-item-active-text': inv,
        })
        setPassthroughVars({})
        setActiveSkin(preset.key)
        setSkinName(preset.name)
      })
  }, [])

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const generateCSS = useCallback(() => {
    let css = `[data-skin="${skinName.toLowerCase().replace(/\s+/g, '-')}"] {\n`
    TOKEN_GROUPS.forEach(group => {
      group.tokens.forEach(token => {
        const v = values[token.name] || token.default
        if (v) css += `  ${token.name}: ${v};\n`
      })
    })
    Object.entries(passthroughVars).forEach(([key, value]) => {
      if (value) css += `  ${key}: ${value};\n`
    })
    css += `}\n`
    return css
  }, [passthroughVars, skinName, values])

  const generateJSON = useCallback(() => {
    const obj: Record<string, string> = {}
    TOKEN_GROUPS.forEach(group => {
      group.tokens.forEach(token => {
        const v = values[token.name] || token.default
        if (v) obj[token.name] = v
      })
    })
    Object.entries(passthroughVars).forEach(([key, value]) => {
      if (!(key in obj) && value) obj[key] = value
    })
    return JSON.stringify({
      id: skinName.toLowerCase().replace(/\s+/g, '-'),
      author: 'custom',
      version: '1.0.0',
      name: skinName,
      category: inferCategoryFromColor(values['--bg-app'] || values['--surface'] || '#151d24'),
      preview: {
        bg: values['--bg-app'] || '#f5f0e8',
        accent: values['--accent'] || '#bc6c25',
        surface: rgbaToRgb(values['--surface'] || '#fff8ef'),
      },
      vars: obj,
    }, null, 2)
  }, [passthroughVars, skinName, values])

  const copyExport = useCallback(() => {
    const text = exportFormat === 'json' ? generateJSON() : generateCSS()
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [exportFormat, generateJSON, generateCSS])

  const validateSkin = useCallback(() => {
    const issues: { category: string; label: string; status: 'pass' | 'warn' | 'fail'; detail: string }[] = []
    const bg = values['--bg-app'] || ''
    const surface = values['--surface'] || ''
    const accent = values['--accent'] || ''
    const text = values['--text'] || ''
    const textMuted = values['--text-muted'] || ''
    const navItemText = values['--nav-item-text'] || ''
    const navItemActive = values['--nav-item-active'] || ''
    const navItemActiveText = values['--nav-item-active-text'] || ''
    const btnPri = values['--button-primary-fill'] || ''
    const btnPriText = values['--button-primary-text'] || ''
    const stateOk = values['--state-ok'] || ''
    const stateOver = values['--state-overdue'] || ''

    const getLuminance = (c: string) => {
      if (!c.startsWith('#') || c.length < 7) return 0.5
      const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16)
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    }

    const checkContrast = (fg: string, bgC: string, min = 4.5) => {
      if (!fg || !bgC) return 'warn'
      const l1 = getLuminance(fg), l2 = getLuminance(bgC)
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
      return ratio >= min ? 'pass' : ratio >= 3 ? 'warn' : 'fail'
    }

    if (bg) {
      const cat = inferCategoryFromColor(bg)
      issues.push({ category: 'contrast', label: 'Background contrast', status: 'pass', detail: `Detected ${cat} category from background` })
    }

    issues.push({ category: 'contrast', label: 'Primary text on bg', status: checkContrast(text, bg) as any, detail: text && bg ? `Text #${text.slice(0, 6)} on bg #${bg.slice(0, 6)}` : 'Missing text or bg token' })
    issues.push({ category: 'contrast', label: 'Muted text on bg', status: checkContrast(textMuted, bg, 3) as any, detail: 'WCAG AA for small text' })

    issues.push({ category: 'contrast', label: 'Accent on background', status: checkContrast(accent, bg, 3) as any, detail: accent ? `#${accent.slice(0, 6)}` : 'Missing accent' })

    issues.push({ category: 'accessibility', label: 'Nav item text', status: checkContrast(navItemText, navItemActive) as any, detail: 'Active nav item readability' })
    issues.push({ category: 'accessibility', label: 'Active nav text', status: checkContrast(navItemActiveText, navItemActive) as any, detail: 'Active nav item text contrast' })

    issues.push({ category: 'buttons', label: 'Primary button', status: checkContrast(btnPriText, btnPri) as any, detail: 'Button text on fill' })

    issues.push({ category: 'state', label: 'Completed state', status: stateOk ? 'pass' : 'warn', detail: stateOk ? `Completed #${stateOk.slice(0, 6)}` : 'Missing --state-ok' })
    issues.push({ category: 'state', label: 'Overdue state', status: stateOver ? 'pass' : 'warn', detail: stateOver ? `Overdue #${stateOver.slice(0, 6)}` : 'Missing --state-overdue' })

    return issues
  }, [values])

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">D</div>
            <div className="logo-text">DopaFlow <span>SkinMaker</span></div>
          </div>
          <input
            type="text"
            className="skin-name-input"
            value={skinName}
            onChange={e => setSkinName(e.target.value)}
            placeholder="Skin name..."
          />
        </div>

        <div className="section-label">Quick Start Skins</div>
        <div className="skin-presets">
          {PRESET_SKINS.map(skin => (
            <button
              key={skin.key}
              className={`skin-preset-btn ${activeSkin === skin.key ? 'active' : ''}`}
              onClick={() => applySkin(skin)}
            >
              <div className="skin-preset-swatch" style={{ background: skin.bg }}>
                <div className="swatch-accent" style={{ background: skin.accent }} />
                <div className="swatch-surface" style={{ background: skin.surface }} />
              </div>
              <div className="skin-preset-info">
                <span className="skin-preset-name">{skin.name}</span>
                <span className="skin-preset-cat">{skin.category}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="token-sections">
          {TOKEN_GROUPS.map(group => (
            <div key={group.key} className="token-group">
              <button className="group-header" onClick={() => toggleGroup(group.key)}>
                <span className="group-label">{group.label}</span>
                <span className="group-count">{group.tokens.length}</span>
                <span className={`group-chevron ${collapsedGroups.has(group.key) ? 'collapsed' : ''}`}>▾</span>
              </button>
              {!collapsedGroups.has(group.key) && (
                <div className="token-rows">
                  {group.tokens.map(token => (
                    <ColorRow
                      key={token.name}
                      token={token}
                      value={values[token.name] || token.default}
                      onChange={v => handleValueChange(token.name, v)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="export-controls">
            <select
              className="export-format-select"
              value={exportFormat}
              onChange={e => setExportFormat(e.target.value as 'json' | 'css')}
            >
              <option value="json">JSON Skin File</option>
              <option value="css">CSS Variables</option>
            </select>
            <button className="export-btn" onClick={() => setShowExport(true)}>
              Export
            </button>
          </div>
        </div>
      </aside>

      <main className="preview">
        <PreviewPanel values={values} layoutDensity={layoutDensity} onDensityChange={setLayoutDensity} />
      </main>

      {showExport && (
        <div className="modal-overlay" onClick={() => setShowExport(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Export — {skinName}</h2>
              <div className="modal-tabs">
                <button className={`modal-tab ${exportFormat === 'json' ? 'active' : ''}`} onClick={() => setExportFormat('json')}>JSON</button>
                <button className={`modal-tab ${exportFormat === 'css' ? 'active' : ''}`} onClick={() => setExportFormat('css')}>CSS</button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, flex: 1 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ship-Ready Checklist</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, overflowY: 'auto' }}>
                  {validateSkin().map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', borderRadius: 6,
                      background: item.status === 'pass' ? 'rgba(79,123,90,0.12)' : item.status === 'warn' ? 'rgba(194,122,32,0.12)' : 'rgba(182,63,42,0.12)',
                      border: `1px solid ${item.status === 'pass' ? 'rgba(79,123,90,0.3)' : item.status === 'warn' ? 'rgba(194,122,32,0.3)' : 'rgba(182,63,42,0.3)'}`,
                    }}>
                      <span style={{
                        width: 16, height: 16, borderRadius: 4,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: item.status === 'pass' ? 'rgba(79,123,90,0.8)' : item.status === 'warn' ? 'rgba(194,122,32,0.8)' : 'rgba(182,63,42,0.8)',
                        color: '#fff', fontSize: 9, fontWeight: 700,
                      }}>
                        {item.status === 'pass' ? '✓' : item.status === 'warn' ? '!' : '✗'}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: text1 }}>{item.label}</div>
                        <div style={{ fontSize: 10, color: textMuted }}>{item.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <textarea readOnly value={exportFormat === 'json' ? generateJSON() : generateCSS()} style={{ flex: 1 }} />
            </div>
            <div className="modal-actions">
              <button className="modal-btn secondary" onClick={() => setShowExport(false)}>Close</button>
              <button className="modal-btn primary" onClick={copyExport}>
                {copied ? '✓ Copied!' : 'Copy to Clipboard'}
              </button>
            </div>
          </div>
        </div>
      )}

      {copied && <div className="toast">Copied to clipboard!</div>}
    </div>
  )
}

function rgbaToRgb(value: string): string {
  if (value.startsWith('hsla') || value.startsWith('hsl')) {
    return '#888888'
  }
  if (!value.startsWith('rgba') && !value.startsWith('rgb')) return value.startsWith('#') ? value.slice(0, 7) : value
  const parts = value.replace(/rgba?\(|\)/g, '').split(',')
  const r = parseInt(parts[0].trim(), 10)
  const g = parseInt(parts[1].trim(), 10)
  const b = parseInt(parts[2].trim(), 10)
  return `rgb(${r},${g},${b})`
}

function ColorRow({ token, value, onChange }: { token: Token; value: string; onChange: (v: string) => void }) {
  const isRgba = value.startsWith('rgba') || value.startsWith('rgb') || value.startsWith('hsla') || value.includes('gradient')
  const displayColor = value.includes('gradient') ? value.split(',')[0].trim() : (isRgba ? rgbaToRgb(value) : value.startsWith('#') ? value.slice(0, 7) : '#888888')

  return (
    <div className="color-row">
      <div className="color-preview" style={{ background: isRgba && !value.includes('gradient') ? value : displayColor }}>
        <input
          type="color"
          value={isRgba ? '#000000' : displayColor}
          onChange={e => onChange(e.target.value)}
        />
      </div>
      <div className="color-info">
        <div className="color-name">{token.label}</div>
        <div className="color-value">{value || token.default}</div>
      </div>
    </div>
  )
}

function GlassCard({ children, values, style = {} }: { children: React.ReactNode; values: Record<string, string>; style?: React.CSSProperties }) {
  const surface = values['--surface'] || '#fff8ef'
  const blur = values['--surface-glass-blur'] || ''
  const innerLight = values['--surface-inner-light'] || ''
  const innerHighlight = values['--surface-inner-highlight'] || ''
  const specular = values['--surface-specular'] || ''
  const border = values['--border-subtle'] || values['--border'] || '#d7b99a'
  const shadow = values['--shadow-elevated'] || '0 10px 32px rgba(98,55,16,0.16)'
  const rim = values['--surface-edge-light'] || values['--highlight-rim'] || ''

  return (
    <div
      className="glass-card"
      style={{
        background: surface,
        backdropFilter: blur,
        WebkitBackdropFilter: blur,
        border: `1px solid ${border}`,
        boxShadow: shadow,
        borderRadius: 14,
        position: 'relative',
        overflow: 'hidden',
        ...style,
      } as React.CSSProperties}
    >
      {innerLight && <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: innerLight, borderRadius: 'inherit',
      }} />}
      {innerHighlight && <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '35%',
        pointerEvents: 'none', background: innerHighlight,
        borderRadius: 'inherit',
      }} />}
      {specular && <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
        pointerEvents: 'none', background: specular,
        borderRadius: '14px 14px 0 0',
      }} />}
      {rim && <div style={{
        position: 'absolute', top: 0, left: '8%', right: '8%', height: '1px',
        pointerEvents: 'none', background: rim.startsWith('linear-gradient') ? rim : `linear-gradient(90deg, transparent, ${rim}, transparent)`,
      }} />}
      {children}
    </div>
  )
}

function PreviewPanel({ values, layoutDensity = 'comfortable', onDensityChange }: { values: Record<string, string>; layoutDensity?: 'compact' | 'comfortable' | 'expanded'; onDensityChange?: (d: 'compact' | 'comfortable' | 'expanded') => void }) {
  const v = (name: string, fallback: string) => values[name] || fallback

  const density = {
    compact: { cardPad: 12, rowPad: 8, itemGap: 4, fontScale: 0.92 },
    comfortable: { cardPad: 20, rowPad: 12, itemGap: 8, fontScale: 1 },
    expanded: { cardPad: 28, rowPad: 16, itemGap: 12, fontScale: 1.08 },
  }[layoutDensity]

  React.useEffect(() => {
    const handler = (e: CustomEvent) => onDensityChange?.(e.detail)
    window.addEventListener('densityChange', handler as EventListener)
    return () => window.removeEventListener('densityChange', handler as EventListener)
  }, [onDensityChange])

  const bg = v('--bg-app', '#0e0e14')
  const bgGrad = v('--bg-gradient', '')
  const surface2 = v('--surface-2', '#1e2530')
  const surface3 = v('--surface-3', '#232e38')
  const border = v('--border', '#2a3a48')
  const borderSub = v('--border-subtle', '#1e2d3a')
  const text1 = v('--text', '#e4eff4')
  const textMuted = v('--text-muted', '#7a9aaa')
  const textInv = v('--text-inverted', '#0a0f14')
  const accent = v('--accent', '#00d4c8')
  const accentSoft = v('--accent-soft', 'rgba(0,212,200,0.15)')

  const navRail = v('--nav-rail-fill', 'rgba(7,10,14,0.95)')
  const navBlur = v('--nav-rail-glass-blur', 'blur(20px)')
  const navHover = v('--nav-item-hover', 'rgba(28,45,58,0.7)')
  const navActive = v('--nav-item-active', accent)
  const navGlow = v('--nav-item-active-glow', 'rgba(0,212,200,0.25)')
  const navText = v('--nav-item-text', '#6a94aa')
  const navActText = v('--nav-item-active-text', '#060a0e')

  const btnPri = v('--button-primary-fill', accent)
  const btnPriEdge = v('--button-primary-edge', 'rgba(0,212,200,0.4)')
  const btnPriGlow = v('--button-primary-glow', '0 0 20px rgba(0,212,200,0.25)')
  const btnSec = v('--button-secondary-fill', surface2)
  const btnSecEdge = v('--button-secondary-edge', border)
  const btnQuiet = v('--button-quiet-fill', 'transparent')

  const stateOk = v('--state-ok', '#3ecfa0')
  const stateOver = v('--state-overdue', '#ff6b5a')

  const topbarBg = v('--nav-rail-fill', navRail)
  const topbarBlur = v('--topbar-glass-blur', navBlur)

  return (
    <div className="preview-root" style={{
      minHeight: '100vh',
      background: bgGrad || bg,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Atmospheric background layers */}
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 20% 0%, rgba(30,50,70,0.3) 0%, transparent 50%)` }} />
      <div style={{ position: 'absolute', inset: 0, backdropFilter: 'blur(1px)' }} />

      <div className="preview-shell">
        {/* Layout density controls */}
        <div style={{
          position: 'absolute', top: 12, right: 12, zIndex: 200,
          display: 'flex', gap: 4, padding: 4,
          background: surface2, borderRadius: 8, border: `1px solid ${borderSub}`,
        }}>
          {(['compact', 'comfortable', 'expanded'] as const).map(d => (
            <button
              key={d}
              onClick={() => onDensityChange?.(d)}
              style={{
                padding: '4px 10px', borderRadius: 6,
                fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                background: layoutDensity === d ? accent : 'transparent',
                color: layoutDensity === d ? textInv : textMuted,
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {d[0].toUpperCase()}
            </button>
          ))}
        </div>
        {/* Top bar — frosted glass strip */}
        <div className="topbar" style={{
          background: topbarBg,
          backdropFilter: topbarBlur,
          WebkitBackdropFilter: topbarBlur,
          borderBottom: `1px solid ${borderSub}`,
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: textInv,
              boxShadow: btnPriGlow,
            }}>D</div>
            <span style={{ fontSize: 14, fontWeight: 600, color: text1 }}>Today</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              padding: '4px 12px', borderRadius: 12,
              background: accentSoft, color: accent,
              fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent, boxShadow: `0 0 8px ${accent}` }} />
              Focus Mode
            </div>
            <div style={{ padding: '4px 10px', borderRadius: 12, background: surface2, color: textMuted, fontSize: 11, fontWeight: 500 }}>14:32</div>
          </div>
        </div>

        {/* Main body */}
        <div className="preview-body" style={{ display: 'flex', flex: 1 }}>
          {/* Sidebar — vertical frosted dock */}
          <div className="sidebar-panel" style={{
            width: 200,
            background: navRail,
            backdropFilter: navBlur,
            WebkitBackdropFilter: navBlur,
            borderRight: `1px solid ${borderSub}`,
            padding: '16px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            flexShrink: 0,
          }}>
            {[
              { label: 'Today', icon: '◈', active: true },
              { label: 'Tasks', icon: '☐', active: false },
              { label: 'Habits', icon: '◉', active: false },
              { label: 'Calendar', icon: '◇', active: false },
              { label: 'Focus', icon: '◎', active: false },
              { label: 'Journal', icon: '✎', active: false },
            ].map((item, i) => (
              <div key={item.label} className="nav-item" style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 10,
                background: item.active ? navActive : (i === 1 ? navHover : 'transparent'),
                color: item.active ? navActText : navText,
                cursor: 'pointer',
                transition: 'all 0.15s',
                boxShadow: item.active ? `0 0 16px ${navGlow}` : 'none',
                fontSize: 13, fontWeight: item.active ? 600 : 500,
              }}>
                <span style={{
                  width: 20, height: 20, borderRadius: 5,
                  background: item.active ? navActText : 'currentColor',
                  opacity: item.active ? 1 : 0.45,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10,
                }}>{item.icon}</span>
                {item.label}
              </div>
            ))}
            <div style={{ marginTop: 'auto' }}>
              <div className="nav-item" style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 10,
                color: navText, cursor: 'pointer',
                fontSize: 13, fontWeight: 500,
              }}>
                <span style={{ width: 20, height: 20, borderRadius: 5, opacity: 0.45, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>⚙</span>
                Settings
              </div>
            </div>
          </div>

          {/* Content area */}
          <div className="content-area" style={{ flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Today's tasks — main card */}
            <GlassCard values={values} style={{ padding: density.cardPad }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: density.cardPad * 0.8 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: text1 }}>Today — Monday</div>
                  <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>Spring 2025 · Week 14</div>
                </div>
                <div style={{ fontSize: 12, background: accentSoft, padding: '4px 12px', borderRadius: 10, color: accent }}>3 of 7 complete</div>
              </div>

              {[
                { text: 'Review quarterly goals with design team', done: true, priority: 'low' },
                { text: 'Write API documentation for v2 endpoints', done: true, priority: 'low' },
                { text: 'Prepare stakeholder presentation slides', done: true, priority: 'medium' },
                { text: 'Respond to vendor RFP — deadline today', done: false, priority: 'high', urgent: true },
                { text: 'Update task priorities in project tracker', done: false, priority: 'medium' },
                { text: 'Schedule follow-up with design team', done: false, priority: 'low' },
              ].map((task, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: density.rowPad, borderRadius: 10,
                  background: surface2,
                  marginBottom: density.itemGap,
                  opacity: task.done ? 0.55 : 1,
                  border: `1px solid ${borderSub}`,
                  transition: 'all 0.15s',
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                    background: task.done ? stateOk : 'transparent',
                    border: task.done ? 'none' : `2px solid ${border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: task.done ? `0 0 10px ${stateOk}50` : 'none',
                  }}>
                    {task.done && <span style={{ color: textInv, fontSize: 11 }}>✓</span>}
                  </div>
                  <span style={{
                    fontSize: 13 * density.fontScale, color: task.done ? textMuted : text1,
                    textDecoration: task.done ? 'line-through' : 'none',
                    flex: 1,
                  }}>{task.text}</span>
                  {task.urgent && !task.done && (
                    <span style={{
                      fontSize: 9, padding: '3px 8px', fontWeight: 700,
                      background: stateOver + '25', color: stateOver,
                      borderRadius: 5, letterSpacing: '0.5px',
                      border: `1px solid ${stateOver}40`,
                    }}>OVERDUE</span>
                  )}
                  {!task.urgent && !task.done && task.priority === 'high' && (
                    <span style={{ fontSize: 9, padding: '3px 8px', fontWeight: 600, background: accentSoft, color: accent, borderRadius: 5 }}>HIGH</span>
                  )}
                </div>
              ))}

              {/* Quick add bar */}
              <div style={{
                display: 'flex', gap: 8, marginTop: 12,
                padding: '10px 12px', borderRadius: 10,
                background: surface3, border: `1px dashed ${border}`,
              }}>
                <span style={{ color: textMuted, fontSize: 14, lineHeight: '20px' }}>+</span>
                <span style={{ color: textMuted, fontSize: 13, lineHeight: '20px' }}>Add a task...</span>
              </div>
            </GlassCard>

            {/* Stats + actions row */}
            <div style={{ display: 'flex', gap: 14 }}>
              <GlassCard values={values} style={{ flex: 1, padding: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.8px' }}>This Week</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {[
                    { val: '12', label: 'Tasks', accent: false },
                    { val: '4', label: 'Streak', accent: true },
                    { val: '6.2h', label: 'Focus', accent: false },
                  ].map(stat => (
                    <div key={stat.label} style={{
                      background: surface2, borderRadius: 10, padding: '14px 8px',
                      textAlign: 'center', border: `1px solid ${borderSub}`,
                    }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: stat.accent ? accent : text1 }}>{stat.val}</div>
                      <div style={{ fontSize: 10, color: textMuted, marginTop: 4 }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
              </GlassCard>

              <GlassCard values={values} style={{ flex: 1, padding: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Quick Actions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button style={{
                    width: '100%', padding: '11px 14px',
                    background: btnPri, color: textInv,
                    border: `1px solid ${btnPriEdge}`,
                    borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    boxShadow: btnPriGlow,
                  }}>+ Add Task</button>
                  <button style={{
                    width: '100%', padding: '11px 14px',
                    background: btnSec, color: text1,
                    border: `1px solid ${btnSecEdge}`,
                    borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  }}>Start Focus Session</button>
                  <button style={{
                    width: '100%', padding: '9px 14px',
                    background: btnQuiet, color: textMuted,
                    border: 'none', borderRadius: 10,
                    fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  }}>Open Journal →</button>
                </div>
              </GlassCard>

              {/* Focus Timer State */}
              <GlassCard values={values} style={{ padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Focus Timer</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: stateOk, boxShadow: `0 0 8px ${stateOk}` }} />
                    <span style={{ fontSize: 10, color: stateOk, fontWeight: 500 }}>ACTIVE</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: '50%',
                    background: accent + '15', border: `3px solid ${accent}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 0 24px ${accent}30`,
                  }}>
                    <span style={{ fontSize: 24, fontWeight: 700, color: accent, fontFamily: 'monospace' }}>25:00</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: text1, marginBottom: 4 }}>Deep Work Session</div>
                    <div style={{ fontSize: 12, color: textMuted }}>Session 2 of 4 · Break in 15min</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                  <button style={{
                    padding: '10px 16px', borderRadius: 8,
                    background: btnPri, color: textInv,
                    border: `1px solid ${btnPriEdge}`,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    boxShadow: btnPriGlow,
                  }}>Pause</button>
                  <button style={{
                    padding: '10px 16px', borderRadius: 8,
                    background: surface3, color: text1,
                    border: `1px solid ${borderSub}`,
                    fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  }}>Stop</button>
                </div>
              </GlassCard>
            </div>

            {/* Calendar strip */}
            <GlassCard values={values} style={{ padding: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Calendar — March 2025</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 10, color: textMuted, fontWeight: 600, paddingBottom: 8 }}>{d}</div>
                ))}
                {[[], [], [1, 'event'], [2], [3, 'event'], [4], [5], [6, 'event'], [7, 'today'], [8], [9], [10, 'event'], [11], [12]].map((day, i) => {
                  const [num, evt] = day.length >= 2 ? [day[0], day[1]] : [day[0] || '', '']
                  const isToday = evt === 'today'
                  const hasEvent = evt === 'event'
                  return (
                    <div key={i} style={{
                      aspectRatio: '1', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      borderRadius: 8, cursor: 'pointer',
                      background: isToday ? accent : 'transparent',
                      color: isToday ? textInv : (num ? text1 : 'transparent'),
                      fontWeight: isToday ? 700 : 400,
                      fontSize: 12,
                      position: 'relative',
                      transition: 'all 0.15s',
                      border: `1px solid ${isToday ? 'transparent' : borderSub}`,
                    }}>
                      {num}
                      {hasEvent && !isToday && (
                        <div style={{
                          position: 'absolute', bottom: 3, width: 4, height: 4,
                          borderRadius: '50%', background: accent,
                          boxShadow: `0 0 6px ${accent}`,
                        }} />
                      )}
                    </div>
                  )
                })}
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
