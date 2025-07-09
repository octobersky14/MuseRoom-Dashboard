import { User } from "@supabase/supabase-js";
import { Database } from "./database";

export type DbUser = Database["public"]["Tables"]["users"]["Row"];
export type DbUserInsert = Database["public"]["Tables"]["users"]["Insert"];
export type DbUserUpdate = Database["public"]["Tables"]["users"]["Update"];

export type AgentSession =
  Database["public"]["Tables"]["agent_sessions"]["Row"];
export type AgentSessionInsert =
  Database["public"]["Tables"]["agent_sessions"]["Insert"];
export type AgentSessionUpdate =
  Database["public"]["Tables"]["agent_sessions"]["Update"];

export type TaskHistory = Database["public"]["Tables"]["task_history"]["Row"];
export type TaskHistoryInsert =
  Database["public"]["Tables"]["task_history"]["Insert"];
export type TaskHistoryUpdate =
  Database["public"]["Tables"]["task_history"]["Update"];

export type AuthUser = User & {
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
    github_username?: string;
    google_id?: string;
  } & Record<string, any>;
};

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  metadata?: {
    task_type?: string;
    task_status?: string;
    sources?: string[];
    error?: string;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  status: "active" | "completed" | "failed";
  created_at: string;
  updated_at: string;
}

export interface NotionTask {
  id: string;
  title: string;
  description?: string;
  status: "not_started" | "in_progress" | "completed";
  assignee?: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
  properties?: Record<string, any>;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description?: string;
  html_url: string;
  clone_url: string;
  default_branch: string;
  private: boolean;
  owner: {
    login: string;
    avatar_url: string;
  };
}

export interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  author: {
    login: string;
    avatar_url: string;
  };
  html_url: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: "open" | "closed";
  html_url: string;
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  labels: Array<{
    name: string;
    color: string;
  }>;
}

export interface AgentCapabilities {
  notion: {
    read: boolean;
    write: boolean;
    assign_tasks: boolean;
  };
  github: {
    read: boolean;
    write: boolean;
    create_issues: boolean;
    create_prs: boolean;
  };
  elevenlabs: {
    voice_synthesis: boolean;
    conversation: boolean;
  };
}

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  notifications: {
    email: boolean;
    browser: boolean;
    task_updates: boolean;
    agent_completions: boolean;
  };
  agent: {
    voice_enabled: boolean;
    auto_execute_tasks: boolean;
    preferred_voice_id?: string;
  };
  integrations: {
    notion_workspace_id?: string;
    github_default_repo?: string;
    preferred_notification_channels: string[];
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface LoadingState {
  isLoading: boolean;
  error: string | null;
  data: any;
}
