type TaskSource = 'manual' | 'action' | 'cognition' | 'ai' | 'calendar';

type TaskAddedDetail = {
  title: string;
  source: TaskSource;
};

function sourceLabel(source: TaskSource): string {
  switch (source) {
    case 'manual':
      return 'Manual';
    case 'action':
      return 'Action';
    case 'cognition':
      return 'Cognition';
    case 'calendar':
      return 'Calendar';
    default:
      return 'AI';
  }
}

export function announceTaskAdded(detail: TaskAddedDetail): void {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent<TaskAddedDetail>('force:task-added', { detail }));

  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    new Notification('Task added', {
      body: `${detail.title} (${sourceLabel(detail.source)})`,
      tag: `force-task-added-${detail.source}-${detail.title}`,
    });
  } catch {
    // Ignore notification errors.
  }
}
