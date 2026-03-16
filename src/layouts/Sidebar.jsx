import { NavLink } from "react-router-dom";

import {
  RiDashboardLine,
  RiDatabase2Line,
  RiSettings3Line,
  RiMenuFoldLine,
  RiMenuUnfoldLine,
} from "@remixicon/react";
import { NAV_ITEMS } from "../config/routes";
import { APP_NAME, APP_SUBTITLE } from "../config/constants";

const iconMap = {
  RiDashboardLine: RiDashboardLine,
  RiDatabase2Line: RiDatabase2Line,
  RiSettings3Line: RiSettings3Line,
};

export default function Sidebar({ collapsed, onToggle }) {
  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-slate-900 text-white z-40 flex flex-col transition-all duration-300 ${
        collapsed ? "w-18" : "w-65"
      }`}
    >
      {/* Logo area */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-700/50">
        {/* <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-sm">IVR</span>
        </div> */}
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-semibold leading-tight truncate">
              {APP_NAME}
            </h1>
            <p className="text-[10px] text-slate-400 leading-tight truncate">
              {APP_SUBTITLE}
            </p>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = iconMap[item.icon];
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                  isActive
                    ? "bg-blue-500/20 text-blue-400 font-medium"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              {Icon && <Icon size={20} className="shrink-0" />}
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="px-2 py-3 border-t border-slate-700/50">
        <button
          onClick={onToggle}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors w-full text-sm"
        >
          {collapsed ? (
            <RiMenuUnfoldLine size={20} />
          ) : (
            <>
              <RiMenuFoldLine size={20} />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>

      {/* User area */}
      <div className="px-3 py-3 border-t border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
            <span className="text-xs font-medium">AU</span>
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">Admin User</p>
              <p className="text-[10px] text-slate-400 truncate">
                Administrator
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
