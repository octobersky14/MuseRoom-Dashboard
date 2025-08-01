import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Settings as SettingsIcon,
  Bell,
  Moon,
  User,
  Key,
  Save,
  LogOut,
  Check,
  X,
  AlertTriangle,
  Eye,
  EyeOff,
  RefreshCw,
  Loader2,
  ExternalLink,
  MessageSquare,
  Calendar,
  Volume2,
  Mail,
  FileText,
  Palette,
  Info,
  Zap,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
import { SplashCursor } from "@/components/ui/splash-cursor";
// import { useSidebar } from "@/components/layout/Sidebar";

// Audio for notification sounds
const notificationSound = new Audio("/sounds/notification.mp3");

// Mock OAuth services - in a real app, these would be actual OAuth implementations
const mockDiscordOAuth = {
  signIn: () =>
    new Promise<{ success: boolean; data?: any; error?: string }>((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          data: {
            id: "123456789",
            username: "MuseRoomUser",
            discriminator: "1234",
            avatar: "https://cdn.discordapp.com/avatars/123456789/abcdef.png",
            email: "user@example.com",
            verified: true,
          },
        });
      }, 1500);
    }),
  signOut: () =>
    new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(true), 800);
    }),
};

const mockGoogleOAuth = {
  signIn: () =>
    new Promise<{ success: boolean; data?: any; error?: string }>((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          data: {
            id: "987654321",
            name: "MuseRoom User",
            email: "user@example.com",
            picture: "https://lh3.googleusercontent.com/a/default-user",
            accessToken: "ya29.a0AfB_byC...",
            expiresAt: Date.now() + 3600000,
          },
        });
      }, 1500);
    }),
  signOut: () =>
    new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(true), 800);
    }),
};

// Local storage keys
const STORAGE_KEYS = {
  APPEARANCE: "museroom-appearance-settings",
  NOTIFICATIONS: "museroom-notification-settings",
  API_KEYS: "museroom-api-keys",
  ACCOUNT: "museroom-account-info",
};

