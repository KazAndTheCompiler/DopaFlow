import React, { useState, useCallback } from 'react'
import './App.css'

interface Token {
  name: string
  label: string
  default: string
}

interface TokenGroup {
  label: string
  tokens: Token[]
}

const tokenGroups: TokenGroup[] = [
  {
    label: 'Background & Surface',
    tokens: [
      { name: 'bg-app', label: 'App Background', default: '#f7f0e5' },
      { name: 'surface', label: 'Card Surface', default: '#fff8ef' },
      { name: 'surface-2', label: 'Elevated Surface', default: '#f1e3d0' },
      { name: 'border', label: 'Border', default: '#d7b99a' },
      { name: 'border-subtle', label: 'Subtle Border', default: '#d7b99a' },
      { name: 'border-strong', label: 'Strong Border', default: '#a37f58' },
    ]
  },
  {
    label: 'Text & Muted',
    tokens: [
      { name: 'text', label: 'Primary Text', default: '#3d3128' },
      { name: 'text-primary', label: 'Text Primary', default: '#3d3128' },
      { name: 'text-muted', label: 'Muted Text', default: '#736154' },
      { name: 'text-secondary', label: 'Text Secondary', default: '#736154' },
      { name: 'text-inverted', label: 'Inverted Text', default: '#fffaf5' },
      { name: 'text-disabled', label: 'Text Disabled', default: '#9f907d' },
      { name: 'text-link', label: 'Link Color', default: '#8d4a0f' },
    ]
  },
  {
    label: 'Accent & Interactive',
    tokens: [
      { name: 'accent', label: 'Primary Accent', default: '#bc6c25' },
      { name: 'accent-soft', label: 'Soft Accent', default: '#f2c48d' },
      { name: 'focus-ring', label: 'Focus Ring', default: 'rgba(188, 108, 37, 0.3)' },
      { name: 'shadow-soft', label: 'Soft Shadow', default: '0 12px 32px rgba(98, 55, 16, 0.16)' },
      { name: 'shadow-elevated', label: 'Elevated Shadow', default: '0 16px 40px rgba(98, 55, 16, 0.2)' },
      { name: 'shadow-floating', label: 'Floating Shadow', default: '0 24px 64px rgba(98, 55, 16, 0.24)' },
    ]
  },
  {
    label: 'States & Indicators',
    tokens: [
      { name: 'state-ok', label: 'OK / Success', default: '#4f7b5a' },
      { name: 'state-completed', label: 'Completed', default: '#4f7b5a' },
      { name: 'state-warn', label: 'Warning', default: '#c27a20' },
      { name: 'state-overdue', label: 'Overdue', default: '#b63f2a' },
      { name: 'state-conflict', label: 'Conflict', default: '#8b3d88' },
      { name: 'state-readonly', label: 'Read Only', default: '#8a7b6d' },
      { name: 'state-drag-active', label: 'Drag Active', default: '#bc6c25' },
      { name: 'state-drop-target', label: 'Drop Target', default: '#f2c48d' },
    ]
  },
  {
    label: 'Calendar & Events',
    tokens: [
      { name: 'timeline-now', label: 'Timeline Now', default: '#bc6c25' },
      { name: 'calendar-grid-line', label: 'Grid Lines', default: '#d7b99a' },
      { name: 'day-today-ring', label: 'Today Ring', default: '#bc6c25' },
      { name: 'event-default', label: 'Event Block', default: '#cf8a4d' },
      { name: 'task-default', label: 'Task Block', default: '#8c6249' },
      { name: 'reminder-default', label: 'Reminder', default: '#f09e5c' },
      { name: 'busy-block-hint', label: 'Busy Hint', default: 'rgba(188, 108, 37, 0.16)' },
      { name: 'free-slot-hint', label: 'Free Hint', default: 'rgba(73, 97, 92, 0.12)' },
      { name: 'selected-range', label: 'Selected Range', default: 'rgba(188, 108, 37, 0.2)' },
    ]
  },
  {
    label: 'Gradient (Optional)',
    tokens: [
      { name: 'bg-gradient', label: 'App Background Gradient', default: '' },
      { name: 'sidebar-gradient', label: 'Sidebar Gradient', default: '' },
      { name: 'card-gradient', label: 'Card Gradient', default: '' },
      { name: 'surface-gradient', label: 'Surface Gradient', default: '' },
    ]
  }
]

