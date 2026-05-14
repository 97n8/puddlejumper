import {
  ArrowUpRight,
  Briefcase,
  FileSearch,
  Gauge,
  Globe,
  Plus,
  Workflow,
} from 'lucide-react';
import type { Task, Case, Endpoints } from '../types';
import { SwipeRow } from './SwipeRow';
import { haptic } from '../lib/haptic';

interface TodayViewProps {
  tasks: Task[];
  cases: Case[];
  captureCount: number;
  online: boolean;
  endpoints: Endpoints;
  onToggleTask: (taskId: string) => void;
  onOpenCase: (caseId: string) => void;
  onShowCapture: () => void;
}

export function TodayView({
  tasks,
  cases,
  captureCount,
  online,
  endpoints,
  onToggleTask,
  onOpenCase,
  onShowCapture
}: TodayViewProps) {
  const incompleteTasks = tasks.filter(t => !t.done);
  const completedTasks = tasks.filter(t => t.done);
  const dashboardUrl = `${endpoints.puddleJumper.replace(/\/+$/, '')}/pj/admin#dashboard`;
  const operationsUrl = `${endpoints.puddleJumper.replace(/\/+$/, '')}/pj/admin`;
  const intakeUrl = `${endpoints.puddleJumper.replace(/\/+$/, '')}/prr.html`;
  const requestStatusUrl = `${endpoints.puddleJumper.replace(/\/+$/, '')}/prr-status.html`;
  const guideUrl = `${endpoints.puddleJumper.replace(/\/+$/, '')}/pj/guide`;
  const launchTiles = [
    {
      title: 'LogicOS',
      subtitle: 'Companion',
      description: 'Open the wider operator workspace.',
      href: endpoints.logicOS,
      icon: Workflow
    },
    {
      title: 'PJ Operations',
      subtitle: 'Backend',
      description: 'Go straight into PuddleJumper control.',
      href: operationsUrl,
      icon: Briefcase
    },
    {
      title: 'System Guide',
      subtitle: 'Maps',
      description: 'Open the L1-L4 system view.',
      href: guideUrl,
      icon: FileSearch
    },
    {
      title: 'PublicLogic',
      subtitle: 'Public',
      description: 'Jump to the broader PublicLogic surface.',
      href: endpoints.publicLogic,
      icon: Globe
    }
  ] as const;

  const renderTask = (task: Task) => {
    const taskCase = cases.find(c => c.id === task.caseId);

    return (
      <SwipeRow
        key={task.id}
        onSwipeRight={() => {
          onToggleTask(task.id);
          haptic('success');
        }}
      >
        <div className="bg-white border border-gray-200 rounded-lg p-3 mb-2">
          <div className="flex items-start gap-3">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => onToggleTask(task.id)}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                aria-label={`Mark "${task.text}" as ${task.done ? 'incomplete' : 'complete'}`}
              />
            </label>

            <div className="flex-1 min-w-0">
              <p className={`text-sm ${task.done ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                {task.text}
              </p>
              {taskCase && (
                <button
                  onClick={() => onOpenCase(taskCase.id)}
                  className="mt-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  {taskCase.name}
                </button>
              )}
            </div>
          </div>
        </div>
      </SwipeRow>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-y-auto">
      <div className="p-4">
        <div className="rounded-2xl bg-gray-900 text-white p-4 mb-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400">Home</p>
              <h2 className="text-xl font-semibold mt-1">The mobile entrance to all things PL.</h2>
              <p className="text-sm text-gray-300 mt-2 leading-6">
                {online
                  ? 'Start with Dashboard or Intake, then move into the rest of PublicLogic from the launch grid below.'
                  : 'Start with Dashboard or Intake here, then move through PublicLogic even while the live PJ probe is down.'}
              </p>
            </div>
            <a
              href={dashboardUrl}
              className="shrink-0 inline-flex items-center gap-1 px-3 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-400 transition-colors text-sm font-medium"
            >
              <Gauge className="w-4 h-4" aria-hidden="true" />
              <span>Dashboard</span>
            </a>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900">Fast lane</h3>
            <span className="text-xs uppercase tracking-[0.14em] text-gray-400">Primary actions</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <a
              href={dashboardUrl}
              className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 hover:border-emerald-300 hover:bg-emerald-100/80 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-700">Dash</p>
                  <strong className="block text-sm text-gray-900 mt-1">Operational Dashboard</strong>
                  <p className="text-sm text-gray-600 mt-1">Go straight to the PJ dashboard without getting lost in tabs.</p>
                </div>
                <Gauge className="w-5 h-5 text-emerald-700 shrink-0" aria-hidden="true" />
              </div>
            </a>

            <a
              href={intakeUrl}
              className="rounded-xl border border-sky-200 bg-sky-50 p-4 hover:border-sky-300 hover:bg-sky-100/80 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-sky-700">Intake</p>
                  <strong className="block text-sm text-gray-900 mt-1">Public Records Intake</strong>
                  <p className="text-sm text-gray-600 mt-1">Open the PRR intake flow immediately from the mobile entrance.</p>
                </div>
                <ArrowUpRight className="w-5 h-5 text-sky-700 shrink-0" aria-hidden="true" />
              </div>
            </a>

            <a
              href={requestStatusUrl}
              className="rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-200 hover:bg-blue-50/60 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-gray-500">Status</p>
                  <strong className="block text-sm text-gray-900 mt-1">Check request status</strong>
                  <p className="text-sm text-gray-600 mt-1">Track submitted requests without opening the full admin surface.</p>
                </div>
                <FileSearch className="w-5 h-5 text-gray-500 shrink-0" aria-hidden="true" />
              </div>
            </a>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-xl bg-white border border-gray-200 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-gray-400">Tasks</p>
            <strong className="block text-lg text-gray-900 mt-2">{incompleteTasks.length}</strong>
          </div>
          <div className="rounded-xl bg-white border border-gray-200 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-gray-400">Cases</p>
            <strong className="block text-lg text-gray-900 mt-2">{cases.length}</strong>
          </div>
          <div className="rounded-xl bg-white border border-gray-200 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-gray-400">Captures</p>
            <strong className="block text-lg text-gray-900 mt-2">{captureCount}</strong>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Launch</h3>
              <p className="text-xs text-gray-500 mt-1">Everything else</p>
            </div>
            <button
              onClick={onShowCapture}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              aria-label="Quick capture"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Capture</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {launchTiles.map((tile) => {
              const Icon = tile.icon;
              return (
                <a
                  key={tile.title}
                  href={tile.href}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-3 hover:border-blue-200 hover:bg-blue-50/60 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-gray-500">{tile.subtitle}</p>
                      <strong className="block text-sm text-gray-900 mt-1">{tile.title}</strong>
                      <p className="text-xs text-gray-600 mt-1 leading-5">{tile.description}</p>
                    </div>
                    <Icon className="w-4 h-4 text-gray-500 shrink-0" aria-hidden="true" />
                  </div>
                </a>
              );
            })}
          </div>
        </div>

        {incompleteTasks.length === 0 && completedTasks.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No tasks yet</p>
            <button
              onClick={onShowCapture}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Add your first task
            </button>
          </div>
        )}

        {incompleteTasks.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Queue</h3>
            {incompleteTasks.map(renderTask)}
          </div>
        )}

        {completedTasks.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-600 mb-2">Completed</h3>
            {completedTasks.map(renderTask)}
          </div>
        )}
      </div>
    </div>
  );
}
