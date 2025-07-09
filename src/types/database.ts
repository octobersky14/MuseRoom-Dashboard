export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          created_at: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          github_username: string | null;
          google_id: string | null;
          notion_access_token: string | null;
          github_access_token: string | null;
          preferences: Json | null;
          last_login: string | null;
        };
        Insert: {
          id: string;
          created_at?: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          github_username?: string | null;
          google_id?: string | null;
          notion_access_token?: string | null;
          github_access_token?: string | null;
          preferences?: Json | null;
          last_login?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          github_username?: string | null;
          google_id?: string | null;
          notion_access_token?: string | null;
          github_access_token?: string | null;
          preferences?: Json | null;
          last_login?: string | null;
        };
        Relationships: [];
      };
      agent_sessions: {
        Row: {
          id: string;
          user_id: string;
          created_at: string;
          updated_at: string;
          title: string;
          messages: Json;
          status: "active" | "completed" | "failed";
          metadata: Json | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          created_at?: string;
          updated_at?: string;
          title: string;
          messages?: Json;
          status?: "active" | "completed" | "failed";
          metadata?: Json | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          created_at?: string;
          updated_at?: string;
          title?: string;
          messages?: Json;
          status?: "active" | "completed" | "failed";
          metadata?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "agent_sessions_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      task_history: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          created_at: string;
          task_type:
            | "notion_read"
            | "notion_write"
            | "github_read"
            | "github_write"
            | "general";
          task_description: string;
          status: "pending" | "in_progress" | "completed" | "failed";
          result: Json | null;
          error_message: string | null;
          metadata: Json | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id: string;
          created_at?: string;
          task_type:
            | "notion_read"
            | "notion_write"
            | "github_read"
            | "github_write"
            | "general";
          task_description: string;
          status?: "pending" | "in_progress" | "completed" | "failed";
          result?: Json | null;
          error_message?: string | null;
          metadata?: Json | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_id?: string;
          created_at?: string;
          task_type?:
            | "notion_read"
            | "notion_write"
            | "github_read"
            | "github_write"
            | "general";
          task_description?: string;
          status?: "pending" | "in_progress" | "completed" | "failed";
          result?: Json | null;
          error_message?: string | null;
          metadata?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "task_history_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_history_session_id_fkey";
            columns: ["session_id"];
            referencedRelation: "agent_sessions";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