const presets: Record<string, { name: string; values: Record<string, string> }> = {
  'warm-analog': {
    name: 'Warm Analog',
    values: {
      'bg-app': '#f7f0e5', 'surface': '#fff8ef', 'surface-2': '#f1e3d0', 'border': '#d7b99a',
      'border-subtle': '#d7b99a', 'border-strong': '#a37f58',
      'text': '#3d3128', 'text-primary': '#3d3128', 'text-muted': '#736154', 'text-secondary': '#736154',
      'text-inverted': '#fffaf5', 'text-disabled': '#9f907d', 'text-link': '#8d4a0f',
      'accent': '#bc6c25', 'accent-soft': '#f2c48d', 'focus-ring': 'rgba(188, 108, 37, 0.3)',
      'shadow-soft': '0 12px 32px rgba(98, 55, 16, 0.16)', 'shadow-elevated': '0 16px 40px rgba(98, 55, 16, 0.2)',
      'shadow-floating': '0 24px 64px rgba(98, 55, 16, 0.24)',
      'state-ok': '#4f7b5a', 'state-completed': '#4f7b5a', 'state-warn': '#c27a20',
      'state-overdue': '#b63f2a', 'state-conflict': '#8b3d88',
      'state-readonly': '#8a7b6d', 'state-drag-active': '#bc6c25', 'state-drop-target': '#f2c48d',
      'timeline-now': '#bc6c25', 'calendar-grid-line': '#d7b99a', 'day-today-ring': '#bc6c25',
      'event-default': '#cf8a4d', 'task-default': '#8c6249', 'reminder-default': '#f09e5c',
      'busy-block-hint': 'rgba(188, 108, 37, 0.16)', 'free-slot-hint': 'rgba(73, 97, 92, 0.12)',
      'selected-range': 'rgba(188, 108, 37, 0.2)'
    }
  },
  'midnight-neon': {
    name: 'Midnight Neon',
    values: {
      'bg-app': '#091017', 'surface': '#101c29', 'surface-2': '#132434', 'border': '#1b4158',
      'border-subtle': '#1b4158', 'border-strong': '#2d6a88',
      'text': '#e4fbff', 'text-primary': '#e4fbff', 'text-muted': '#90b6c1', 'text-secondary': '#90b6c1',
      'text-inverted': '#041017', 'text-disabled': '#58717c', 'text-link': '#7bdcff',
      'accent': '#31f0c8', 'accent-soft': '#124f53', 'focus-ring': 'rgba(49, 240, 200, 0.34)',
      'shadow-soft': '0 18px 48px rgba(0, 0, 0, 0.45)', 'shadow-elevated': '0 22px 58px rgba(0, 0, 0, 0.52)',
      'shadow-floating': '0 28px 70px rgba(0, 0, 0, 0.6)',
      'state-ok': '#5cd695', 'state-completed': '#5cd695', 'state-warn': '#f0c040',
      'state-overdue': '#ff6d6d', 'state-conflict': '#ffc145',
      'state-readonly': '#617b8d', 'state-drag-active': '#31f0c8', 'state-drop-target': '#124f53',
      'timeline-now': '#31f0c8', 'calendar-grid-line': '#1b4158', 'day-today-ring': '#31f0c8',
      'event-default': '#22c1ee', 'task-default': '#5b9cff', 'reminder-default': '#ff7d6b',
      'busy-block-hint': 'rgba(49, 240, 200, 0.18)', 'free-slot-hint': 'rgba(144, 182, 193, 0.12)',
      'selected-range': 'rgba(49, 240, 200, 0.18)'
    }
  },
  'paper-minimal': {
    name: 'Paper Minimal',
    values: {
      'bg-app': '#faf7f1', 'surface': '#fffdf9', 'surface-2': '#f1ece4', 'border': '#d5cfc5',
      'border-subtle': '#d5cfc5', 'border-strong': '#8a8376',
      'text': '#24211d', 'text-primary': '#24211d', 'text-muted': '#6b665f', 'text-secondary': '#6b665f',
      'text-inverted': '#fffdfa', 'text-disabled': '#9a958d', 'text-link': '#18473b',
      'accent': '#215c4d', 'accent-soft': '#c8e3d8', 'focus-ring': 'rgba(33, 92, 77, 0.24)',
      'shadow-soft': '0 10px 24px rgba(28, 26, 23, 0.08)', 'shadow-elevated': '0 14px 36px rgba(28, 26, 23, 0.1)',
      'shadow-floating': '0 20px 48px rgba(28, 26, 23, 0.12)',
      'state-ok': '#49785c', 'state-completed': '#49785c', 'state-warn': '#b45309',
      'state-overdue': '#bb5140', 'state-conflict': '#8b5cf6',
      'state-readonly': '#918c84', 'state-drag-active': '#215c4d', 'state-drop-target': '#c8e3d8',
      'timeline-now': '#215c4d', 'calendar-grid-line': '#d5cfc5', 'day-today-ring': '#215c4d',
      'event-default': '#629488', 'task-default': '#7d6854', 'reminder-default': '#b58252',
      'busy-block-hint': 'rgba(33, 92, 77, 0.12)', 'free-slot-hint': 'rgba(107, 102, 95, 0.08)',
      'selected-range': 'rgba(33, 92, 77, 0.12)'
    }
  },
  'aurora': {
    name: 'Aurora',
    values: {
      'bg-app': '#eef6f5', 'surface': '#ffffff', 'surface-2': '#dff0eb', 'border': '#b8d2cb',
      'border-subtle': '#b8d2cb', 'border-strong': '#7ea39b',
      'text': '#173b38', 'text-primary': '#173b38', 'text-muted': '#547370', 'text-secondary': '#547370',
      'text-inverted': '#f8fffd', 'text-disabled': '#8aa29d', 'text-link': '#0f5e55',
      'accent': '#157a6e', 'accent-soft': '#a7e8d9', 'focus-ring': 'rgba(21, 122, 110, 0.26)',
      'shadow-soft': '0 16px 36px rgba(21, 122, 110, 0.12)', 'shadow-elevated': '0 18px 42px rgba(21, 122, 110, 0.16)',
      'shadow-floating': '0 24px 56px rgba(21, 122, 110, 0.18)',
      'state-ok': '#41956f', 'state-completed': '#41956f', 'state-warn': '#c2702f',
      'state-overdue': '#d25949', 'state-conflict': '#8f63f4',
      'state-readonly': '#7b9690', 'state-drag-active': '#157a6e', 'state-drop-target': '#a7e8d9',
      'timeline-now': '#157a6e', 'calendar-grid-line': '#b8d2cb', 'day-today-ring': '#157a6e',
      'event-default': '#24a68e', 'task-default': '#4d7f78', 'reminder-default': '#de8f6c',
      'busy-block-hint': 'rgba(21, 122, 110, 0.14)', 'free-slot-hint': 'rgba(84, 115, 112, 0.1)',
      'selected-range': 'rgba(21, 122, 110, 0.16)'
    }
  },
  'glassy-modern': {
    name: 'Glassy Modern',
    values: {
      'bg-app': '#0f1b20', 'surface': 'rgba(24, 44, 52, 0.78)', 'surface-2': 'rgba(31, 58, 67, 0.72)',
      'border': 'rgba(143, 191, 207, 0.22)', 'border-subtle': 'rgba(143, 191, 207, 0.22)',
      'border-strong': 'rgba(143, 191, 207, 0.42)',
      'text': '#edf8fb', 'text-primary': '#edf8fb', 'text-muted': '#a6c3cb', 'text-secondary': '#a6c3cb',
      'text-inverted': '#071116', 'text-disabled': '#6f8a91', 'text-link': '#8be9ff',
      'accent': '#50bfd3', 'accent-soft': 'rgba(80, 191, 211, 0.18)', 'focus-ring': 'rgba(80, 191, 211, 0.3)',
      'shadow-soft': '0 22px 48px rgba(0, 0, 0, 0.28)', 'shadow-elevated': '0 26px 56px rgba(0, 0, 0, 0.34)',
      'shadow-floating': '0 32px 72px rgba(0, 0, 0, 0.42)',
      'state-ok': '#65d39c', 'state-completed': '#65d39c', 'state-warn': '#e8a845',
      'state-overdue': '#ff7f7f', 'state-conflict': '#ffc145',
      'state-readonly': '#7e9aa1', 'state-drag-active': '#50bfd3', 'state-drop-target': 'rgba(80, 191, 211, 0.3)',
      'timeline-now': '#50bfd3', 'calendar-grid-line': 'rgba(143, 191, 207, 0.22)', 'day-today-ring': '#50bfd3',
      'event-default': '#6fd4e5', 'task-default': '#88aeb8', 'reminder-default': '#ff9f68',
      'busy-block-hint': 'rgba(80, 191, 211, 0.18)', 'free-slot-hint': 'rgba(166, 195, 203, 0.12)',
      'selected-range': 'rgba(80, 191, 211, 0.2)'
    }
  },
  'soft-pastel': {
    name: 'Soft Pastel',
    values: {
      'bg-app': '#f8f3fa', 'surface': '#fffafe', 'surface-2': '#efe1f2', 'border': '#d3c2d7',
      'border-subtle': '#d3c2d7', 'border-strong': '#aa97b0',
      'text': '#3f3445', 'text-primary': '#3f3445', 'text-muted': '#766a7d', 'text-secondary': '#766a7d',
      'text-inverted': '#fff9fd', 'text-disabled': '#a79aac', 'text-link': '#a04e6a',
      'accent': '#d66c8d', 'accent-soft': '#f7d4df', 'focus-ring': 'rgba(214, 108, 141, 0.24)',
      'shadow-soft': '0 14px 34px rgba(102, 72, 92, 0.12)', 'shadow-elevated': '0 18px 40px rgba(102, 72, 92, 0.16)',
      'shadow-floating': '0 24px 56px rgba(102, 72, 92, 0.18)',
      'state-ok': '#72b088', 'state-completed': '#72b088', 'state-warn': '#c97b3a',
      'state-overdue': '#d84f4f', 'state-conflict': '#8f5bd6',
      'state-readonly': '#9b8aa1', 'state-drag-active': '#d66c8d', 'state-drop-target': '#f7d4df',
      'timeline-now': '#d66c8d', 'calendar-grid-line': '#d3c2d7', 'day-today-ring': '#d66c8d',
      'event-default': '#d984b0', 'task-default': '#7c6a8b', 'reminder-default': '#f08c5e',
      'busy-block-hint': 'rgba(214, 108, 141, 0.14)', 'free-slot-hint': 'rgba(118, 106, 125, 0.1)',
      'selected-range': 'rgba(214, 108, 141, 0.16)'
    }
  },
  'amber-terminal': {
    name: 'Amber Terminal',
    values: {
      'bg-app': '#1b140c', 'surface': '#251c11', 'surface-2': '#312515', 'border': '#785a22',
      'border-subtle': '#785a22', 'border-strong': '#b9892f',
      'text': '#ffd888', 'text-primary': '#ffd888', 'text-muted': '#d0aa57', 'text-secondary': '#d0aa57',
      'text-inverted': '#120d06', 'text-disabled': '#8f723a', 'text-link': '#ffcf5a',
      'accent': '#ffb000', 'accent-soft': '#5d3d06', 'focus-ring': 'rgba(255, 176, 0, 0.32)',
      'shadow-soft': '0 16px 40px rgba(0, 0, 0, 0.36)', 'shadow-elevated': '0 20px 48px rgba(0, 0, 0, 0.44)',
      'shadow-floating': '0 26px 62px rgba(0, 0, 0, 0.5)',
      'state-ok': '#78c679', 'state-completed': '#78c679', 'state-warn': '#e8a020',
      'state-overdue': '#ff7a00', 'state-conflict': '#ff4d6d',
      'state-readonly': '#a58147', 'state-drag-active': '#ffb000', 'state-drop-target': '#5d3d06',
      'timeline-now': '#ffb000', 'calendar-grid-line': '#785a22', 'day-today-ring': '#ffb000',
      'event-default': '#ffbf47', 'task-default': '#ffd888', 'reminder-default': '#ff7a00',
      'busy-block-hint': 'rgba(255, 176, 0, 0.16)', 'free-slot-hint': 'rgba(208, 170, 87, 0.12)',
      'selected-range': 'rgba(255, 176, 0, 0.18)'
    }
  },
  'high-contrast': {
    name: 'High Contrast',
    values: {
      'bg-app': '#ffffff', 'surface': '#ffffff', 'surface-2': '#f1f1f1', 'border': '#000000',
      'border-subtle': '#000000', 'border-strong': '#000000',
      'text': '#000000', 'text-primary': '#000000', 'text-muted': '#2b2b2b', 'text-secondary': '#2b2b2b',
      'text-inverted': '#ffffff', 'text-disabled': '#767676', 'text-link': '#0047ff',
      'accent': '#0047ff', 'accent-soft': '#bfd0ff', 'focus-ring': 'rgba(0, 71, 255, 0.36)',
      'shadow-soft': '0 0 0 rgba(0, 0, 0, 0)', 'shadow-elevated': '0 0 0 rgba(0, 0, 0, 0)',
      'shadow-floating': '0 0 0 rgba(0, 0, 0, 0)',
      'state-ok': '#157f1f', 'state-completed': '#157f1f', 'state-warn': '#a05700',
      'state-overdue': '#d62828', 'state-conflict': '#7b2cbf',
      'state-readonly': '#4a4a4a', 'state-drag-active': '#0047ff', 'state-drop-target': '#bfd0ff',
      'timeline-now': '#0047ff', 'calendar-grid-line': '#000000', 'day-today-ring': '#0047ff',
      'event-default': '#0047ff', 'task-default': '#111111', 'reminder-default': '#d62828',
      'busy-block-hint': 'rgba(0, 71, 255, 0.18)', 'free-slot-hint': 'rgba(0, 0, 0, 0.08)',
      'selected-range': 'rgba(0, 71, 255, 0.16)'
    }
  },
  'ink-stone': {
    name: 'Ink & Stone',
    values: {
      'bg-app': '#f4efe4', 'surface': '#fbf8f0', 'surface-2': '#e8e0d0', 'border': '#c4b8a3',
      'border-subtle': '#c4b8a3', 'border-strong': '#8f806a',
      'text': '#2d2923', 'text-primary': '#2d2923', 'text-muted': '#6d6558', 'text-secondary': '#6d6558',
      'text-inverted': '#fffdf8', 'text-disabled': '#9a917f', 'text-link': '#355450',
      'accent': '#49615c', 'accent-soft': '#c8d8d2', 'focus-ring': 'rgba(73, 97, 92, 0.24)',
      'shadow-soft': '0 16px 40px rgba(63, 55, 40, 0.12)', 'shadow-elevated': '0 20px 44px rgba(63, 55, 40, 0.16)',
      'shadow-floating': '0 26px 58px rgba(63, 55, 40, 0.2)',
      'state-ok': '#5d8960', 'state-completed': '#5d8960', 'state-warn': '#c97353',
      'state-overdue': '#c24f3d', 'state-conflict': '#8a54d1',
      'state-readonly': '#928777', 'state-drag-active': '#49615c', 'state-drop-target': '#c8d8d2',
      'timeline-now': '#49615c', 'calendar-grid-line': '#c4b8a3', 'day-today-ring': '#49615c',
      'event-default': '#6f8b85', 'task-default': '#8d7151', 'reminder-default': '#c97353',
      'busy-block-hint': 'rgba(73, 97, 92, 0.14)', 'free-slot-hint': 'rgba(109, 101, 88, 0.09)',
      'selected-range': 'rgba(73, 97, 92, 0.16)'
    }
  },
  'lush-forest': {
    name: 'Lush Forest',
    values: {
      'bg-app': '#0d1512', 'surface': '#141f1a', 'surface-2': '#1a2b24', 'border': '#2a3d35',
      'border-subtle': '#2a3d35', 'border-strong': '#3d5a48',
      'text': '#e8f5ed', 'text-primary': '#e8f5ed', 'text-muted': '#8ba897', 'text-secondary': '#8ba897',
      'text-inverted': '#0a120e', 'text-disabled': '#4a5a4f', 'text-link': '#9be8bb',
      'accent': '#7ce3a0', 'accent-soft': '#1a3d2e', 'focus-ring': 'rgba(124, 227, 160, 0.3)',
      'shadow-soft': '0 20px 50px rgba(0, 0, 0, 0.4)', 'shadow-elevated': '0 24px 56px rgba(0, 0, 0, 0.45)',
      'shadow-floating': '0 32px 72px rgba(0, 0, 0, 0.5)',
      'state-ok': '#4caf50', 'state-completed': '#4caf50', 'state-warn': '#d4a54a',
      'state-overdue': '#ef5350', 'state-conflict': '#ab47bc',
      'state-readonly': '#5d6b62', 'state-drag-active': '#7ce3a0', 'state-drop-target': '#1a3d2e',
      'timeline-now': '#7ce3a0', 'calendar-grid-line': '#2a3d35', 'day-today-ring': '#7ce3a0',
      'event-default': '#5bc4a8', 'task-default': '#8bc4a0', 'reminder-default': '#d4a54a',
      'busy-block-hint': 'rgba(124, 227, 160, 0.15)', 'free-slot-hint': 'rgba(139, 168, 151, 0.1)',
      'selected-range': 'rgba(124, 227, 160, 0.15)'
    }
  },
  'vampire-romance': {
    name: 'Vampire Romance',
    values: {
      'bg-app': '#1a0a0f', 'surface': '#251419', 'surface-2': '#321c25', 'border': '#4a2836',
      'border-subtle': '#4a2836', 'border-strong': '#6d3a4d',
      'text': '#fce4ec', 'text-primary': '#fce4ec', 'text-muted': '#b08a9a', 'text-secondary': '#b08a9a',
      'text-inverted': '#0f0508', 'text-disabled': '#5a3a46', 'text-link': '#ff8fa6',
      'accent': '#ff708d', 'accent-soft': '#3d1a26', 'focus-ring': 'rgba(255, 112, 141, 0.3)',
      'shadow-soft': '0 20px 50px rgba(0, 0, 0, 0.45)', 'shadow-elevated': '0 24px 56px rgba(0, 0, 0, 0.5)',
      'shadow-floating': '0 32px 72px rgba(0, 0, 0, 0.55)',
      'state-ok': '#e91e63', 'state-completed': '#e91e63', 'state-warn': '#ffb74d',
      'state-overdue': '#ff1744', 'state-conflict': '#ab47bc',
      'state-readonly': '#6d4c55', 'state-drag-active': '#ff708d', 'state-drop-target': '#3d1a26',
      'timeline-now': '#ff708d', 'calendar-grid-line': '#4a2836', 'day-today-ring': '#ff708d',
      'event-default': '#e85a7a', 'task-default': '#d48a9a', 'reminder-default': '#ffd54f',
      'busy-block-hint': 'rgba(255, 112, 141, 0.15)', 'free-slot-hint': 'rgba(176, 138, 154, 0.1)',
      'selected-range': 'rgba(255, 112, 141, 0.15)'
    }
  },
  'deep-ocean': {
    name: 'Deep Ocean',
    values: {
      'bg-app': '#030810', 'surface': '#081420', 'surface-2': '#0d1e2e', 'border': '#142a3d',
      'border-subtle': '#142a3d', 'border-strong': '#1e4058',
      'text': '#c5e8f7', 'text-primary': '#c5e8f7', 'text-muted': '#6a9cb5', 'text-secondary': '#6a9cb5',
      'text-inverted': '#020508', 'text-disabled': '#2a4a5a', 'text-link': '#4dfcff',
      'accent': '#00e5ff', 'accent-soft': '#072d3d', 'focus-ring': 'rgba(0, 229, 255, 0.35)',
      'shadow-soft': '0 20px 50px rgba(0, 0, 0, 0.5)', 'shadow-elevated': '0 24px 56px rgba(0, 0, 0, 0.55)',
      'shadow-floating': '0 32px 72px rgba(0, 0, 0, 0.6)',
      'state-ok': '#00bfa5', 'state-completed': '#00bfa5', 'state-warn': '#ffab00',
      'state-overdue': '#ff5252', 'state-conflict': '#7c4dff',
      'state-readonly': '#3d6078', 'state-drag-active': '#00e5ff', 'state-drop-target': '#072d3d',
      'timeline-now': '#00e5ff', 'calendar-grid-line': '#142a3d', 'day-today-ring': '#00e5ff',
      'event-default': '#00b8d4', 'task-default': '#4dd0e1', 'reminder-default': '#ff9100',
      'busy-block-hint': 'rgba(0, 229, 255, 0.15)', 'free-slot-hint': 'rgba(106, 156, 181, 0.1)',
      'selected-range': 'rgba(0, 229, 255, 0.15)'
    }
  },
  'sunset-blues': {
    name: 'Sunset Blues',
    values: {
      'bg-app': '#1a1520', 'surface': '#251e2d', 'surface-2': '#322840', 'border': '#453a55',
      'border-subtle': '#453a55', 'border-strong': '#5a4a70',
      'text': '#f5f0fa', 'text-primary': '#f5f0fa', 'text-muted': '#9a8aaa', 'text-secondary': '#9a8aaa',
      'text-inverted': '#0f0a14', 'text-disabled': '#4a3a5a', 'text-link': '#d8b4fe',
      'accent': '#c084fc', 'accent-soft': '#2d1f3d', 'focus-ring': 'rgba(192, 132, 252, 0.3)',
      'shadow-soft': '0 20px 50px rgba(0, 0, 0, 0.4)', 'shadow-elevated': '0 24px 56px rgba(0, 0, 0, 0.45)',
      'shadow-floating': '0 32px 72px rgba(0, 0, 0, 0.5)',
      'state-ok': '#a855f7', 'state-completed': '#a855f7', 'state-warn': '#fb923c',
      'state-overdue': '#f87171', 'state-conflict': '#e879f9',
      'state-readonly': '#6b5a7a', 'state-drag-active': '#c084fc', 'state-drop-target': '#2d1f3d',
      'timeline-now': '#c084fc', 'calendar-grid-line': '#453a55', 'day-today-ring': '#c084fc',
      'event-default': '#a855f7', 'task-default': '#c4a0e0', 'reminder-default': '#fb923c',
      'busy-block-hint': 'rgba(192, 132, 252, 0.15)', 'free-slot-hint': 'rgba(154, 138, 170, 0.1)',
      'selected-range': 'rgba(192, 132, 252, 0.15)'
    }
  },
  'classic-noir': {
    name: 'Classic Noir',
    values: {
      'bg-app': '#0a0a0a', 'surface': '#141414', 'surface-2': '#1e1e1e', 'border': '#2a2a2a',
      'border-subtle': '#2a2a2a', 'border-strong': '#4a4a4a',
      'text': '#f5f5f5', 'text-primary': '#f5f5f5', 'text-muted': '#888888', 'text-secondary': '#888888',
      'text-inverted': '#000000', 'text-disabled': '#555555', 'text-link': '#f0d060',
      'accent': '#d4af37', 'accent-soft': '#2a2520', 'focus-ring': 'rgba(212, 175, 55, 0.3)',
      'shadow-soft': '0 20px 50px rgba(0, 0, 0, 0.5)', 'shadow-elevated': '0 24px 56px rgba(0, 0, 0, 0.55)',
      'shadow-floating': '0 32px 72px rgba(0, 0, 0, 0.6)',
      'state-ok': '#4caf50', 'state-completed': '#4caf50', 'state-warn': '#d4af37',
      'state-overdue': '#ef5350', 'state-conflict': '#ab47bc',
      'state-readonly': '#4a4a4a', 'state-drag-active': '#d4af37', 'state-drop-target': '#2a2520',
      'timeline-now': '#d4af37', 'calendar-grid-line': '#2a2a2a', 'day-today-ring': '#d4af37',
      'event-default': '#c9a227', 'task-default': '#b8a030', 'reminder-default': '#e6c65c',
      'busy-block-hint': 'rgba(212, 175, 55, 0.12)', 'free-slot-hint': 'rgba(136, 136, 136, 0.08)',
      'selected-range': 'rgba(212, 175, 55, 0.12)'
    }
  },
  'cotton-candy': {
    name: 'Cotton Candy',
    values: {
      'bg-app': '#fef6ff', 'surface': '#ffffff', 'surface-2': '#f5e6ff', 'border': '#e8d4f0',
      'border-subtle': '#e8d4f0', 'border-strong': '#b8a0d0',
      'text': '#4a3555', 'text-primary': '#4a3555', 'text-muted': '#8a7a9a', 'text-secondary': '#8a7a9a',
      'text-inverted': '#faf0ff', 'text-disabled': '#b8a8c8', 'text-link': '#c060f0',
      'accent': '#e879f9', 'accent-soft': '#f3d4ff', 'focus-ring': 'rgba(232, 121, 249, 0.25)',
      'shadow-soft': '0 20px 50px rgba(90, 40, 100, 0.1)', 'shadow-elevated': '0 24px 56px rgba(90, 40, 100, 0.12)',
      'shadow-floating': '0 32px 72px rgba(90, 40, 100, 0.15)',
      'state-ok': '#a855f7', 'state-completed': '#a855f7', 'state-warn': '#fb923c',
      'state-overdue': '#f87171', 'state-conflict': '#c084fc',
      'state-readonly': '#b8a8c8', 'state-drag-active': '#e879f9', 'state-drop-target': '#f3d4ff',
      'timeline-now': '#e879f9', 'calendar-grid-line': '#e8d4f0', 'day-today-ring': '#e879f9',
      'event-default': '#d58bf0', 'task-default': '#c084d8', 'reminder-default': '#fb923c',
      'busy-block-hint': 'rgba(232, 121, 249, 0.12)', 'free-slot-hint': 'rgba(138, 122, 154, 0.08)',
      'selected-range': 'rgba(232, 121, 249, 0.12)'
    }
  },
  'neon-punk': {
    name: 'Neon Punk',
    values: {
      'bg-app': '#0a0612', 'surface': '#120c1e', 'surface-2': '#1a1230', 'border': '#2a1f48',
      'border-subtle': '#2a1f48', 'border-strong': '#4a3870',
      'text': '#f0e6ff', 'text-primary': '#f0e6ff', 'text-muted': '#7a68a8', 'text-secondary': '#7a68a8',
      'text-inverted': '#050208', 'text-disabled': '#4a3870', 'text-link': '#e040fb',
      'accent': '#bf00ff', 'accent-soft': '#2d0a3d', 'focus-ring': 'rgba(191, 0, 255, 0.35)',
      'shadow-soft': '0 20px 50px rgba(0, 0, 0, 0.5)', 'shadow-elevated': '0 24px 56px rgba(0, 0, 0, 0.55)',
      'shadow-floating': '0 32px 72px rgba(0, 0, 0, 0.6)',
      'state-ok': '#00e676', 'state-completed': '#00e676', 'state-warn': '#ff9100',
      'state-overdue': '#ff1744', 'state-conflict': '#ff9100',
      'state-readonly': '#4a3870', 'state-drag-active': '#bf00ff', 'state-drop-target': '#2d0a3d',
      'timeline-now': '#ff00e6', 'calendar-grid-line': '#2a1f48', 'day-today-ring': '#ff00e6',
      'event-default': '#d500f9', 'task-default': '#e100ff', 'reminder-default': '#00e5ff',
      'busy-block-hint': 'rgba(191, 0, 255, 0.18)', 'free-slot-hint': 'rgba(122, 104, 168, 0.1)',
      'selected-range': 'rgba(191, 0, 255, 0.18)'
    }
  }
}