const Settings: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("account");
  const [showApiKeys, setShowApiKeys] = useState(false);

  // Account settings
  const [username, setUsername] = useState("MuseRoom User");
  const [email, setEmail] = useState("user@example.com");
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  // Connection states
  const [discordConnection, setDiscordConnection] = useState<{
    connected: boolean;
    loading: boolean;
    error: string | null;
    data: any | null;
  }>({
    connected: false,
    loading: false,
    error: null,
    data: null,
  });

  const [googleConnection, setGoogleConnection] = useState<{
    connected: boolean;
    loading: boolean;
    error: string | null;
    data: any | null;
  }>({
    connected: false,
    loading: false,
    error: null,
    data: null,
  });

  // API keys
  const [apiKeys, setApiKeys] = useState({
    gemini: import.meta.env.VITE_GEMINI_API_KEY || "",
    elevenlabs: import.meta.env.VITE_ELEVENLABS_API_KEY || "",
    notion: import.meta.env.VITE_NOTION_API_KEY || "",
  });
  const [isSavingApiKeys, setIsSavingApiKeys] = useState(false);

  // Appearance settings - Removed theme property as requested
  const [appearanceSettings, setAppearanceSettings] = useState({
    animationsEnabled: true,
    glassEffectsEnabled: true,
    sidebarCollapsed: true,
    highContrastMode: false,
  });
  const [isSavingAppearance, setIsSavingAppearance] = useState(false);

  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    soundEnabled: true,
    discordNotifications: false,
    calendarReminders: true,
    notionUpdates: true,
  });
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);

  // Load settings from localStorage on component mount
  useEffect(() => {
    // Load appearance settings
    const savedAppearance = localStorage.getItem(STORAGE_KEYS.APPEARANCE);
    if (savedAppearance) {
      try {
        const parsedSettings = JSON.parse(savedAppearance);
        setAppearanceSettings((prevSettings) => ({
          ...prevSettings,
          ...parsedSettings,
        }));
      } catch (error) {
        console.error("Failed to parse appearance settings:", error);
      }
    }

    // Load notification settings
    const savedNotifications = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    if (savedNotifications) {
      try {
        const parsedSettings = JSON.parse(savedNotifications);
        setNotificationSettings((prevSettings) => ({
          ...prevSettings,
          ...parsedSettings,
        }));
      } catch (error) {
        console.error("Failed to parse notification settings:", error);
      }
    }

    // Load API keys (in a real app, these would be securely stored)
    const savedApiKeys = localStorage.getItem(STORAGE_KEYS.API_KEYS);
    if (savedApiKeys) {
      try {
        const parsedKeys = JSON.parse(savedApiKeys);
        setApiKeys((prevKeys) => ({
          ...prevKeys,
          ...parsedKeys,
        }));
      } catch (error) {
        console.error("Failed to parse API keys:", error);
      }
    }

    // Load account info
    const savedAccount = localStorage.getItem(STORAGE_KEYS.ACCOUNT);
    if (savedAccount) {
      try {
        const parsedAccount = JSON.parse(savedAccount);
        if (parsedAccount.username) setUsername(parsedAccount.username);
        if (parsedAccount.email) setEmail(parsedAccount.email);
      } catch (error) {
        console.error("Failed to parse account info:", error);
      }
    }
  }, []);

  // Stronger dark mode enforcement that NEVER allows light mode
  useEffect(() => {
    // Add dark mode class
    document.documentElement.classList.add("dark");

    // Create a MutationObserver to ensure dark mode is never removed
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "class" &&
          !document.documentElement.classList.contains("dark")
        ) {
          // Re-add dark class if it was removed
          document.documentElement.classList.add("dark");
        }
      });
    });

    // Start observing document.documentElement for class changes
    observer.observe(document.documentElement, { attributes: true });

    // Do NOT remove dark class on unmount
    return () => {
      observer.disconnect();
      // Explicitly ensure dark mode remains when component unmounts
      document.documentElement.classList.add("dark");
    };
  }, []);

  // Apply appearance settings when they change
  useEffect(() => {
    // Save to localStorage
    localStorage.setItem(
      STORAGE_KEYS.APPEARANCE,
      JSON.stringify(appearanceSettings)
    );

    // Apply animations setting
    if (appearanceSettings.animationsEnabled) {
      document.documentElement.classList.remove("reduce-motion");
      document.documentElement.style.setProperty("--animate-duration", "0.3s");
    } else {
      document.documentElement.classList.add("reduce-motion");
      document.documentElement.style.setProperty("--animate-duration", "0s");
    }

    // Apply glass effects setting
    if (appearanceSettings.glassEffectsEnabled) {
      document.documentElement.classList.remove("no-glass");
      document.documentElement.style.setProperty("--blur-amount", "8px");
    } else {
      document.documentElement.classList.add("no-glass");
      document.documentElement.style.setProperty("--blur-amount", "0px");
    }

    // Apply high contrast mode
    if (appearanceSettings.highContrastMode) {
      document.documentElement.classList.add("high-contrast");
    } else {
      document.documentElement.classList.remove("high-contrast");
    }

    // Note: We're not handling sidebarCollapsed here as we don't want toggles
  }, [appearanceSettings]);

  // Apply notification settings when they change
  useEffect(() => {
    // Save to localStorage
    localStorage.setItem(
      STORAGE_KEYS.NOTIFICATIONS,
      JSON.stringify(notificationSettings)
    );

    // Request browser notification permissions if enabled
    if (notificationSettings.pushNotifications && "Notification" in window) {
      if (
        Notification.permission !== "granted" &&
        Notification.permission !== "denied"
      ) {
        Notification.requestPermission();
      }
    }
  }, [notificationSettings]);

  // Handle Discord sign in
  const handleDiscordSignIn = async () => {
    setDiscordConnection((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));

    try {
      const result = await mockDiscordOAuth.signIn();

      if (result.success && result.data) {
        setDiscordConnection({
          connected: true,
          loading: false,
          error: null,
          data: result.data,
        });

        toast({
          title: "Discord Connected",
          description: `Successfully connected as ${result.data.username}#${result.data.discriminator}`,
          variant: "default",
        });

        // Play notification sound if enabled
        if (notificationSettings.soundEnabled) {
          notificationSound
            .play()
            .catch((e) => console.error("Error playing sound:", e));
        }
      } else {
        throw new Error(result.error || "Failed to connect to Discord");
      }
    } catch (error) {
      setDiscordConnection({
        connected: false,
        loading: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        data: null,
      });

      toast({
        title: "Discord Connection Failed",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  // Handle Discord sign out
  const handleDiscordSignOut = async () => {
    setDiscordConnection((prev) => ({
      ...prev,
      loading: true,
    }));

    try {
      await mockDiscordOAuth.signOut();

      setDiscordConnection({
        connected: false,
        loading: false,
        error: null,
        data: null,
      });

      toast({
        title: "Discord Disconnected",
        description: "Successfully disconnected from Discord",
        variant: "default",
      });

      // Play notification sound if enabled
      if (notificationSettings.soundEnabled) {
        notificationSound
          .play()
          .catch((e) => console.error("Error playing sound:", e));
      }
    } catch (error) {
      setDiscordConnection((prev) => ({
        ...prev,
        loading: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      }));

      toast({
        title: "Error Disconnecting",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  // Handle Google Calendar sign in
  const handleGoogleSignIn = async () => {
    setGoogleConnection((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));

    try {
      const result = await mockGoogleOAuth.signIn();

      if (result.success && result.data) {
        setGoogleConnection({
          connected: true,
          loading: false,
          error: null,
          data: result.data,
        });

        toast({
          title: "Google Calendar Connected",
          description: `Successfully connected as ${result.data.name}`,
          variant: "default",
        });

        // Play notification sound if enabled
        if (notificationSettings.soundEnabled) {
          notificationSound
            .play()
            .catch((e) => console.error("Error playing sound:", e));
        }
      } else {
        throw new Error(result.error || "Failed to connect to Google Calendar");
      }
    } catch (error) {
      setGoogleConnection({
        connected: false,
        loading: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        data: null,
      });

      toast({
        title: "Google Calendar Connection Failed",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  // Handle Google Calendar sign out
  const handleGoogleSignOut = async () => {
    setGoogleConnection((prev) => ({
      ...prev,
      loading: true,
    }));

    try {
      await mockGoogleOAuth.signOut();

      setGoogleConnection({
        connected: false,
        loading: false,
        error: null,
        data: null,
      });

      toast({
        title: "Google Calendar Disconnected",
        description: "Successfully disconnected from Google Calendar",
        variant: "default",
      });

      // Play notification sound if enabled
      if (notificationSettings.soundEnabled) {
        notificationSound
          .play()
          .catch((e) => console.error("Error playing sound:", e));
      }
    } catch (error) {
      setGoogleConnection((prev) => ({
        ...prev,
        loading: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      }));

      toast({
        title: "Error Disconnecting",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  // Save account settings
  const handleSaveAccount = async () => {
    setIsSavingAccount(true);

    // Save to localStorage
    localStorage.setItem(
      STORAGE_KEYS.ACCOUNT,
      JSON.stringify({ username, email })
    );

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setIsSavingAccount(false);

    toast({
      title: "Account Updated",
      description: "Your account settings have been saved successfully",
      variant: "default",
    });

    // Play notification sound if enabled
    if (notificationSettings.soundEnabled) {
      notificationSound
        .play()
        .catch((e) => console.error("Error playing sound:", e));
    }
  };

  // Save API keys
  const handleSaveApiKeys = async () => {
    setIsSavingApiKeys(true);

    // Save to localStorage (in a real app, these would be securely stored)
    localStorage.setItem(STORAGE_KEYS.API_KEYS, JSON.stringify(apiKeys));

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setIsSavingApiKeys(false);

    toast({
      title: "API Keys Updated",
      description: "Your API keys have been saved successfully",
      variant: "default",
    });

    // Play notification sound if enabled
    if (notificationSettings.soundEnabled) {
      notificationSound
        .play()
        .catch((e) => console.error("Error playing sound:", e));
    }
  };

  // Save appearance settings
  const handleSaveAppearance = async () => {
    setIsSavingAppearance(true);

    // Save to localStorage
    localStorage.setItem(
      STORAGE_KEYS.APPEARANCE,
      JSON.stringify(appearanceSettings)
    );

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setIsSavingAppearance(false);

    toast({
      title: "Appearance Updated",
      description: "Your appearance settings have been saved successfully",
      variant: "default",
    });

    // Play notification sound if enabled
    if (notificationSettings.soundEnabled) {
      notificationSound
        .play()
        .catch((e) => console.error("Error playing sound:", e));
    }
  };

  // Save notification settings
  const handleSaveNotifications = async () => {
    setIsSavingNotifications(true);

    // Save to localStorage
    localStorage.setItem(
      STORAGE_KEYS.NOTIFICATIONS,
      JSON.stringify(notificationSettings)
    );

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setIsSavingNotifications(false);

    toast({
      title: "Notifications Updated",
      description: "Your notification settings have been saved successfully",
      variant: "default",
    });

    // Play notification sound if enabled
    if (notificationSettings.soundEnabled) {
      notificationSound
        .play()
        .catch((e) => console.error("Error playing sound:", e));
    }

    // Request browser notification permissions if enabled
    if (notificationSettings.pushNotifications && "Notification" in window) {
      if (
        Notification.permission !== "granted" &&
        Notification.permission !== "denied"
      ) {
        Notification.requestPermission();
      }
    }
  };

  // Toggle API key visibility
  const toggleApiKeyVisibility = () => {
    setShowApiKeys(!showApiKeys);
  };

  // Handle appearance setting change - Removed theme handling
  const handleAppearanceChange = (
    key: keyof typeof appearanceSettings,
    value: any
  ) => {
    setAppearanceSettings((prev) => ({
      ...prev,
      [key]: value,
    }));

    // Apply changes immediately for better user experience
    switch (key) {
      case "animationsEnabled":
        if (value) {
          document.documentElement.classList.remove("reduce-motion");
          document.documentElement.style.setProperty(
            "--animate-duration",
            "0.3s"
          );
          toast({
            title: "Animations Enabled",
            description: "UI animations and transitions are now active",
          });
        } else {
          document.documentElement.classList.add("reduce-motion");
          document.documentElement.style.setProperty(
            "--animate-duration",
            "0s"
          );
          toast({
            title: "Animations Disabled",
            description: "UI animations and transitions are now disabled",
          });
        }
        break;

      case "glassEffectsEnabled":
        if (value) {
          document.documentElement.classList.remove("no-glass");
          document.documentElement.style.setProperty("--blur-amount", "8px");
          toast({
            title: "Glass Effects Enabled",
            description: "Frosted glass and blur effects are now active",
          });
        } else {
          document.documentElement.classList.add("no-glass");
          document.documentElement.style.setProperty("--blur-amount", "0px");
          toast({
            title: "Glass Effects Disabled",
            description: "Frosted glass and blur effects are now disabled",
          });
        }
        break;

      case "highContrastMode":
        if (value) {
          document.documentElement.classList.add("high-contrast");
          toast({
            title: "High Contrast Mode Enabled",
            description: "Improved visibility with stronger contrasts",
          });
        } else {
          document.documentElement.classList.remove("high-contrast");
          toast({
            title: "High Contrast Mode Disabled",
            description: "Standard contrast mode restored",
          });
        }
        break;
    }

    // Play notification sound if enabled
    if (notificationSettings.soundEnabled) {
      notificationSound
        .play()
        .catch((e) => console.error("Error playing sound:", e));
    }
  };

  // Handle notification setting change
  const handleNotificationChange = (
    key: keyof typeof notificationSettings,
    value: boolean
  ) => {
    setNotificationSettings((prev) => ({
      ...prev,
      [key]: value,
    }));

    // Apply changes immediately for better user experience
    switch (key) {
      case "emailNotifications":
        toast({
          title: value
            ? "Email Notifications Enabled"
            : "Email Notifications Disabled",
          description: value
            ? "You will now receive important updates via email"
            : "You will no longer receive email notifications",
        });
        break;

      case "pushNotifications":
        if (value && "Notification" in window) {
          if (
            Notification.permission !== "granted" &&
            Notification.permission !== "denied"
          ) {
            Notification.requestPermission().then((permission) => {
              if (permission === "granted") {
                toast({
                  title: "Push Notifications Enabled",
                  description: "You will now receive browser notifications",
                });
              } else {
                toast({
                  title: "Permission Denied",
                  description: "Browser notification permission was denied",
                  variant: "destructive",
                });
                // Update state to reflect actual permission
                setNotificationSettings((prev) => ({
                  ...prev,
                  pushNotifications: false,
                }));
              }
            });
          } else if (Notification.permission === "granted") {
            toast({
              title: "Push Notifications Enabled",
              description: "You will now receive browser notifications",
            });
          } else {
            toast({
              title: "Permission Required",
              description:
                "Please enable notifications in your browser settings",
              variant: "destructive",
            });
            // Update state to reflect actual permission
            setNotificationSettings((prev) => ({
              ...prev,
              pushNotifications: false,
            }));
          }
        } else if (!value) {
          toast({
            title: "Push Notifications Disabled",
            description: "You will no longer receive browser notifications",
          });
        } else {
          toast({
            title: "Notifications Not Supported",
            description: "Your browser doesn't support notifications",
            variant: "destructive",
          });
          // Update state to reflect actual support
          setNotificationSettings((prev) => ({
            ...prev,
            pushNotifications: false,
          }));
        }
        break;

      case "soundEnabled":
        toast({
          title: value
            ? "Notification Sounds Enabled"
            : "Notification Sounds Disabled",
          description: value
            ? "Sound effects will play for notifications"
            : "Notifications will be silent",
        });

        // Play a test sound if enabled
        if (value) {
          notificationSound
            .play()
            .catch((e) => console.error("Error playing sound:", e));
        }
        break;

      case "discordNotifications":
        if (!discordConnection.connected && value) {
          toast({
            title: "Discord Not Connected",
            description: "Please connect your Discord account first",
            variant: "destructive",
          });
          // Reset the toggle since Discord isn't connected
          setNotificationSettings((prev) => ({
            ...prev,
            discordNotifications: false,
          }));
        } else {
          toast({
            title: value
              ? "Discord Notifications Enabled"
              : "Discord Notifications Disabled",
            description: value
              ? "You will now receive notifications in Discord"
              : "You will no longer receive Discord notifications",
          });
        }
        break;

      case "notionUpdates":
        toast({
          title: value ? "Notion Updates Enabled" : "Notion Updates Disabled",
          description: value
            ? "You will now receive notifications about Notion workspace changes"
            : "You will no longer receive Notion update notifications",
        });
        break;

      case "calendarReminders":
        if (!googleConnection.connected && value) {
          toast({
            title: "Google Calendar Not Connected",
            description: "Please connect your Google Calendar account first",
            variant: "destructive",
          });
          // Reset the toggle since Google Calendar isn't connected
          setNotificationSettings((prev) => ({
            ...prev,
            calendarReminders: false,
          }));
        } else {
          toast({
            title: value
              ? "Calendar Reminders Enabled"
              : "Calendar Reminders Disabled",
            description: value
              ? "You will now receive reminders for calendar events"
              : "You will no longer receive calendar reminders",
          });
        }
        break;
    }

    // Play notification sound if enabled (except when toggling sound itself off)
    if (notificationSettings.soundEnabled && key !== "soundEnabled") {
      notificationSound
        .play()
        .catch((e) => console.error("Error playing sound:", e));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 relative overflow-hidden">
      {/* Fluid splash-cursor background */}
      <div className="fixed inset-0 z-0 opacity-40">
        <SplashCursor
          TRANSPARENT={true}
          BACK_COLOR={{ r: 0.01, g: 0.01, b: 0.03 }}
          SPLAT_RADIUS={0.15}
          SPLAT_FORCE={3500}
          CURL={12}
          DENSITY_DISSIPATION={0.9}
          VELOCITY_DISSIPATION={0.6}
          COLOR_UPDATE_SPEED={8}
          SHADING={true}
        />
      </div>

      {/* Background gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-pink-900/10 pointer-events-none z-1" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(139,92,246,0.08),transparent_70%)] pointer-events-none z-2" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(219,39,119,0.06),transparent_70%)] pointer-events-none z-2" />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 relative z-10 transition-all duration-300">
        <div className="max-w-6xl mx-auto">
          {/* Header Section */}
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <motion.h1
                  className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-600 bg-clip-text text-transparent"
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.8, delay: 0.1 }}
                >
                  Settings
                </motion.h1>
                <motion.p
                  className="text-muted-foreground/80 text-lg"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                >
                  Customize your MuseRoom experience
                </motion.p>
              </div>
            </div>
          </motion.div>

          {/* Settings Tabs */}
          <Card className="bg-gradient-to-br from-gray-900/90 via-gray-900/95 to-gray-900/90 border border-purple-500/20 backdrop-blur-xl mb-6 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl flex items-center">
                <SettingsIcon className="h-5 w-5 mr-2 text-purple-400" />
                Settings & Preferences
              </CardTitle>
              <CardDescription>
                Configure your account, connections, and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
              >
                <TabsList className="w-full grid grid-cols-2 md:grid-cols-4 bg-gray-800/60 border-b border-gray-600/30 rounded-none p-0">
                  <TabsTrigger
                    value="account"
                    className="flex items-center gap-2 data-[state=active]:bg-purple-600/20 data-[state=active]:text-purple-300 rounded-none py-3 border-r border-gray-600/30"
                  >
                    <User className="w-4 h-4" />
                    <span className="hidden sm:inline">Account</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="connections"
                    className="flex items-center gap-2 data-[state=active]:bg-pink-600/20 data-[state=active]:text-pink-300 rounded-none py-3 border-r border-gray-600/30"
                  >
                    <Zap className="w-4 h-4" />
                    <span className="hidden sm:inline">Connections</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="appearance"
                    className="flex items-center gap-2 data-[state=active]:bg-blue-600/20 data-[state=active]:text-blue-300 rounded-none py-3 border-r border-gray-600/30"
                  >
                    <Palette className="w-4 h-4" />
                    <span className="hidden sm:inline">Appearance</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="notifications"
                    className="flex items-center gap-2 data-[state=active]:bg-amber-600/20 data-[state=active]:text-amber-300 rounded-none py-3"
                  >
                    <Bell className="w-4 h-4" />
                    <span className="hidden sm:inline">Notifications</span>
                  </TabsTrigger>
                </TabsList>

                {/* Account Settings Tab */}
                <TabsContent
                  value="account"
                  className="p-6 space-y-6 relative z-20"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* User Profile Section */}
                    <Card className="bg-gray-900/60 border border-gray-800/60 backdrop-blur-sm overflow-hidden">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center">
                          <User className="h-4 w-4 mr-2 text-purple-400" />
                          User Profile
                        </CardTitle>
                        <CardDescription>
                          Update your personal information
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex flex-col space-y-1.5">
                          <Label htmlFor="username">Username</Label>
                          <Input
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="bg-gray-800/60 border-gray-700/60"
                          />
                        </div>
                        <div className="flex flex-col space-y-1.5">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="bg-gray-800/60 border-gray-700/60"
                          />
                        </div>
                      </CardContent>
                      <CardFooter className="flex justify-between border-t border-gray-800/60 pt-4">
                        <Button
                          variant="outline"
                          className="bg-gray-800/30 hover:bg-gray-700/50 border-gray-700/30"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSaveAccount}
                          disabled={isSavingAccount}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          {isSavingAccount ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="mr-2 h-4 w-4" />
                              Save Changes
                            </>
                          )}
                        </Button>
                      </CardFooter>
                    </Card>

                    {/* API Keys Section */}
                    <Card className="bg-gray-900/60 border border-gray-800/60 backdrop-blur-sm overflow-hidden">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center">
                          <Key className="h-4 w-4 mr-2 text-purple-400" />
                          API Keys
                        </CardTitle>
                        <CardDescription>
                          Manage your API keys for external services
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between mb-4">
                          <Label>Show API Keys</Label>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={toggleApiKeyVisibility}
                            className="bg-gray-800/30 hover:bg-gray-700/50 border-gray-700/30"
                          >
                            {showApiKeys ? (
                              <>
                                <EyeOff className="h-4 w-4 mr-2" />
                                Hide
                              </>
                            ) : (
                              <>
                                <Eye className="h-4 w-4 mr-2" />
                                Show
                              </>
                            )}
                          </Button>
                        </div>

                        <div className="flex flex-col space-y-1.5">
                          <Label htmlFor="gemini-key">Gemini API Key</Label>
                          <Input
                            id="gemini-key"
                            type={showApiKeys ? "text" : "password"}
                            value={apiKeys.gemini}
                            onChange={(e) =>
                              setApiKeys({ ...apiKeys, gemini: e.target.value })
                            }
                            className="bg-gray-800/60 border-gray-700/60"
                            placeholder="Enter your Gemini API key"
                          />
                        </div>

                        <div className="flex flex-col space-y-1.5">
                          <Label htmlFor="elevenlabs-key">
                            ElevenLabs API Key
                          </Label>
                          <Input
                            id="elevenlabs-key"
                            type={showApiKeys ? "text" : "password"}
                            value={apiKeys.elevenlabs}
                            onChange={(e) =>
                              setApiKeys({
                                ...apiKeys,
                                elevenlabs: e.target.value,
                              })
                            }
                            className="bg-gray-800/60 border-gray-700/60"
                            placeholder="Enter your ElevenLabs API key"
                          />
                        </div>

                        <div className="flex flex-col space-y-1.5">
                          <Label htmlFor="notion-key">Notion API Key</Label>
                          <Input
                            id="notion-key"
                            type={showApiKeys ? "text" : "password"}
                            value={apiKeys.notion}
                            onChange={(e) =>
                              setApiKeys({ ...apiKeys, notion: e.target.value })
                            }
                            className="bg-gray-800/60 border-gray-700/60"
                            placeholder="Enter your Notion API key"
                          />
                        </div>
                      </CardContent>
                      <CardFooter className="flex justify-between border-t border-gray-800/60 pt-4">
                        <Button
                          variant="outline"
                          className="bg-gray-800/30 hover:bg-gray-700/50 border-gray-700/30"
                        >
                          Reset
                        </Button>
                        <Button
                          onClick={handleSaveApiKeys}
                          disabled={isSavingApiKeys}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          {isSavingApiKeys ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="mr-2 h-4 w-4" />
                              Save Keys
                            </>
                          )}
                        </Button>
                      </CardFooter>
                    </Card>
                  </div>
                </TabsContent>

                {/* Connections Tab */}
                <TabsContent
                  value="connections"
                  className="p-6 space-y-6 relative z-20"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Discord Connection */}
                    <Card className="bg-gray-900/60 border border-gray-800/60 backdrop-blur-sm overflow-hidden relative">
                      {/* Animated gradient background for Discord */}
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/5 via-transparent to-purple-600/5 pointer-events-none" />

                      <CardHeader className="relative z-10">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center">
                            <MessageSquare className="h-4 w-4 mr-2 text-indigo-400" />
                            Discord
                          </CardTitle>
                          {discordConnection.connected && (
                            <Badge
                              variant="outline"
                              className="bg-green-900/30 text-green-400 border-green-500/30"
                            >
                              Connected
                            </Badge>
                          )}
                        </div>
                        <CardDescription>
                          Connect your Discord account for chat integration
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="space-y-4 relative z-10">
                        {discordConnection.connected &&
                        discordConnection.data ? (
                          <div className="flex items-center space-x-4 p-4 bg-gray-800/40 rounded-lg border border-gray-700/40">
                            <div className="relative">
                              <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center overflow-hidden">
                                {discordConnection.data.avatar ? (
                                  <img
                                    src={discordConnection.data.avatar}
                                    alt={discordConnection.data.username}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <User className="h-6 w-6 text-indigo-300" />
                                )}
                              </div>
                              <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-800" />
                            </div>
                            <div>
                              <p className="font-medium text-white">
                                {discordConnection.data.username}
                                <span className="text-gray-400">
                                  #{discordConnection.data.discriminator}
                                </span>
                              </p>
                              <p className="text-sm text-gray-400">
                                {discordConnection.data.email}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 bg-gray-800/40 rounded-lg border border-gray-700/40 text-center">
                            <p className="text-gray-300 mb-2">
                              Connect your Discord account to enable chat
                              integration and notifications
                            </p>
                            {discordConnection.error && (
                              <div className="mb-3 p-2 bg-red-900/30 border border-red-700/30 rounded text-red-300 text-sm flex items-center">
                                <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
                                {discordConnection.error}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>

                      <CardFooter className="flex justify-end border-t border-gray-800/60 pt-4 relative z-10">
                        {discordConnection.connected ? (
                          <Button
                            variant="destructive"
                            onClick={handleDiscordSignOut}
                            disabled={discordConnection.loading}
                            className="bg-red-600/80 hover:bg-red-700/80"
                          >
                            {discordConnection.loading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Disconnecting...
                              </>
                            ) : (
                              <>
                                <LogOut className="mr-2 h-4 w-4" />
                                Disconnect
                              </>
                            )}
                          </Button>
                        ) : (
                          <Button
                            onClick={handleDiscordSignIn}
                            disabled={discordConnection.loading}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                          >
                            {discordConnection.loading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Connecting...
                              </>
                            ) : (
                              <>
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Connect Discord
                              </>
                            )}
                          </Button>
                        )}
                      </CardFooter>
                    </Card>

                    {/* Google Calendar Connection */}
                    <Card className="bg-gray-900/60 border border-gray-800/60 backdrop-blur-sm overflow-hidden relative">
                      {/* Animated gradient background for Google */}
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-transparent to-red-600/5 pointer-events-none" />

                      <CardHeader className="relative z-10">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center">
                            <Calendar className="h-4 w-4 mr-2 text-blue-400" />
                            Google Calendar
                          </CardTitle>
                          {googleConnection.connected && (
                            <Badge
                              variant="outline"
                              className="bg-green-900/30 text-green-400 border-green-500/30"
                            >
                              Connected
                            </Badge>
                          )}
                        </div>
                        <CardDescription>
                          Connect your Google Calendar for event integration
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="space-y-4 relative z-10">
                        {googleConnection.connected && googleConnection.data ? (
                          <div className="flex items-center space-x-4 p-4 bg-gray-800/40 rounded-lg border border-gray-700/40">
                            <div className="relative">
                              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center overflow-hidden">
                                {googleConnection.data.picture ? (
                                  <img
                                    src={googleConnection.data.picture}
                                    alt={googleConnection.data.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <User className="h-6 w-6 text-blue-300" />
                                )}
                              </div>
                              <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-800" />
                            </div>
                            <div>
                              <p className="font-medium text-white">
                                {googleConnection.data.name}
                              </p>
                              <p className="text-sm text-gray-400">
                                {googleConnection.data.email}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                Token expires in{" "}
                                {Math.floor(
                                  (googleConnection.data.expiresAt -
                                    Date.now()) /
                                    60000
                                )}{" "}
                                minutes
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 bg-gray-800/40 rounded-lg border border-gray-700/40 text-center">
                            <p className="text-gray-300 mb-2">
                              Connect your Google Calendar to sync events and
                              receive reminders
                            </p>
                            {googleConnection.error && (
                              <div className="mb-3 p-2 bg-red-900/30 border border-red-700/30 rounded text-red-300 text-sm flex items-center">
                                <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
                                {googleConnection.error}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>

                      <CardFooter className="flex justify-end border-t border-gray-800/60 pt-4 relative z-10">
                        {googleConnection.connected ? (
                          <Button
                            variant="destructive"
                            onClick={handleGoogleSignOut}
                            disabled={googleConnection.loading}
                            className="bg-red-600/80 hover:bg-red-700/80"
                          >
                            {googleConnection.loading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Disconnecting...
                              </>
                            ) : (
                              <>
                                <LogOut className="mr-2 h-4 w-4" />
                                Disconnect
                              </>
                            )}
                          </Button>
                        ) : (
                          <Button
                            onClick={handleGoogleSignIn}
                            disabled={googleConnection.loading}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            {googleConnection.loading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Connecting...
                              </>
                            ) : (
                              <>
                                <Calendar className="mr-2 h-4 w-4" />
                                Connect Google
                              </>
                            )}
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  </div>

                  {/* Connection Status Overview */}
                  <Card className="bg-gray-900/60 border border-gray-800/60 backdrop-blur-sm overflow-hidden">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center">
                        <Zap className="h-4 w-4 mr-2 text-amber-400" />
                        Connection Status
                      </CardTitle>
                      <CardDescription>
                        Overview of your connected services
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Discord Status */}
                        <div
                          className={`p-4 rounded-lg border ${
                            discordConnection.connected
                              ? "bg-green-900/20 border-green-700/30"
                              : "bg-gray-800/40 border-gray-700/40"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-medium flex items-center">
                              <MessageSquare className="h-4 w-4 mr-2 text-indigo-400" />
                              Discord
                            </h3>
                            {discordConnection.connected ? (
                              <Badge
                                variant="outline"
                                className="bg-green-900/30 text-green-400 border-green-500/30"
                              >
                                <Check className="h-3 w-3 mr-1" /> Connected
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-gray-800/50 text-gray-400 border-gray-700/30"
                              >
                                <X className="h-3 w-3 mr-1" /> Disconnected
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-400">
                            {discordConnection.connected
                              ? `Connected as ${discordConnection.data?.username}`
                              : "Not connected"}
                          </p>
                        </div>

                        {/* Google Calendar Status */}
                        <div
                          className={`p-4 rounded-lg border ${
                            googleConnection.connected
                              ? "bg-green-900/20 border-green-700/30"
                              : "bg-gray-800/40 border-gray-700/40"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-medium flex items-center">
                              <Calendar className="h-4 w-4 mr-2 text-blue-400" />
                              Google Calendar
                            </h3>
                            {googleConnection.connected ? (
                              <Badge
                                variant="outline"
                                className="bg-green-900/30 text-green-400 border-green-500/30"
                              >
                                <Check className="h-3 w-3 mr-1" /> Connected
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-gray-800/50 text-gray-400 border-gray-700/30"
                              >
                                <X className="h-3 w-3 mr-1" /> Disconnected
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-400">
                            {googleConnection.connected
                              ? `Connected as ${googleConnection.data?.name}`
                              : "Not connected"}
                          </p>
                        </div>

                        {/* Notion Status (placeholder) */}
                        <div className="p-4 rounded-lg border bg-green-900/20 border-green-700/30">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-medium flex items-center">
                              <FileText className="h-4 w-4 mr-2 text-blue-400" />
                              Notion
                            </h3>
                            <Badge
                              variant="outline"
                              className="bg-green-900/30 text-green-400 border-green-500/30"
                            >
                              <Check className="h-3 w-3 mr-1" /> Connected
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-400">
                            Connected via API key
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Appearance Settings Tab */}
                <TabsContent
                  value="appearance"
                  className="p-6 space-y-6 relative z-20"
                >
                  <Card className="bg-gray-900/60 border border-gray-800/60 backdrop-blur-sm overflow-hidden">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center">
                        <Palette className="h-4 w-4 mr-2 text-blue-400" />
                        Appearance Settings
                      </CardTitle>
                      <CardDescription>
                        Customize how MuseRoom looks
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Theme Settings - Replaced with permanent dark mode notice */}
                        <div className="space-y-4">
                          <h3 className="text-sm font-medium text-gray-300 mb-3">
                            Theme
                          </h3>

                          {/* Permanent Dark Mode Notice */}
                          <div className="p-4 bg-gray-800/40 rounded-lg border border-purple-700/30">
                            <div className="flex items-center space-x-2 text-gray-300">
                              <Moon className="h-4 w-4 text-purple-400" />
                              <p className="text-sm font-medium">
                                Dark Mode Permanently Enabled
                              </p>
                            </div>
                            <p className="mt-2 text-xs text-gray-400">
                              MuseRoom Dashboard uses an exclusive dark theme
                              optimized for reduced eye strain and futuristic
                              aesthetics.
                            </p>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label
                                htmlFor="high-contrast"
                                className="flex items-center"
                              >
                                <Zap className="h-4 w-4 mr-2 text-yellow-400" />
                                High Contrast Mode
                              </Label>
                              <p className="text-xs text-gray-400">
                                Improves visibility with stronger contrasts
                              </p>
                            </div>
                            <Switch
                              id="high-contrast"
                              checked={appearanceSettings.highContrastMode}
                              onCheckedChange={(checked) =>
                                handleAppearanceChange(
                                  "highContrastMode",
                                  checked
                                )
                              }
                            />
                          </div>
                        </div>

                        {/* Animation Settings */}
                        <div className="space-y-4">
                          <h3 className="text-sm font-medium text-gray-300 mb-3">
                            Effects & Animations
                          </h3>

                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label
                                htmlFor="animations"
                                className="flex items-center"
                              >
                                <Zap className="h-4 w-4 mr-2 text-purple-400" />
                                Enable Animations
                              </Label>
                              <p className="text-xs text-gray-400">
                                Smooth transitions and motion effects
                              </p>
                            </div>
                            <Switch
                              id="animations"
                              checked={appearanceSettings.animationsEnabled}
                              onCheckedChange={(checked) =>
                                handleAppearanceChange(
                                  "animationsEnabled",
                                  checked
                                )
                              }
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label
                                htmlFor="glass-effects"
                                className="flex items-center"
                              >
                                <Palette className="h-4 w-4 mr-2 text-pink-400" />
                                Glass Effects
                              </Label>
                              <p className="text-xs text-gray-400">
                                Frosted glass and blur effects
                              </p>
                            </div>
                            <Switch
                              id="glass-effects"
                              checked={appearanceSettings.glassEffectsEnabled}
                              onCheckedChange={(checked) =>
                                handleAppearanceChange(
                                  "glassEffectsEnabled",
                                  checked
                                )
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <Separator className="my-4 bg-gray-700/30" />

                      {/* Layout Settings - Removed sidebar toggle as requested */}
                      <div className="space-y-4">
                        <h3 className="text-sm font-medium text-gray-300 mb-3">
                          Layout
                        </h3>

                        <div className="p-4 bg-gray-800/40 rounded-lg border border-gray-700/40">
                          <div className="flex items-center space-x-2 text-gray-300">
                            <Info className="h-4 w-4 text-blue-400" />
                            <p className="text-sm">
                              The sidebar is set to start collapsed and expand
                              on hover for a clean, minimal interface.
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between border-t border-gray-800/60 pt-4">
                      <Button
                        variant="outline"
                        className="bg-gray-800/30 hover:bg-gray-700/50 border-gray-700/30"
                        onClick={() =>
                          setAppearanceSettings({
                            animationsEnabled: true,
                            glassEffectsEnabled: true,
                            sidebarCollapsed: true,
                            highContrastMode: false,
                          })
                        }
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Reset to Defaults
                      </Button>
                      <Button
                        onClick={handleSaveAppearance}
                        disabled={isSavingAppearance}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {isSavingAppearance ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Save Appearance
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                </TabsContent>

                {/* Notifications Tab */}
                <TabsContent
                  value="notifications"
                  className="p-6 space-y-6 relative z-20"
                >
                  <Card className="bg-gray-900/60 border border-gray-800/60 backdrop-blur-sm overflow-hidden">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center">
                        <Bell className="h-4 w-4 mr-2 text-amber-400" />
                        Notification Settings
                      </CardTitle>
                      <CardDescription>
                        Configure how you receive notifications
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Email Notifications */}
                        <div className="space-y-4">
                          <h3 className="text-sm font-medium text-gray-300 mb-3">
                            Email Notifications
                          </h3>

                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label
                                htmlFor="email-notifications"
                                className="flex items-center"
                              >
                                <Mail className="h-4 w-4 mr-2 text-blue-400" />
                                Email Notifications
                              </Label>
                              <p className="text-xs text-gray-400">
                                Receive important updates via email
                              </p>
                            </div>
                            <Switch
                              id="email-notifications"
                              checked={notificationSettings.emailNotifications}
                              onCheckedChange={(checked) =>
                                handleNotificationChange(
                                  "emailNotifications",
                                  checked
                                )
                              }
                            />
                          </div>
                        </div>

                        {/* Push Notifications */}
                        <div className="space-y-4">
                          <h3 className="text-sm font-medium text-gray-300 mb-3">
                            Browser Notifications
                          </h3>

                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label
                                htmlFor="push-notifications"
                                className="flex items-center"
                              >
                                <Bell className="h-4 w-4 mr-2 text-amber-400" />
                                Push Notifications
                              </Label>
                              <p className="text-xs text-gray-400">
                                Browser notifications for real-time updates
                              </p>
                            </div>
                            <Switch
                              id="push-notifications"
                              checked={notificationSettings.pushNotifications}
                              onCheckedChange={(checked) =>
                                handleNotificationChange(
                                  "pushNotifications",
                                  checked
                                )
                              }
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label
                                htmlFor="sound-enabled"
                                className="flex items-center"
                              >
                                <Volume2 className="h-4 w-4 mr-2 text-green-400" />
                                Notification Sounds
                              </Label>
                              <p className="text-xs text-gray-400">
                                Play sounds for notifications
                              </p>
                            </div>
                            <Switch
                              id="sound-enabled"
                              checked={notificationSettings.soundEnabled}
                              onCheckedChange={(checked) =>
                                handleNotificationChange(
                                  "soundEnabled",
                                  checked
                                )
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <Separator className="my-4 bg-gray-700/30" />

                      {/* Service-specific Notifications */}
                      <div className="space-y-4">
                        <h3 className="text-sm font-medium text-gray-300 mb-3">
                          Service Notifications
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="flex items-center justify-between p-3 bg-gray-800/40 rounded-lg border border-gray-700/40">
                            <div className="space-y-0.5">
                              <Label
                                htmlFor="discord-notifications"
                                className="flex items-center"
                              >
                                <MessageSquare className="h-4 w-4 mr-2 text-indigo-400" />
                                Discord Notifications
                              </Label>
                            </div>
                            <Switch
                              id="discord-notifications"
                              checked={
                                notificationSettings.discordNotifications
                              }
                              onCheckedChange={(checked) =>
                                handleNotificationChange(
                                  "discordNotifications",
                                  checked
                                )
                              }
                              disabled={!discordConnection.connected}
                            />
                          </div>

                          <div className="flex items-center justify-between p-3 bg-gray-800/40 rounded-lg border border-gray-700/40">
                            <div className="space-y-0.5">
                              <Label
                                htmlFor="calendar-reminders"
                                className="flex items-center"
                              >
                                <Calendar className="h-4 w-4 mr-2 text-blue-400" />
                                Calendar Reminders
                              </Label>
                            </div>
                            <Switch
                              id="calendar-reminders"
                              checked={notificationSettings.calendarReminders}
                              onCheckedChange={(checked) =>
                                handleNotificationChange(
                                  "calendarReminders",
                                  checked
                                )
                              }
                              disabled={!googleConnection.connected}
                            />
                          </div>

                          <div className="flex items-center justify-between p-3 bg-gray-800/40 rounded-lg border border-gray-700/40">
                            <div className="space-y-0.5">
                              <Label
                                htmlFor="notion-updates"
                                className="flex items-center"
                              >
                                <FileText className="h-4 w-4 mr-2 text-blue-400" />
                                Notion Updates
                              </Label>
                            </div>
                            <Switch
                              id="notion-updates"
                              checked={notificationSettings.notionUpdates}
                              onCheckedChange={(checked) =>
                                handleNotificationChange(
                                  "notionUpdates",
                                  checked
                                )
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between border-t border-gray-800/60 pt-4">
                      <Button
                        variant="outline"
                        className="bg-gray-800/30 hover:bg-gray-700/50 border-gray-700/30"
                        onClick={() =>
                          setNotificationSettings({
                            emailNotifications: true,
                            pushNotifications: true,
                            soundEnabled: true,
                            discordNotifications: false,
                            calendarReminders: true,
                            notionUpdates: true,
                          })
                        }
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Reset to Defaults
                      </Button>
                      <Button
                        onClick={handleSaveNotifications}
                        disabled={isSavingNotifications}
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                      >
                        {isSavingNotifications ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Save Notifications
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Help & Documentation */}
          <Card className="bg-gray-900/60 border border-gray-800/60 backdrop-blur-sm overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="p-2 rounded-full bg-blue-900/30 mr-3">
                    <Info className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white">
                      Need help with settings?
                    </h3>
                    <p className="text-xs text-gray-400">
                      Check our documentation for detailed guides
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="bg-gray-800/30 hover:bg-gray-700/50 border-gray-700/30"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Docs
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;
