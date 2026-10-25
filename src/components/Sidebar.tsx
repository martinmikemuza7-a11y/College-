import React from 'react';
import {
  BarChart3,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Download,
  FileText,
  Folder,
  GraduationCap,
  HardDrive,
  Home,
  Layers,
  LayoutDashboard,
  Library,
  Plus,
  Settings,
  Sparkles,
} from 'lucide-react';
import { Course } from '../types';
import { NavigationTab } from './Header';

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  courseCount?: number;
  docCount?: number;
  courses?: Course[];
  activeCourse?: Course | null;
  onSelectCourse?: (course: Course) => void;
  onOpenCreateCourseModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
  courseCount = 0,
  docCount = 0,
  courses = [],
  activeCourse = null,
  onSelectCourse,
  onOpenCreateCourseModal,
}) => {
  const navSections = [
    {
      title: 'Workspace',
      items: [
        { id: 'dashboard' as NavigationTab, label: 'Home', icon: LayoutDashboard },
        { id: 'tutor' as NavigationTab, label: 'AI Tutor', icon: Sparkles, badge: 'Grounded' },
      ],
    },
    {
      title: 'Learning & Notes',
      items: [
        { id: 'materials' as NavigationTab, label: 'Materials & Notes', icon: Folder, count: docCount },
        { id: 'past_papers' as NavigationTab, label: 'Past Papers', icon: FileText },
        { id: 'study' as NavigationTab, label: 'Exam Generator & Mock', icon: Cpu, badge: 'AI Exam' },
        { id: 'study' as NavigationTab, label: 'Recall Quizzes', icon: GraduationCap },
      ],
    },
    {
      title: 'Tools & Analytics',
      items: [
        { id: 'calendar' as NavigationTab, label: 'Study Calendar & Timer', icon: Calendar },
        { id: 'rag' as NavigationTab, label: 'RAG Explorer', icon: Layers },
        { id: 'diagnostics' as NavigationTab, label: 'Progress & Settings', icon: BarChart3 },
        { id: 'pwainstaller' as NavigationTab, label: 'Offline PWA', icon: Download },
      ],
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden animate-in fade-in"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 bg-white border-r border-slate-200/90 flex flex-col transition-all duration-300 ease-in-out shadow-[1px_0_12px_rgba(15,23,42,0.03)]
          ${collapsed ? 'w-[72px]' : 'w-[260px]'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Header / Brand */}
        <div className={`h-16 flex items-center border-b border-slate-100 shrink-0 ${collapsed ? 'px-3 justify-center' : 'px-5 justify-between'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl sb-gradient-primary flex items-center justify-center text-white shadow-sm shadow-indigo-200 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <span className="font-bold text-[15px] text-slate-900 tracking-tight block leading-tight truncate">
                  Study Buddy AI
                </span>
                <span className="text-[11px] font-medium text-slate-400 block truncate">
                  Vector RAG Platform
                </span>
              </div>
            )}
          </div>

          {!collapsed && (
            <button
              onClick={onToggleCollapsed}
              className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Collapsed expand toggle button */}
        {collapsed && (
          <div className="hidden lg:flex justify-center pt-2">
            <button
              onClick={onToggleCollapsed}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              title="Expand sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Course Quick Switcher & New Course Button */}
        {!collapsed ? (
          <div className="px-3 pt-3 pb-1 border-b border-slate-100">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Course Scope
                </span>
                {onOpenCreateCourseModal && (
                  <button
                    onClick={() => {
                      onOpenCreateCourseModal();
                      onCloseMobile();
                    }}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition cursor-pointer"
                    title="Create New Course"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New Course</span>
                  </button>
                )}
              </div>

              {activeCourse ? (
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-white"
                      style={{ backgroundColor: activeCourse.color || '#4F46E5' }}
                    />
                    <span
                      className="text-xs font-bold text-slate-800 truncate"
                      title={`${activeCourse.code} • ${activeCourse.title}`}
                    >
                      {activeCourse.code}
                    </span>
                  </div>

                  {courses.length > 1 && onSelectCourse && (
                    <select
                      aria-label="Switch Course"
                      value={activeCourse.id}
                      onChange={(e) => {
                        const target = courses.find((c) => c.id === e.target.value);
                        if (target) onSelectCourse(target);
                      }}
                      className="text-[11px] font-medium text-slate-500 bg-transparent border-0 cursor-pointer focus:outline-none max-w-[90px] truncate"
                    >
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (onOpenCreateCourseModal) onOpenCreateCourseModal();
                    onCloseMobile();
                  }}
                  className="w-full py-1.5 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Course</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="px-2 pt-2 pb-1 flex justify-center border-b border-slate-100">
            <button
              onClick={() => {
                if (onOpenCreateCourseModal) onOpenCreateCourseModal();
              }}
              className="w-8 h-8 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 flex items-center justify-center transition cursor-pointer"
              title="Create New Course"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Nav Items List */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-6 no-scrollbar text-xs">
          {navSections.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1">
              {!collapsed && (
                <div className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {section.title}
                </div>
              )}

              {section.items.map((item, iIdx) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={iIdx}
                    onClick={() => {
                      onSelectTab(item.id);
                      onCloseMobile();
                    }}
                    className={`w-full flex items-center gap-3 rounded-xl transition text-left font-medium cursor-pointer select-none
                      ${collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'}
                      ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                      }
                    `}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-indigo-600' : 'text-slate-400'
                      }`}
                    />

                    {!collapsed && (
                      <span className="truncate flex-1">{item.label}</span>
                    )}

                    {!collapsed && item.badge && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-100 text-indigo-700 shrink-0">
                        {item.badge}
                      </span>
                    )}

                    {!collapsed && typeof item.count === 'number' && item.count > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 shrink-0">
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom PWA / Offline Status footer */}
        {!collapsed && (
          <div className="p-3 border-t border-slate-100 shrink-0">
            <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-50/80 to-teal-50/60 border border-indigo-100/80 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-800">IndexedDB Synced</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                Offline learning enabled with zero latency.
              </p>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