interface GradientStop {
  color: string;
  position: number;
}

interface GradientToken {
  name: string;
  label: string;
  default: string;
}

function GradientPicker({ token: _token, value, onChange }: { token: GradientToken; value: string; onChange: (value: string) => void }) {
  const parseGradient = (grad: string): { angle: number; stops: GradientStop[] } => {
    if (!grad) {
      return { angle: 135, stops: [{ color: '#ffffff', position: 0 }, { color: '#000000', position: 100 }] };
    }
    
    const angleMatch = grad.match(/(\d+)deg/);
    const angle = angleMatch ? parseInt(angleMatch[1], 10) : 135;
    
    const stops: GradientStop[] = [];
    
    const colorMatches = grad.matchAll(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[a-z]+)\s*(\d+%)?/g);
    for (const match of colorMatches) {
      stops.push({
        color: match[1],
        position: match[2] ? parseInt(match[2], 10) : stops.length === 0 ? 0 : 100
      });
    }
    
    if (stops.length < 2) {
      return { angle: 135, stops: [{ color: '#ffffff', position: 0 }, { color: '#000000', position: 100 }] };
    }
    
    return { angle, stops: stops.sort((a, b) => a.position - b.position) };
  };

  const [gradient, setGradient] = useState<{ angle: number; stops: GradientStop[] }>(() => parseGradient(value));

  const updateGradient = (newGradient: { angle: number; stops: GradientStop[] }) => {
    setGradient(newGradient);
    const css = `linear-gradient(${newGradient.angle}deg, ${newGradient.stops
      .map(s => `${s.color} ${s.position}%`)
      .join(', ')})`;
    onChange(css);
  };

  const addStop = () => {
    const newStops = [...gradient.stops].sort((a, b) => a.position - b.position);
    const midIndex = Math.floor(newStops.length / 2);
    const newPosition = midIndex < newStops.length - 1 
      ? Math.round((newStops[midIndex].position + newStops[midIndex + 1].position) / 2)
      : 100;
    const newColor = '#888888';
    updateGradient({
      angle: gradient.angle,
      stops: [...newStops, { color: newColor, position: newPosition }]
    });
  };

  const removeStop = (index: number) => {
    if (gradient.stops.length <= 2) return;
    const newStops = gradient.stops.filter((_, i) => i !== index);
    updateGradient({ angle: gradient.angle, stops: newStops });
  };

  const updateStop = (index: number, updates: Partial<GradientStop>) => {
    const newStops = gradient.stops.map((stop, i) => i === index ? { ...stop, ...updates } : stop);
    updateGradient({ angle: gradient.angle, stops: newStops });
  };

  const previewCss = `linear-gradient(${gradient.angle}deg, ${gradient.stops
    .map(s => `${s.color} ${s.position}%`)
    .join(', ')})`;

  return (
    <div className="gradient-picker">
      <div className="gradient-preview" style={{ background: previewCss }} />
      <div className="gradient-controls">
        <div className="gradient-angle-row">
          <label>Angle</label>
          <input
            type="range"
            min="0"
            max="360"
            value={gradient.angle}
            onChange={(e) => updateGradient({ ...gradient, angle: parseInt(e.target.value, 10) })}
          />
          <span className="gradient-angle-value">{gradient.angle}°</span>
        </div>
        <div className="gradient-stops">
          {gradient.stops.map((stop, index) => (
            <div key={index} className="gradient-stop-row">
              <div className="gradient-stop-preview" style={{ background: stop.color }}>
                <input
                  type="color"
                  value={stop.color.startsWith('#') ? stop.color.slice(0, 7) : '#888888'}
                  onChange={(e) => updateStop(index, { color: e.target.value })}
                />
              </div>
              <input
                type="number"
                className="gradient-stop-position"
                min="0"
                max="100"
                value={stop.position}
                onChange={(e) => updateStop(index, { position: Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)) })}
              />
              <span style={{ fontSize: 11, color: '#6b6b7a' }}>%</span>
              {gradient.stops.length > 2 && (
                <button className="gradient-stop-delete" onClick={() => removeStop(index)}>×</button>
              )}
            </div>
          ))}
          <button className="gradient-add-stop" onClick={addStop}>+ Add Color Stop</button>
        </div>
        <div className="gradient-presets-row">
          <span style={{ fontSize: 11, color: '#888', marginRight: 6 }}>Presets:</span>
          {[
            { label: 'Forest Dusk', css: 'linear-gradient(175deg, #111e14 0%, #1a2e1e 50%, #3a5e40 100%)' },
            { label: 'Ocean Deep', css: 'linear-gradient(160deg, #060d18 0%, #0a1628 50%, #1c4f6b 100%)' },
            { label: 'Amber Fade', css: 'linear-gradient(145deg, #1a1206 0%, #2e1c08 50%, #4a3010 100%)' },
          ].map((p) => (
            <button
              key={p.label}
              className="gradient-preset-btn"
              onClick={() => { updateGradient(parseGradient(p.css)); onChange(p.css); }}
              style={{ background: p.css, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 11, color: '#eee', marginRight: 4 }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    tokenGroups.forEach(group => {
      group.tokens.forEach(token => {
        initial[token.name] = token.default
      })
    })
    return initial
  })

  const [skinName, setSkinName] = useState('my-custom-skin')
  const [activePreset, setActivePreset] = useState('warm-analog')
  const [showExport, setShowExport] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleValueChange = useCallback((name: string, value: string) => {
    setValues(prev => ({ ...prev, [name]: value }))
  }, [])

  const applyPreset = useCallback((presetKey: string) => {
    const preset = presets[presetKey]
    if (preset) {
      setValues(preset.values)
      setActivePreset(presetKey)
      setSkinName(preset.name.toLowerCase().replace(/\s+/g, '-'))
    }
  }, [])

  const generateCSS = useCallback(() => {
    let css = `[data-skin="${skinName}"] {\n`
    tokenGroups.forEach(group => {
      group.tokens.forEach(token => {
        css += `  --${token.name}: ${values[token.name] || token.default};\n`
      })
    })
    css += `}\n`
    return css
  }, [skinName, values])

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(generateCSS())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [generateCSS])

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">D</div>
          <div className="logo-text">DopaFlow <span>SkinMaker</span></div>
        </div>

        <input
          type="text"
          className="skin-name-input"
          value={skinName}
          onChange={e => setSkinName(e.target.value)}
          placeholder="Enter skin name..."
        />

        <div className="section-title">Quick Presets</div>
        <div className="presets-grid">
          {Object.entries(presets).map(([key, preset]) => (
            <button
              key={key}
              className={`preset-btn ${activePreset === key ? 'active' : ''}`}
              onClick={() => applyPreset(key)}
            >
              <div 
                className="preset-preview" 
                style={{ 
                  background: `linear-gradient(135deg, ${preset.values['bg-app']} 0%, ${preset.values.accent} 100%)` 
                }} 
              />
              <span className="preset-label">{preset.name}</span>
            </button>
          ))}
        </div>

        {tokenGroups.map(group => (
          <div key={group.label}>
            <div className="section-title">{group.label}</div>
            <div className="color-group">
              {group.tokens.map(token => {
                const isGradient = token.name.includes('gradient');
                if (isGradient) {
                  return (
                    <div key={token.name} style={{ marginBottom: 16 }}>
                      <div className="color-name" style={{ marginBottom: 8 }}>{token.label}</div>
                      <GradientPicker
                        token={token}
                        value={values[token.name] || token.default}
                        onChange={(v) => handleValueChange(token.name, v)}
                      />
                    </div>
                  );
                }
                return (
                  <div key={token.name} className="color-row">
                    <div 
                      className="color-preview" 
                      style={{ background: values[token.name] || token.default }}
                    >
                      <input
                        type="color"
                        value={values[token.name]?.startsWith('rgba') ? '#000000' : (values[token.name] || token.default).slice(0, 7)}
                        onChange={e => handleValueChange(token.name, e.target.value)}
                      />
                    </div>
                    <div className="color-info">
                      <div className="color-name">{token.label}</div>
                      <div className="color-value">{values[token.name] || token.default}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="export-section">
          <button className="export-btn" onClick={() => setShowExport(true)}>
            Export Skin CSS
          </button>
        </div>
      </aside>

      <main className="preview" style={values as React.CSSProperties}>
        <PreviewPanel values={values} />
      </main>

      {showExport && (
        <div className="modal-overlay" onClick={() => setShowExport(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Export Your Skin</h2>
            <textarea readOnly value={generateCSS()} />
            <div className="modal-actions">
              <button className="modal-btn secondary" onClick={() => setShowExport(false)}>
                Close
              </button>
              <button className="modal-btn primary" onClick={copyToClipboard}>
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </button>
            </div>
          </div>
        </div>
      )}

      {copied && <div className="toast">Copied to clipboard!</div>}
    </div>
  )
}

function PreviewPanel({ values }: { values: Record<string, string> }) {
  const vars = {
    '--bg-app': values['bg-app'] || '#f7f0e5',
    '--surface': values['surface'] || '#fff8ef',
    '--surface-2': values['surface-2'] || '#f1e3d0',
    '--border': values['border'] || '#d7b99a',
    '--border-subtle': values['border-subtle'] || '#d7b99a',
    '--border-strong': values['border-strong'] || '#a37f58',
    '--text': values['text'] || '#3d3128',
    '--text-primary': values['text-primary'] || values['text'] || '#3d3128',
    '--text-muted': values['text-muted'] || '#736154',
    '--text-secondary': values['text-secondary'] || values['text-muted'] || '#736154',
    '--text-inverted': values['text-inverted'] || '#fffaf5',
    '--text-disabled': values['text-disabled'] || '#9f907d',
    '--text-link': values['text-link'] || '#8d4a0f',
    '--accent': values['accent'] || '#bc6c25',
    '--accent-soft': values['accent-soft'] || '#f2c48d',
    '--shadow-soft': values['shadow-soft'] || '0 12px 32px rgba(98, 55, 16, 0.16)',
    '--shadow-elevated': values['shadow-elevated'] || '0 16px 40px rgba(98, 55, 16, 0.2)',
    '--shadow-floating': values['shadow-floating'] || '0 24px 64px rgba(98, 55, 16, 0.24)',
    '--state-ok': values['state-ok'] || values['state-completed'] || '#4f7b5a',
    '--state-completed': values['state-completed'] || '#4f7b5a',
    '--state-warn': values['state-warn'] || '#c27a20',
    '--state-overdue': values['state-overdue'] || '#b63f2a',
    '--state-conflict': values['state-conflict'] || '#8b3d88',
    '--state-readonly': values['state-readonly'] || '#8a7b6d',
    '--state-drag-active': values['state-drag-active'] || '#bc6c25',
    '--state-drop-target': values['state-drop-target'] || '#f2c48d',
    '--event-default': values['event-default'] || '#cf8a4d',
    '--day-today-ring': values['day-today-ring'] || '#bc6c25',
    '--focus-ring': values['focus-ring'] || 'rgba(188, 108, 37, 0.3)',
  } as React.CSSProperties

  return (
    <div className="preview-panel" style={vars}>
      <div className="preview-container">
        <div className="preview-header">
          <h1 className="preview-title">Skin Preview</h1>
          <div className="preview-badge">✓ Live Preview</div>
        </div>

        <div className="mock-app" style={{ display: 'flex', minHeight: 600, position: 'relative' }}>
          <div className="mock-sidebar">
            {['Overview', 'Tasks', 'Habits', 'Calendar', 'Focus', 'Journal'].map((item, i) => (
              <div key={item} className={`mock-nav-item ${i === 0 ? 'active' : ''}`}>
                <div className="mock-nav-icon" />
                {item}
              </div>
            ))}
            <div className="mock-nav-item" style={{ marginTop: 'auto' }}>
              <div className="mock-nav-icon" />
              Settings
            </div>
          </div>

          <div className="mock-main">
            <div className="mock-content">
              <div>
                <div className="mock-card">
                  <div className="mock-card-header">
                    <span className="mock-card-title">Today's Tasks</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>3 of 5 done</span>
                  </div>
                  <div className="mock-task">
                    <div className="mock-checkbox" />
                    <span className="mock-task-text">Review project documentation</span>
                  </div>
                  <div className="mock-task completed">
                    <div className="mock-checkbox" />
                    <span className="mock-task-text">Send weekly report</span>
                  </div>
                  <div className="mock-task">
                    <div className="mock-checkbox" />
                    <span className="mock-task-text">Prepare presentation slides</span>
                  </div>
                </div>

                <div className="mock-card">
                  <div className="mock-card-header">
                    <span className="mock-card-title">This Week</span>
                  </div>
                  <div className="mock-stats">
                    {[
                      { value: '12', label: 'Tasks Done' },
                      { value: '5', label: 'Habits Streak' },
                      { value: '4.5h', label: 'Focus Time' },
                      { value: '2', label: 'Journal Entries' }
                    ].map(stat => (
                      <div key={stat.label} className="mock-stat">
                        <div className="mock-stat-value">{stat.value}</div>
                        <div className="mock-stat-label">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="mock-card">
                  <div className="mock-card-header">
                    <span className="mock-card-title">Calendar</span>
                  </div>
                  <div className="mock-calendar">
                    {['', '', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30].map((day, i) => (
                      <div 
                        key={i} 
                        className={`mock-cal-day ${day === '' ? '' : day === 15 ? 'today' : [3, 7, 12, 18, 22, 27].includes(day as number) ? 'has-event' : ''}`}
                        style={{ visibility: day === '' ? 'hidden' : 'visible' }}
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mock-fab">
            <div className="mock-fab-icon" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
