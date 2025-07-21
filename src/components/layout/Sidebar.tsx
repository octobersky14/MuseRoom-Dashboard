import React, { useState, useEffect, useContext, createContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  Calendar,
  Settings,
  Brain,
  Zap,
  User,
  MessageCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

// Create a context for sidebar state
interface SidebarContextType {
  sidebarWidth: number;
  isExpanded: boolean;
  isHovering: boolean;
}

const SidebarContext = createContext<SidebarContextType>({
  sidebarWidth: 80,
  isExpanded: false,
  isHovering: false
});

// Hook to use sidebar context
export const useSidebar = () => useContext(SidebarContext);

interface SidebarProps {
  className?: string;
  onWidthChange?: (width: number) => void;
  defaultCollapsed?: boolean;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  active?: boolean;
}

export function Sidebar({ 
  className, 
  onWidthChange,
  defaultCollapsed = true
}: SidebarProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(isCollapsed ? 80 : 280);
  const location = useLocation();

  // Enable dark mode
  useEffect(() => {
    document.documentElement.classList.add("dark");
    // NOTE: do NOT remove the "dark" class on unmount.
    // This ensures the application stays in dark mode across
    // route transitions and component remounts.
  }, []);

  // Update sidebar width when collapsed or hovered state changes
  useEffect(() => {
    const newWidth = isCollapsed && !isHovered ? 80 : 280;
    setSidebarWidth(newWidth);
    
    // Notify parent component about width change
    if (onWidthChange) {
      onWidthChange(newWidth);
    }
  }, [isCollapsed, isHovered, onWidthChange]);

  // Check if we're on mobile and handle resize
  useEffect(() => {
    const checkMobile = () => {
      const isMobileView = window.innerWidth < 768;
      setIsMobile(isMobileView);
      if (isMobileView) {
        setIsCollapsed(true);
      }
    };

    // Initial check
    checkMobile();

    // Add resize listener
    window.addEventListener("resize", checkMobile);

    // Cleanup
    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  // Navigation items
  const navItems: NavItem[] = [
    {
      name: "Dashboard",
      href: "/",
      icon: LayoutDashboard,
      active: location.pathname === "/"
    },
    {
      name: "AI Chat",
      href: "/chat",
      icon: MessageCircle,
      badge: "New",
      active: location.pathname === "/chat"
    },
    {
      name: "Discord",
      href: "/discord",
      icon: MessageSquare,
      active: location.pathname === "/discord"
    },
    {
      name: "Settings",
      href: "/settings",
      icon: Settings,
      active: location.pathname === "/settings"
    },
  ];

  // Create context value
  const contextValue: SidebarContextType = {
    sidebarWidth,
    isExpanded: !isCollapsed || isHovered,
    isHovering: isHovered
  };

  return (
    <SidebarContext.Provider value={contextValue}>
      {/* Mobile overlay */}
      {isMobile && !isCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-30 backdrop-blur-sm"
          onClick={() => setIsCollapsed(true)}
        />
      )}

      {/* Main sidebar */}
      <motion.div
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "fixed top-0 left-0 h-screen z-40 flex flex-col",
          "bg-gradient-to-b from-slate-900/95 to-slate-950/95 backdrop-blur-xl",
          "border-r border-slate-700/50 overflow-hidden",
          className
        )}
        style={{
          width: `${sidebarWidth}px`,
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {/* Floating glow effects */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-cyan-500/10 blur-xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/5 to-transparent" />
        
        {/* Logo */}
        <div className="relative p-6 border-b border-slate-700/50">
          <motion.div 
            className="flex items-center gap-3"
            layout
          >
            <div className="relative">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/25">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-blue-600 rounded-lg blur-md opacity-50 animate-pulse" />
            </div>
            <AnimatePresence>
              {(!isCollapsed || isHovered) && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col"
                >
                  <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-500 bg-clip-text text-transparent font-semibold text-lg">MuseRoom</span>
                  <span className="text-slate-400 text-xs">Dashboard</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Navigation */}
        <div className="relative p-4 space-y-2 flex-1 overflow-y-auto">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = item.active;
            const isItemHovered = hoveredItem === item.name;

            return (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
                className="relative"
                onMouseEnter={() => setHoveredItem(item.name)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                {/* Glow effect for active/hovered items */}
                <AnimatePresence>
                  {(isActive || isItemHovered) && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className={`absolute inset-0 rounded-xl blur-lg ${
                        isActive 
                          ? 'bg-gradient-to-r from-purple-500/30 to-blue-500/30' 
                          : 'bg-gradient-to-r from-slate-500/20 to-slate-400/20'
                      }`}
                    />
                  )}
                </AnimatePresence>

                <Link to={item.href}>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`relative w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group ${
                      isActive
                        ? 'bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-white border border-purple-500/30'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="relative">
                      <Icon className={`w-5 h-5 transition-colors ${
                        isActive ? 'text-purple-400' : 'text-slate-400 group-hover:text-white'
                      }`} />
                      {isActive && (
                        <div className="absolute inset-0 blur-sm">
                          <Icon className="w-5 h-5 text-purple-400 opacity-50" />
                        </div>
                      )}
                    </div>

                    {(!isCollapsed || isHovered) && (
                      <div className="flex-1 flex items-center justify-between">
                        <span className="font-medium">{item.name}</span>
                        {item.badge && (
                          <div className="relative">
                            <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs px-2 py-1 rounded-full min-w-[20px] text-center shadow-lg shadow-purple-500/25">
                              {item.badge}
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full blur-md opacity-50 animate-pulse" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tooltip for collapsed state */}
                    <AnimatePresence>
                      {isCollapsed && !isHovered && hoveredItem === item.name && (
                        <motion.div
                          initial={{ opacity: 0, x: -10, scale: 0.9 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, x: -10, scale: 0.9 }}
                          className="absolute left-full ml-4 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg border border-slate-700 shadow-xl z-50 whitespace-nowrap"
                        >
                          {item.name}
                          {item.badge && (
                            <span className="ml-2 bg-purple-500 text-xs px-1.5 py-0.5 rounded-full">
                              {item.badge}
                            </span>
                          )}
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-slate-800 border-l border-b border-slate-700 rotate-45" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* User Profile Section */}
        <div className="relative p-4 border-t border-slate-700/50 bg-gradient-to-t from-slate-950/95 to-transparent">
          {(!isCollapsed || isHovered) && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 shadow-2xl">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-600 flex items-center justify-center text-white font-semibold shadow-lg">
                  <User className="w-5 h-5" />
                </div>
                <div className="absolute -inset-1 bg-gradient-to-br from-purple-400 to-blue-600 rounded-full blur-sm opacity-30 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium text-sm truncate">User Account</div>
                <div className="text-slate-400 text-xs truncate">Workspace Admin</div>
              </div>
            </div>
          )}
          
          {isCollapsed && !isHovered && (
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-600 flex items-center justify-center text-white font-semibold shadow-lg">
                  <User className="w-5 h-5" />
                </div>
                <div className="absolute -inset-1 bg-gradient-to-br from-purple-400 to-blue-600 rounded-full blur-sm opacity-30 animate-pulse" />
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </SidebarContext.Provider>
  );
}

export default Sidebar;
