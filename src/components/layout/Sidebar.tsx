import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Menu,
  X,
  MessageSquare,
  Calendar,
  Settings,
  Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  className?: string;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  // Check if we're on mobile and handle resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
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
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      name: "Notion Workspace",
      href: "/notion",
      icon: <FileText className="h-5 w-5" />,
    },
    {
      name: "AI Assistant",
      href: "/assistant",
      icon: <Brain className="h-5 w-5" />,
    },
    {
      name: "Messages",
      href: "/messages",
      icon: <MessageSquare className="h-5 w-5" />,
      badge: "New",
    },
    {
      name: "Calendar",
      href: "/calendar",
      icon: <Calendar className="h-5 w-5" />,
    },
    {
      name: "Settings",
      href: "/settings",
      icon: <Settings className="h-5 w-5" />,
    },
  ];

  // Animation variants for the sidebar
  const sidebarVariants = {
    expanded: {
      width: "240px",
      transition: { duration: 0.3, ease: "easeInOut" },
    },
    collapsed: {
      width: isMobile ? "0px" : "72px",
      transition: { duration: 0.3, ease: "easeInOut" },
    },
  };

  // Animation variants for the content
  const contentVariants = {
    expanded: {
      opacity: 1,
      x: 0,
      transition: { delay: 0.1, duration: 0.2 },
    },
    collapsed: {
      opacity: isMobile ? 0 : 1,
      x: isMobile ? -20 : 0,
      transition: { duration: 0.2 },
    },
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && !isCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-30 backdrop-blur-sm"
          onClick={() => setIsCollapsed(true)}
        />
      )}

      {/* Toggle button for mobile */}
      {isMobile && (
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="fixed top-4 left-4 z-50 rounded-md p-2 bg-background/80 backdrop-blur-sm border border-border/50 text-foreground"
        >
          {isCollapsed ? (
            <Menu className="h-5 w-5" />
          ) : (
            <X className="h-5 w-5" />
          )}
        </button>
      )}

      {/* Main sidebar */}
      <motion.div
        variants={sidebarVariants}
        initial={isMobile ? "collapsed" : "expanded"}
        animate={isCollapsed ? "collapsed" : "expanded"}
        className={cn(
          "fixed top-0 left-0 h-full z-40 flex flex-col",
          "bg-gradient-to-b from-gray-900/95 via-gray-900/98 to-gray-900/95",
          "border-r border-purple-500/20 backdrop-blur-md",
          "overflow-hidden",
          className
        )}
      >
        {/* Logo */}
        <div className="p-4 border-b border-purple-500/20">
          <motion.div
            variants={contentVariants}
            initial="collapsed"
            animate={isCollapsed && isMobile ? "collapsed" : "expanded"}
            className="flex items-center"
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">MR</span>
            </div>
            {(!isCollapsed || !isMobile) && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  "ml-3 font-semibold text-lg bg-gradient-to-r from-purple-400 via-pink-400 to-purple-600 bg-clip-text text-transparent",
                  isCollapsed && !isMobile && "hidden"
                )}
              >
                MuseRoom
              </motion.span>
            )}
          </motion.div>
        </div>

        {/* Navigation */}
        <div className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1 px-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className={cn(
                      "flex items-center px-3 py-2.5 rounded-lg group transition-all duration-200",
                      isActive
                        ? "bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-purple-300 border border-purple-500/30"
                        : "hover:bg-gray-800/50 text-gray-400 hover:text-gray-200"
                    )}
                  >
                    <div
                      className={cn(
                        "flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-md",
                        isActive
                          ? "bg-gradient-to-br from-purple-600/30 to-pink-600/30 text-purple-300"
                          : "text-gray-400 group-hover:text-gray-200"
                      )}
                    >
                      {item.icon}
                    </div>
                    {(!isCollapsed || !isMobile) && (
                      <motion.span
                        variants={contentVariants}
                        className={cn(
                          "ml-3 whitespace-nowrap",
                          isCollapsed && !isMobile && "hidden"
                        )}
                      >
                        {item.name}
                        {item.badge && (
                          <span className="ml-2 px-1.5 py-0.5 text-xs rounded-md bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                            {item.badge}
                          </span>
                        )}
                      </motion.span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Footer with collapse toggle */}
        {!isMobile && (
          <div className="p-3 border-t border-purple-500/20">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={cn(
                "w-full flex items-center justify-center p-2 rounded-md transition-colors",
                "hover:bg-gray-800/50 text-gray-400 hover:text-gray-200"
              )}
            >
              <Menu className="h-5 w-5" />
              {!isCollapsed && (
                <motion.span
                  variants={contentVariants}
                  className="ml-3 whitespace-nowrap"
                >
                  Collapse
                </motion.span>
              )}
            </button>
          </div>
        )}
      </motion.div>
    </>
  );
}

export default Sidebar;
