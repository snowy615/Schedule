// Utility functions for task priority handling

export const PRIORITY_CONFIG = {
  1: { label: 'P1 - Urgent', color: '#dc2626', backgroundColor: 'rgba(220, 38, 38, 0.1)' },
  2: { label: 'P2 - High', color: '#ea580c', backgroundColor: 'rgba(234, 88, 12, 0.1)' },
  3: { label: 'P3 - Medium', color: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)' },
  4: { label: 'P4 - Low', color: '#16a34a', backgroundColor: 'rgba(22, 163, 74, 0.1)' },
  5: { label: 'P5 - Very Low', color: '#6b7280', backgroundColor: 'rgba(107, 114, 128, 0.1)' }
}

export function getPriorityColor(priority) {
  return PRIORITY_CONFIG[priority]?.color || PRIORITY_CONFIG[3].color
}

export function getPriorityBackgroundColor(priority) {
  return PRIORITY_CONFIG[priority]?.backgroundColor || PRIORITY_CONFIG[3].backgroundColor
}

export function getPriorityLabel(priority) {
  return PRIORITY_CONFIG[priority]?.label || PRIORITY_CONFIG[3].label
}

export function getPriorityStyles(priority) {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG[3]
  return {
    color: config.color,
    backgroundColor: config.backgroundColor,
    borderColor: config.color
  }
}