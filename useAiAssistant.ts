import { useState, useEffect, useCallback, useRef } from "react";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { nanoid } from "@reduxjs/toolkit";
import { useAppDispatch, useAppSelector } from "../hooks";
import { useUserPreferences } from "./useUserPreferences";
import {
  setPlaying,
  updateTrack,
  toggleMetronome,
  toggleCountInForRecording,
  setTempo,
  addTrack,
  toggleProjectCycleMode,
  setCycleRange,
  toggleTrackMute,
  toggleTrackSolo,
  soloTrack,
  unsoloAllTracks,
  setPianoRollPixelsPerBeat,
  setPlayheadPosition,
  setProjectName,
  setTimeSignature,
  toggleTrackRecordArm,
  toggleTrackInputMonitoring,
  setKeySignature,
  addMidiRegion as addMidiRegionAction,
  addNoteToRegion,
  undoHistoryAction,
  redoHistoryAction,
  selectTrack,
  removeTrack,
  selectTracksAndRegions,
  startRecording,
  stopRecording,
  reorderTracks,
} from "../store";
import {
  MIN_PIXELS_PER_BEAT,
  MAX_PIXELS_PER_BEAT,
  TOTAL_PROJECT_MEASURES,
  TRACK_COLORS,
  TRACK_COLOR_HEX_MAP,
  KEY_SIGNATURES,
} from "../constants";
import {
  Track,
  TrackType,
  TimeSignature,
  SoftwareInstrumentTrack,
  AudioTrack,
  MidiRegion,
  MidiNote,
} from "../types";
import { store } from "../store";
import { supabase } from "../supabaseClient";

// Define types for messages in the chat
export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

// Define command types that the AI can recognize
export type CommandType =
  | "play"
  | "pause"
  | "unknown"
  | "parameter_change"
  | "metronome_toggle"
  | "tempo_change"
  | "key_signature_change"
  | "time_signature_change"
  | "add_track"
  | "loop_toggle"
  | "loop_range"
  | "start_looping" // Added for "start looping" commands that enable loop + play
  | "mute_track"
  | "solo_track"
  | "zoom"
  | "playhead_position"
  | "rename_project"
  | "rename_track"
  | "change_track_color"
  | "help" // Added help type
  | "multiple_commands" // Added multiple commands type
  | "duplicate_track" // Added for duplicating tracks
  | "duplicate_audio_file" // Added for duplicating individual audio files/regions
  | "record_arm" // Toggle record arm for tracks
  | "input_monitoring" // Toggle input monitoring for audio tracks
  | "start_recording" // Start recording
  | "stop_recording" // Stop recording
  | "undo" // Undo last action
  | "redo" // Redo last undone action
  | "delete_track" // Delete selected track
  | "delete_all_tracks" // Delete all tracks
  | "delete_range_tracks" // Delete a range of tracks
  | "select_track" // Select a specific track
  | "clear_selection" // Clear current selection
  | "select_all_tracks" // Select all tracks
  | "move_track_to_top" // Move track to top position
  | "move_track_to_bottom" // Move track to bottom position
  | "move_track_to_position" // Move track to specific position
  | "go_to_time" // Navigate to specific time position
  | "go_to_bar" // Navigate to specific bar/measure
  | "skip_forward" // Skip forward by amount
  | "skip_backward" // Skip backward by amount
  | "jump_to_start" // Jump to project start
  | "jump_to_end" // Jump to project end
  | "sort_projects" // Sort projects on projects page
  | "filter_projects" // Filter projects by status
  | "search_projects" // Search projects by name
  | "open_project" // Open/load a specific project by name
  | "navigate_to_projects" // Navigate to the projects page
  | "sortTracks" // Sort tracks by criteria (AI-driven)
  | "add_note" // Add a single note to a track
  | "show_user_data"; // Show user's AI learning data

// Define parameter change types
export type ParameterType = "volume" | "pan";
export type ParameterAction = "increase" | "decrease" | "set" | "unknown";

// Interface for parameter change commands
export interface ParameterChangeCommand {
  type: ParameterType;
  trackId: string;
  trackName: string;
  currentValue: number;
  action: ParameterAction;
  targetValue: number;
  requestedPanDirection?: "left" | "right" | "center";
  isExtremePanRequest?: boolean;
  redirectIntent?: "mute" | "unmute";
}

// Interface for tempo change commands
export interface TempoChangeCommand {
  currentTempo: number;
  targetTempo: number;
  action: "increase" | "decrease" | "set";
  isDefaultAmountApplied?: boolean;
}

// Interface for add track commands
export interface AddTrackCommand {
  trackType: TrackType;
  trackName?: string;
}

// Interface for metronome toggle commands
export interface MetronomeToggleDetails {
  intent: "on" | "off" | "toggle";
}

// Interface for Play/Pause commands
export interface PlayPauseCommand {}

// Interface for Loop Toggle commands
export interface LoopToggleCommand {
  intent: "on" | "off" | "toggle";
}

// Interface for Loop Range commands
export interface LoopRangeCommand {
  startMeasure?: number;
  endMeasure?: number;
  startTimeSeconds?: number;
  endTimeSeconds?: number;
  isTimeBased?: boolean;
}

// Interface for Mute Track commands
export interface MuteActionDetails {
  trackId: string;
  trackName: string;
  intent: "mute" | "unmute" | "toggle";
}

// Interface for Solo Track commands
export interface SoloActionDetails {
  trackId: string;
  trackName: string;
  intent: "solo" | "unsolo" | "toggle";
}

// Interface for Zoom commands
export interface ZoomCommand {
  action: "in" | "out" | "fit_measures" | "fit_project" | "set_level";
  intensity?: "slight" | "moderate" | "maximum";
  startMeasure?: number;
  endMeasure?: number;
  targetPixelsPerBeat?: number;
}

// Interface for Playhead Position commands
export interface PlayheadPositionCommand {
  positionType: "beginning" | "measure" | "absolute_beat" | "relative_measure";
  targetMeasure?: number;
  targetAbsoluteBeat?: number;
  relativeAmount?: number;
  isForward?: boolean;
  shouldPlay: boolean;
  originalInput?: string;
}

// Interface for Rename Project commands
export interface RenameProjectCommand {
  newName: string;
}

// Interface for Rename Track commands
export interface RenameTrackCommand {
  trackId: string;
  currentTrackName: string;
  newTrackName: string;
}

// Interface for Change Track Color commands
export interface ChangeTrackColorCommand {
  trackId: string;
  currentTrackName: string;
  newColor: string; // This will be a Tailwind class like 'bg-teal-500'
}

// Interface for Key Signature Change commands
export interface KeySignatureChangeCommand {
  newKey: string;
  currentKey: string;
}

// Interface for Time Signature Change commands
export interface TimeSignatureChangeCommand {
  newNumerator: number;
  newDenominator: number;
  currentNumerator: number;
  currentDenominator: number;
}

// Interface for Duplicate Track commands
export interface DuplicateTrackCommand {
  trackId: string;
  trackName: string;
  preserveSettings: boolean; // Whether to preserve all settings like volume, pan, effects, etc.
}

// Interface for Duplicate Audio File commands
export interface DuplicateAudioFileCommand {
  regionId: string;
  regionName: string;
  trackId: string;
  trackName: string;
}

// Interface for Record Arm commands
export interface RecordArmCommand {
  trackId: string;
  trackName: string;
  intent: "arm" | "disarm" | "toggle";
}

// Interface for Input Monitoring commands
export interface InputMonitoringCommand {
  trackId: string;
  trackName: string;
  intent: "enable" | "disable" | "toggle";
}

// Interface for Add Note commands
export interface AddNoteCommand {
  trackId: string;
  trackName: string;
  pitch: number; // MIDI note number (0-127)
  velocity: number; // Note velocity (0-127)
  startTime: number; // Time in beats (e.g., 4.0 for measure 2 in 4/4 time)
  duration: number; // Duration in beats
  measure?: number; // Optional measure number for user reference
}

export interface ShowUserDataCommand {
  // No parameters needed - just show the user data modal
}

// Interface for Recording commands
export interface RecordingCommand {
  action: "start" | "stop";
  trackId?: string; // Optional - if not specified, uses currently armed track
  trackName?: string;
}

// Interface for Undo/Redo commands
export interface UndoRedoCommand {
  action: "undo" | "redo";
}

// Interface for Track Management commands
export interface TrackManagementCommand {
  action:
    | "delete"
    | "select"
    | "clear_selection"
    | "select_all"
    | "delete_all"
    | "delete_range"
    | "move_to_top"
    | "move_to_bottom"
    | "move_to_position";
  trackId?: string;
  trackName?: string;
  startIndex?: number;
  endIndex?: number;
  targetPosition?: number;
}

// Interface for Advanced Navigation commands
export interface AdvancedNavigationCommand {
  action:
    | "go_to_time"
    | "go_to_bar"
    | "skip_forward"
    | "skip_backward"
    | "jump_to_start"
    | "jump_to_end";
  targetTime?: number; // In seconds
  targetBar?: number; // Bar/measure number
  skipAmount?: number; // Amount to skip (in seconds or bars)
  skipUnit?: "seconds" | "bars" | "beats";
}

// Interface for Project Management commands (Projects page)
export interface ProjectManagementCommand {
  action: "sort" | "filter" | "search";
  sortBy?: "name" | "date";
  sortDirection?: "asc" | "desc";
  filterStatus?: "all" | "in-progress" | "backburner" | "published";
  searchTerm?: string;
}

// Interface for opening a specific project
export interface OpenProjectCommand {
  projectName: string;
}

// Interface for navigating to projects page
export interface NavigateToProjectsCommand {
  // No parameters needed - just navigate to projects page
}

interface CommandRecognitionResult {
  type: CommandType;
  confidence: number;
  executed: boolean;
  details?: {
    parameter?: ParameterType;
    trackName?: string;
    oldValue?: number;
    newValue?: number;
    message?: string;
    tempo?: number;
    metronomeEnabled?: boolean;
    newTrackType?: TrackType;
    newTrackName?: string;
    requestedPanDirection?: "left" | "right" | "center";
    isExtremePanRequest?: boolean;
    loopEnabled?: boolean;
    loopStartMeasure?: number;
    loopEndMeasure?: number;
    muteState?: boolean;
    soloState?: boolean;
    zoomAction?: ZoomCommand["action"];
    zoomIntensity?: ZoomCommand["intensity"];
    newPixelsPerBeat?: number;
    playheadTargetMeasure?: number;
    playheadTargetAbsoluteBeat?: number;
    playheadFinalPositionBeats?: number;
    playheadDidPlay?: boolean;
    playheadOriginalInput?: string;
    targetEntity?: "project" | "track";
    oldName?: string;
    newName?: string;
    newColor?: string;
  };
}

// Union type for all possible recognized command details
type RecognizedCommandDetails =
  | ParameterChangeCommand
  | TempoChangeCommand
  | AddTrackCommand
  | MetronomeToggleDetails
  | PlayPauseCommand
  | LoopToggleCommand
  | LoopRangeCommand
  | MuteActionDetails
  | SoloActionDetails
  | ZoomCommand
  | PlayheadPositionCommand
  | RenameProjectCommand
  | RenameTrackCommand
  | ChangeTrackColorCommand
  | { message?: string } // For help command
  | KeySignatureChangeCommand
  | TimeSignatureChangeCommand
  | DuplicateTrackCommand
  | DuplicateAudioFileCommand
  | RecordArmCommand
  | InputMonitoringCommand
  | RecordingCommand
  | UndoRedoCommand
  | TrackManagementCommand
  | AdvancedNavigationCommand
  | ProjectManagementCommand
  | OpenProjectCommand
  | NavigateToProjectsCommand
  | AddNoteCommand
  | ShowUserDataCommand
  | null;

// Structure for recognition attempts
interface RecognitionAttempt<T> {
  type: CommandType;
  details: T | null;
  confidence: number;
}

const DEFAULT_RELATIVE_VOLUME_CHANGE_AMOUNT = 15;
const DEFAULT_TEMPO_CHANGE_AMOUNT = 10;
const MINIMUM_COMMAND_CONFIDENCE_THRESHOLD = 0.65;
const ESTIMATED_VIEWPORT_WIDTH_FOR_ZOOM_CALC = 1400;
const ZOOM_FIT_PADDING_FACTOR = 1.15;
const SCROLL_TRIGGER_NUDGE_BEATS = 2.0;

// Debug flag for command execution verification
const ENABLE_COMMAND_DEBUG = true;

// Debug logging utility
const debugLog = (message: string, ...args: any[]) => {
  if (ENABLE_COMMAND_DEBUG) {
    console.log(message, ...args);
  }
};

// Utility: wait until the provided check returns true or timeout
const waitForStateChange = async (
  check: () => boolean,
  timeoutMs = 100 // Reduced from 500ms to 100ms for faster execution
): Promise<boolean> => {
  if (check()) return true;
  return new Promise((resolve) => {
    const start = Date.now();
    const id = setInterval(() => {
      if (check()) {
        clearInterval(id);
        resolve(true);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(id);
        resolve(false);
      }
    }, 5); // Reduced from 25ms to 5ms for faster polling
  });
};

const wordToNumber = (word: string): number | null => {
  const lowerWord = word.toLowerCase();
  const mapping: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    a: 1,
    an: 1,
  };
  return mapping[lowerWord] !== undefined ? mapping[lowerWord] : null;
};

const parseNumericInput = (input: string): number | null => {
  const lowerInput = input.toLowerCase().trim();
  if (/^\d+(\.\d+)?$/.test(lowerInput)) {
    return parseFloat(lowerInput);
  }
  const wordNum = wordToNumber(lowerInput);
  if (wordNum !== null) {
    return wordNum;
  }
  const pointMatch = lowerInput.match(/(\w+)\s+point\s+(\w+)/);
  if (pointMatch) {
    const wholePartWord = wordToNumber(pointMatch[1]);
    const decimalPartWord = wordToNumber(pointMatch[2]);
    const wholePartNum = parseInt(pointMatch[1], 10);
    const decimalPartNum = parseInt(pointMatch[2], 10);
    const whole =
      wholePartWord !== null
        ? wholePartWord
        : !isNaN(wholePartNum)
        ? wholePartNum
        : null;
    let decimal =
      decimalPartWord !== null
        ? decimalPartWord
        : !isNaN(decimalPartNum)
        ? decimalPartNum
        : null;

    if (whole !== null && decimal !== null) {
      let decimalValueStr = decimal.toString();
      if (
        decimalPartWord !== null &&
        pointMatch[2].length > 1 &&
        decimal.toString().length !== pointMatch[2].length
      ) {
        decimalValueStr = `0.${decimal}`;
      } else if (
        decimalPartWord !== null &&
        pointMatch[2].length === 1 &&
        decimal > 0 &&
        decimal < 10
      ) {
        decimalValueStr = `0.${decimal}`;
      } else if (decimalPartNum !== null && decimal >= 1) {
        decimalValueStr = `0.${decimal}`;
      } else {
        return null;
      }
      const parsedDecimal = parseFloat(decimalValueStr);
      if (!isNaN(parsedDecimal)) {
        return whole + parsedDecimal;
      }
    }
  }
  return null;
};

const parseTimeToSeconds = (timeString: string): number | null => {
  if (!timeString) return null;

  // Remove any spaces
  const cleanTime = timeString.replace(/\s+/g, "");

  // Handle formats like "1:30", "0:15", "2:45", "10:00"
  const timeMatch = cleanTime.match(/^(\d+):(\d{1,2})$/);
  if (timeMatch) {
    const minutes = parseInt(timeMatch[1]);
    const seconds = parseInt(timeMatch[2]);
    if (seconds < 60) {
      return minutes * 60 + seconds;
    }
  }

  // Handle formats like "30" (just seconds), "90" (90 seconds)
  const secondsMatch = cleanTime.match(/^(\d+)$/);
  if (secondsMatch) {
    return parseInt(secondsMatch[1]);
  }

  // Handle formats like "1m30s", "2min45sec", "30s"
  const complexTimeMatch = cleanTime.match(
    /^(?:(\d+)m(?:in)?)?(?:(\d+)s(?:ec)?)?$/i
  );
  if (complexTimeMatch) {
    const minutes = parseInt(complexTimeMatch[1] || "0");
    const seconds = parseInt(complexTimeMatch[2] || "0");
    return minutes * 60 + seconds;
  }

  return null;
};

const COLOR_NAME_TO_TAILWIND: Record<string, string> = {
  red: "bg-rose-500", // Assuming 'bg-rose-500' is your red
  rose: "bg-rose-500",
  pink: "bg-fuchsia-500", // Example, adjust if 'bg-rose-500' is pinker
  magenta: "bg-fuchsia-500",
  fuchsia: "bg-fuchsia-500",
  purple: "bg-indigo-500", // Or 'bg-fuchsia-500' depending on preference
  violet: "bg-indigo-500", // Add violet for rainbow colors
  indigo: "bg-indigo-500",
  blue: "bg-sky-500",
  sky: "bg-sky-500",
  teal: "bg-teal-500",
  cyan: "bg-sky-500", // Add cyan as alternative to blue
  green: "bg-emerald-500",
  emerald: "bg-emerald-500",
  lime: "bg-lime-500",
  yellow: "bg-amber-500",
  amber: "bg-amber-500",
  orange: "bg-amber-500",
  // Additional earthy colors that might be requested
  brown: "bg-amber-500", // Map brown to amber for earthy themes
  tan: "bg-amber-500", // Map tan to amber
  olive: "bg-emerald-500", // Map olive to emerald for earthy greens
  forest: "bg-emerald-500", // Map forest to emerald
  sage: "bg-emerald-500", // Map sage to emerald
  earth: "bg-amber-500", // Map earth to amber
  natural: "bg-emerald-500", // Map natural to green
  organic: "bg-emerald-500", // Map organic to green
  // Additional commonly requested colors
  turquoise: "bg-teal-500", // Map turquoise to teal
  aqua: "bg-sky-500", // Map aqua to sky blue
  mint: "bg-emerald-500", // Map mint to emerald
  coral: "bg-rose-500", // Map coral to rose
  salmon: "bg-rose-500", // Map salmon to rose
  gold: "bg-amber-500", // Map gold to amber
  silver: "bg-sky-500", // Map silver to sky (light/metallic feel)
  lavender: "bg-indigo-500", // Map lavender to purple
  navy: "bg-indigo-500", // Map navy to indigo (dark blue)
  crimson: "bg-rose-500", // Map crimson to rose
  scarlet: "bg-rose-500", // Map scarlet to rose
};

const normalizeColor = (colorInput: string): string | null => {
  const lowerColorInput = colorInput.toLowerCase().trim();
  debugLog(
    `[COLOR_NORMALIZE] Input: "${colorInput}" -> normalized: "${lowerColorInput}"`
  );

  // Check named colors first
  if (COLOR_NAME_TO_TAILWIND[lowerColorInput]) {
    const result = COLOR_NAME_TO_TAILWIND[lowerColorInput];
    debugLog(
      `[COLOR_NORMALIZE] Found in COLOR_NAME_TO_TAILWIND: "${lowerColorInput}" -> "${result}"`
    );
    return result;
  }

  // Handle common color mappings to available track colors
  const commonColorMappings: Record<string, string> = {
    red: "bg-rose-500",
    "bg-red-500": "bg-rose-500",
    "bg-red-400": "bg-rose-500",
    "bg-red-600": "bg-rose-500",
    yellow: "bg-amber-500",
    "bg-yellow-500": "bg-amber-500",
    "bg-yellow-400": "bg-amber-500",
    "bg-yellow-600": "bg-amber-500",
    green: "bg-emerald-500",
    "bg-green-500": "bg-emerald-500",
    "bg-green-400": "bg-emerald-500",
    "bg-green-600": "bg-emerald-500",
    blue: "bg-sky-500",
    "bg-blue-500": "bg-sky-500",
    "bg-blue-400": "bg-sky-500",
    "bg-blue-600": "bg-sky-500",
    purple: "bg-fuchsia-500",
    "bg-purple-500": "bg-fuchsia-500",
    "bg-purple-400": "bg-fuchsia-500",
    "bg-purple-600": "bg-fuchsia-500",
    pink: "bg-fuchsia-500",
    magenta: "bg-fuchsia-500",
    orange: "bg-amber-500",
    "bg-orange-500": "bg-amber-500",
  };

  if (commonColorMappings[lowerColorInput]) {
    const result = commonColorMappings[lowerColorInput];
    debugLog(
      `[COLOR_NORMALIZE] Found in common mappings: "${lowerColorInput}" -> "${result}"`
    );
    return result;
  }

  // Check if it's already a valid Tailwind class
  if (TRACK_COLORS.map((tc) => tc.toLowerCase()).includes(lowerColorInput)) {
    debugLog(
      `[COLOR_NORMALIZE] Found exact match in TRACK_COLORS: "${lowerColorInput}"`
    );
    return lowerColorInput;
  }

  // Check for partial matches (e.g., "teal" matches "bg-teal-500")
  for (const twClass of TRACK_COLORS) {
    const parts = twClass.split("-");
    if (parts.length === 3 && parts[1] === lowerColorInput) {
      debugLog(
        `[COLOR_NORMALIZE] Found partial match: "${lowerColorInput}" -> "${twClass}"`
      );
      return twClass;
    }
  }

  // Check hex colors
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(lowerColorInput)) {
    const normalizedHex = lowerColorInput.toLowerCase();
    debugLog(`[COLOR_NORMALIZE] Processing hex color: "${normalizedHex}"`);

    for (const tailwindClass in TRACK_COLOR_HEX_MAP) {
      if (TRACK_COLOR_HEX_MAP[tailwindClass].toLowerCase() === normalizedHex) {
        debugLog(
          `[COLOR_NORMALIZE] Hex match found: "${normalizedHex}" -> "${tailwindClass}"`
        );
        return tailwindClass;
      }
    }

    // If no exact hex match, return first color as fallback
    debugLog(
      `[COLOR_NORMALIZE] No hex match found for "${normalizedHex}", using fallback: "${TRACK_COLORS[0]}"`
    );
    return TRACK_COLORS[0];
  }

  debugLog(`[COLOR_NORMALIZE] No match found for "${colorInput}"`);
  return null;
};

// Add new interfaces for AI-driven command processing
export interface AICommandPlan {
  commands: AICommand[] | null;
  reasoning: string;
  expectedOutcome: string;
  id?: string; // Unique identifier for the command plan
  timestamp?: number; // When the plan was created
}

export interface AICommandPlanSnapshot {
  planId: string;
  originalPlan: AICommandPlan;
  initialState: any; // State before execution
  finalState: any; // State after execution
  reverseCommands: AICommand[]; // Commands to undo the plan
}

export interface AICommand {
  type: string;
  parameters: Record<string, any>;
  description: string;
  priority: number;
}

export interface AICommandResult {
  success: boolean;
  message: string;
  executedCommands: string[];
  failedCommands: string[];
}

// Add interface for failed command tracking
export interface FailedCommand {
  userInput: string;
  attemptedCommand: string;
  reason: string;
  timestamp: number;
  context: string;
}

// Add failed commands storage
class FailedCommandTracker {
  private static instance: FailedCommandTracker;
  private failedCommands: FailedCommand[] = [];
  private readonly maxEntries = 100;

  static getInstance(): FailedCommandTracker {
    if (!FailedCommandTracker.instance) {
      FailedCommandTracker.instance = new FailedCommandTracker();
    }
    return FailedCommandTracker.instance;
  }

  addFailedCommand(
    userInput: string,
    attemptedCommand: string,
    reason: string,
    context: string = ""
  ): void {
    const failedCommand: FailedCommand = {
      userInput,
      attemptedCommand,
      reason,
      timestamp: Date.now(),
      context,
    };

    this.failedCommands.unshift(failedCommand);

    // Keep only the most recent entries
    if (this.failedCommands.length > this.maxEntries) {
      this.failedCommands = this.failedCommands.slice(0, this.maxEntries);
    }

    // Write to file for persistence
    this.writeToFile();

    // Store in Supabase for AI learning
    this.storeInSupabase(failedCommand).catch((error) => {
      console.error("[FAILED_COMMANDS] Failed to store in Supabase:", error);
    });
  }

  private async writeToFile(): Promise<void> {
    try {
      const data = {
        lastUpdated: new Date().toISOString(),
        totalFailures: this.failedCommands.length,
        description:
          "This file tracks AI commands that failed to execute properly. It helps identify missing features and bugs that need to be addressed.",
        failedCommands: this.failedCommands.map((cmd) => ({
          userInput: cmd.userInput,
          attemptedCommand: cmd.attemptedCommand,
          reason: cmd.reason,
          timestamp: new Date(cmd.timestamp).toISOString(),
          context: cmd.context,
        })),
      };

      // Store in localStorage for immediate access
      localStorage.setItem(
        "museroom_failed_commands",
        JSON.stringify(data, null, 2)
      );

      // Also log to console for development
      console.log("[FAILED_COMMANDS] Updated failed commands log:", {
        totalFailures: data.totalFailures,
        latestFailure: data.failedCommands[0] || "None",
      });
    } catch (error) {
      console.error("[FAILED_COMMANDS] Error writing to file:", error);
    }
  }

  private async storeInSupabase(failedCommand: FailedCommand): Promise<void> {
    try {
      const { supabase, CONSTANT_USER_ID } = await import("../supabaseClient");

      // Determine error type based on the failure reason
      let errorType = "system_error";
      if (
        failedCommand.reason.includes("not implemented") ||
        failedCommand.reason.includes("coming soon")
      ) {
        errorType = "unimplemented_feature";
      } else if (
        failedCommand.reason.includes("execution") ||
        failedCommand.reason.includes("failed")
      ) {
        errorType = "execution_error";
      } else if (
        failedCommand.reason.includes("parse") ||
        failedCommand.reason.includes("invalid")
      ) {
        errorType = "parsing_error";
      } else if (failedCommand.reason.includes("input")) {
        errorType = "invalid_input";
      }

      // Get browser information for debugging
      const browserInfo = `${navigator.userAgent} | Screen: ${screen.width}x${screen.height} | Platform: ${navigator.platform}`;

      // Store in the dedicated failed_commands table for developers
      const { error } = await supabase.from("failed_commands").insert({
        user_id: CONSTANT_USER_ID,
        user_input: failedCommand.userInput,
        attempted_command: failedCommand.attemptedCommand,
        failure_reason: failedCommand.reason,
        error_type: errorType,
        context: failedCommand.context || "",
        browser_info: browserInfo,
        resolved: false,
      });

      if (error) {
        console.error("[FAILED_COMMANDS] Error storing in Supabase:", error);
      } else {
        console.log(`[FAILED_COMMANDS] Stored failed command for developers:`, {
          userInput: failedCommand.userInput.substring(0, 50) + "...",
          errorType: errorType,
          reason: failedCommand.reason.substring(0, 50) + "...",
        });
      }
    } catch (error) {
      console.error("[FAILED_COMMANDS] Error accessing Supabase:", error);
    }
  }

  getFailedCommands(): FailedCommand[] {
    return [...this.failedCommands];
  }

  getRecentFailures(hours: number = 24): FailedCommand[] {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return this.failedCommands.filter((cmd) => cmd.timestamp > cutoff);
  }

  clear(): void {
    this.failedCommands = [];
    this.writeToFile();
  }
}

class MusicAiService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;
  private isInitialized: boolean = false;
  private apiKey: string | null = null;
  private initializationError: string | null = null;
  private recognizedCommandDetails: RecognizedCommandDetails = null;
  private commandPlanHistory: AICommandPlanSnapshot[] = [];
  private maxPlanHistorySize: number = 50;
  private failedCommandTracker: FailedCommandTracker =
    FailedCommandTracker.getInstance();

  initialize(apiKey: string): boolean {
    if (!apiKey?.trim()) {
      this.initializationError = "No API key provided";
      return false;
    }
    try {
      this.apiKey = apiKey;
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.listAvailableModels().catch(console.error);
      this.model = this.genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: {
          temperature: 0.7, // Moderate randomness for creative responses
          topP: 0.9,
          topK: 35,
          maxOutputTokens: 800, // Sufficient for complex commands without being excessive
        },
      });
      this.isInitialized = true;
      this.initializationError = null;
      return true;
    } catch (error: any) {
      this.initializationError =
        error?.message || "Unknown error initializing AI service";
      return false;
    }
  }

  getStatus(): {
    initialized: boolean;
    error: string | null;
    apiKeySet: boolean;
  } {
    return {
      initialized: this.isInitialized,
      error: this.initializationError,
      apiKeySet: !!this.apiKey,
    };
  }

  /**
   * Debug function to view all music production knowledge in database
   */
  async debugViewAllKnowledge(): Promise<void> {
    console.log(
      "🔍 [DEBUG] Retrieving ALL music production knowledge entries..."
    );

    try {
      const { data, error } = await supabase
        .from("music_production_knowledge")
        .select(
          "id, title, content, tags, category, difficulty_level, quality_score"
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("🔍 [DEBUG] Error retrieving knowledge:", error);
        return;
      }

      if (!data || data.length === 0) {
        console.log("🔍 [DEBUG] No knowledge entries found in database!");
        return;
      }

      console.log(`🔍 [DEBUG] Found ${data.length} total knowledge entries:`);
      data.forEach((entry: any, index: number) => {
        console.log(`${index + 1}. "${entry.title}"`);
        console.log(
          `   Category: ${entry.category} | Difficulty: ${entry.difficulty_level} | Quality: ${entry.quality_score}`
        );
        console.log(
          `   Tags: ${
            Array.isArray(entry.tags) ? entry.tags.join(", ") : entry.tags
          }`
        );
        console.log(
          `   Content preview: ${entry.content.substring(0, 100)}...`
        );
        console.log("   ---");
      });
    } catch (error) {
      console.error("🔍 [DEBUG] Unexpected error:", error);
    }
  }

  /**
   * Get AI-informed parameter suggestions based on music production knowledge
   */
  async getInformedParameterSuggestions(
    operation: string,
    trackType: string,
    currentValues: Record<string, number>
  ): Promise<Record<string, number>> {
    console.log(
      `[PARAMETER_SUGGESTIONS] 🎛️ Getting informed suggestions for ${operation} on ${trackType} track`
    );

    const relevantKnowledge = await this.retrieveRelevantKnowledge(
      `${operation} ${trackType} track parameters settings`,
      2,
      "parameter_suggestions"
    );

    if (relevantKnowledge.length === 0) {
      console.log(
        `[PARAMETER_SUGGESTIONS] 📭 No specific knowledge found, using defaults`
      );
      return currentValues;
    }

    console.log(
      `[PARAMETER_SUGGESTIONS] 📖 Applying music production knowledge to parameter suggestions`
    );

    // Use AI to analyze knowledge and suggest optimal parameters
    if (!this.model) return currentValues;

    try {
      const prompt = `Based on this music production knowledge:
${relevantKnowledge.join("\n\n")}

Suggest optimal parameter values for ${operation} on a ${trackType} track.
Current values: ${JSON.stringify(currentValues)}

Return a JSON object with suggested parameter adjustments. Only suggest changes that would improve the sound based on the knowledge provided.

Example response: {"volume": 75, "pan": -15, "eq_high": 3}`;

      const result = await this.model.generateContent(prompt);
      const response = result.response.text().trim();

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const suggestions = JSON.parse(jsonMatch[0]);
        console.log(
          `[PARAMETER_SUGGESTIONS] ✅ Generated informed suggestions:`,
          suggestions
        );
        return { ...currentValues, ...suggestions };
      }
    } catch (error) {
      console.error(
        `[PARAMETER_SUGGESTIONS] ❌ Error generating suggestions:`,
        error
      );
    }

    return currentValues;
  }

  /**
   * Get workflow optimization suggestions based on music production knowledge
   */
  async getWorkflowOptimizations(
    currentState: any,
    userGoal: string
  ): Promise<string[]> {
    console.log(
      `[WORKFLOW_OPTIMIZATION] 🔄 Analyzing workflow for goal: "${userGoal}"`
    );

    const relevantKnowledge = await this.retrieveRelevantKnowledge(
      `${userGoal} workflow process steps`,
      3,
      "workflow_optimization"
    );

    if (relevantKnowledge.length === 0) {
      console.log(`[WORKFLOW_OPTIMIZATION] 📭 No workflow knowledge found`);
      return [];
    }

    console.log(
      `[WORKFLOW_OPTIMIZATION] 📖 Found ${relevantKnowledge.length} workflow knowledge snippets`
    );

    if (!this.model) return [];

    try {
      const prompt = `Based on this music production knowledge:
${relevantKnowledge.join("\n\n")}

Current DAW state: ${JSON.stringify(currentState, null, 2)}
User goal: "${userGoal}"

Suggest 3-5 specific workflow optimizations or next steps that would help achieve this goal based on the knowledge provided.

Return a JSON array of actionable suggestions.
Example: ["Set up parallel compression on drums", "Create a send for reverb", "Group similar tracks"]`;

      const result = await this.model.generateContent(prompt);
      const response = result.response.text().trim();

      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const suggestions = JSON.parse(jsonMatch[0]);
        console.log(
          `[WORKFLOW_OPTIMIZATION] ✅ Generated ${suggestions.length} workflow suggestions`
        );
        return suggestions;
      }
    } catch (error) {
      console.error(
        `[WORKFLOW_OPTIMIZATION] ❌ Error generating suggestions:`,
        error
      );
    }

    return [];
  }

  /**
   * Get knowledge-informed error resolution suggestions
   */
  async getErrorResolutionSuggestions(
    errorType: string,
    errorContext: string,
    currentState: any
  ): Promise<string[]> {
    console.log(`[ERROR_RESOLUTION] 🔧 Analyzing error: ${errorType}`);

    const relevantKnowledge = await this.retrieveRelevantKnowledge(
      `${errorType} ${errorContext} troubleshooting problem solving`,
      2,
      "error_resolution"
    );

    if (relevantKnowledge.length === 0) {
      console.log(
        `[ERROR_RESOLUTION] 📭 No specific knowledge found for this error`
      );
      return [
        `Try checking the ${errorContext} settings`,
        "Restart the operation",
        "Check for conflicts",
      ];
    }

    console.log(`[ERROR_RESOLUTION] 📖 Applying knowledge to error resolution`);

    if (!this.model) return [];

    try {
      const prompt = `Based on this music production knowledge:
${relevantKnowledge.join("\n\n")}

Error: ${errorType}
Context: ${errorContext}
Current state: ${JSON.stringify(currentState, null, 2)}

Provide 3-5 specific troubleshooting steps based on the knowledge provided.

Return a JSON array of actionable solutions.
Example: ["Check audio interface settings", "Verify sample rate compatibility", "Reset audio preferences"]`;

      const result = await this.model.generateContent(prompt);
      const response = result.response.text().trim();

      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const suggestions = JSON.parse(jsonMatch[0]);
        console.log(
          `[ERROR_RESOLUTION] ✅ Generated ${suggestions.length} resolution steps`
        );
        return suggestions;
      }
    } catch (error) {
      console.error(
        `[ERROR_RESOLUTION] ❌ Error generating resolution:`,
        error
      );
    }

    return [
      `Try checking the ${errorContext} settings`,
      "Restart the operation",
      "Check for conflicts",
    ];
  }

  /**
   * Universal knowledge-informed AI assistance for any DAW operation
   * This is the main integration point for all DAW features
   */
  async getKnowledgeInformedAssistance(
    operation: string,
    context: Record<string, any>,
    assistanceType:
      | "suggestions"
      | "validation"
      | "optimization"
      | "troubleshooting" = "suggestions"
  ): Promise<{
    hasKnowledge: boolean;
    suggestions: string[];
    parameters?: Record<string, any>;
    confidence: number;
  }> {
    console.log(
      `[KNOWLEDGE_ASSISTANCE] 🎯 Providing ${assistanceType} for: ${operation}`
    );

    const relevantKnowledge = await this.retrieveRelevantKnowledge(
      `${operation} ${Object.values(context).join(" ")}`,
      3,
      assistanceType === "suggestions"
        ? "parameter_suggestions"
        : assistanceType === "optimization"
        ? "workflow_optimization"
        : assistanceType === "troubleshooting"
        ? "error_resolution"
        : "general"
    );

    const hasKnowledge = relevantKnowledge.length > 0;
    console.log(
      `[KNOWLEDGE_ASSISTANCE] 📊 Knowledge available: ${
        hasKnowledge ? "YES" : "NO"
      } (${relevantKnowledge.length} entries)`
    );

    if (!hasKnowledge) {
      return {
        hasKnowledge: false,
        suggestions: [],
        confidence: 0,
      };
    }

    if (!this.model) {
      return {
        hasKnowledge: true,
        suggestions: ["Knowledge available but AI model not initialized"],
        confidence: 0.3,
      };
    }

    try {
      const prompt = `You are providing ${assistanceType} for a music production operation.

OPERATION: ${operation}
CONTEXT: ${JSON.stringify(context, null, 2)}

RELEVANT MUSIC PRODUCTION KNOWLEDGE:
${relevantKnowledge.join("\n\n")}

Based on this knowledge, provide:
1. 3-5 specific, actionable suggestions
2. Any parameter recommendations (if applicable)
3. A confidence score (0-1) based on knowledge relevance

Respond in JSON format:
{
  "suggestions": ["suggestion 1", "suggestion 2", ...],
  "parameters": {"param1": value1, "param2": value2},
  "confidence": 0.85,
  "reasoning": "Brief explanation of why these suggestions are recommended"
}`;

      const result = await this.model.generateContent(prompt);
      const response = result.response.text().trim();

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const assistance = JSON.parse(jsonMatch[0]);
        console.log(
          `[KNOWLEDGE_ASSISTANCE] ✅ Generated assistance with confidence: ${assistance.confidence}`
        );

        return {
          hasKnowledge: true,
          suggestions: assistance.suggestions || [],
          parameters: assistance.parameters || {},
          confidence: assistance.confidence || 0.7,
        };
      }
    } catch (error) {
      console.error(
        `[KNOWLEDGE_ASSISTANCE] ❌ Error generating assistance:`,
        error
      );
    }

    return {
      hasKnowledge: true,
      suggestions: [
        "Knowledge found but couldn't generate specific suggestions",
      ],
      confidence: 0.3,
    };
  }

  /**
   * Test function to verify AI-powered knowledge retrieval is working
   */
  async testKnowledgeRetrieval(): Promise<void> {
    console.log(
      "🧪 [KNOWLEDGE_TEST] Testing AI-powered music production knowledge retrieval..."
    );

    const testQueries = [
      "How do I make my vocals sound dreamy?",
      "My drums sound too quiet",
      "What makes a guitar sound warm?",
      "How do people use reverb to create a floaty vibe?",
      "I want my mix to sound more spacious",
      "The bass is muddy",
      "How to make drums punchy",
      "reverb effects",
    ];

    for (const query of testQueries) {
      console.log(`🧪 [KNOWLEDGE_TEST] Testing query: "${query}"`);
      console.log("--- Testing AI concept analysis ---");
      const concepts = await this.analyzeQueryForMusicConcepts(query);
      console.log(`🧪 AI extracted concepts: [${concepts.join(", ")}]`);

      console.log("--- Testing full knowledge retrieval ---");
      const results = await this.retrieveRelevantKnowledge(query, 3);
      console.log(
        `🧪 [KNOWLEDGE_TEST] Results for "${query}": ${results.length} entries found\n`
      );
    }

    console.log(
      "🧪 [KNOWLEDGE_TEST] AI-powered knowledge retrieval test complete!"
    );
  }

  /**
   * Use AI to find relevant knowledge entries based on semantic understanding
   */
  private async findRelevantEntriesWithAI(
    userQuery: string,
    allEntries: any[]
  ): Promise<any[]> {
    if (!this.model || allEntries.length === 0) return [];

    try {
      console.log(
        `[AI_RELEVANCE_ANALYSIS] 🧠 Analyzing ${allEntries.length} entries for relevance to: "${userQuery}"`
      );

      // Create a summary of all available entries for AI analysis
      const entriesSummary = allEntries
        .map(
          (entry, index) =>
            `Entry ${index + 1}: "${entry.title}" - ${entry.content.substring(
              0,
              150
            )}...`
        )
        .join("\n\n");

      const relevancePrompt = `You are analyzing music production knowledge entries to find which ones are most relevant to a user's query.

User Query: "${userQuery}"

Available Knowledge Entries:
${entriesSummary}

Analyze which entries would be most helpful for answering the user's question. Consider:
- Direct topic relevance (exact matches)
- Conceptual relevance (related concepts that could help)
- Practical applicability (techniques that achieve what the user wants)
- Educational value for the user's skill level

Return a JSON array of entry numbers (1-based) that are relevant, ordered by relevance (most relevant first). Include entries that might indirectly help even if not exact matches.

Example: [1, 3, 5] for entries 1, 3, and 5 being most relevant.

If no entries are relevant, return an empty array: []`;

      const result = await this.model.generateContent(relevancePrompt);
      const responseText = result.response.text().trim();

      console.log(
        `[AI_RELEVANCE_ANALYSIS] 🎯 AI relevance response: ${responseText}`
      );

      // Extract JSON array from response
      const jsonMatch = responseText.match(/\[(.*?)\]/);
      if (!jsonMatch) {
        console.log(
          `[AI_RELEVANCE_ANALYSIS] ⚠️ No valid JSON array found in AI response`
        );
        return [];
      }

      const relevantIndices = JSON.parse(`[${jsonMatch[1]}]`);
      const relevantEntries = relevantIndices
        .filter((index: number) => index >= 1 && index <= allEntries.length)
        .map((index: number) => allEntries[index - 1]); // Convert to 0-based

      console.log(
        `[AI_RELEVANCE_ANALYSIS] ✅ Found ${relevantEntries.length} relevant entries through AI analysis`
      );

      return relevantEntries;
    } catch (error) {
      console.error(
        `[AI_RELEVANCE_ANALYSIS] ❌ Error during AI relevance analysis:`,
        error
      );
      return [];
    }
  }

  /**
   * Use AI to intelligently analyze user query and generate relevant search terms
   */
  private async analyzeQueryForMusicConcepts(
    userMessage: string
  ): Promise<string[]> {
    if (!this.isInitialized || !this.model) {
      console.log(
        "[MUSIC_CONCEPT_ANALYSIS] AI not initialized, falling back to basic term extraction"
      );
      return this.extractBasicTerms(userMessage);
    }

    try {
      console.log(
        `[MUSIC_CONCEPT_ANALYSIS] 🧠 Analyzing query: "${userMessage}"`
      );

      const analysisPrompt = `You are a music production expert analyzing a user's question to identify what music production concepts they're asking about.

The user's question: "${userMessage}"

Your task is to identify what music production concepts, techniques, effects, or processes the user is asking about, regardless of their experience level or terminology used.

Consider these categories of music production knowledge:
- Audio effects (reverb, delay, compression, EQ, distortion, modulation, etc.)
- Mixing techniques (panning, balance, stereo imaging, etc.)
- Sound characteristics (warm, bright, punchy, spacious, clean, dirty, etc.)
- Recording processes (microphone techniques, monitoring, etc.)
- Arrangement and composition
- Technical aspects (frequency, dynamics, timing, etc.)
- Equipment and tools
- Creative techniques and workflows

Respond with a JSON array of 3-8 relevant search terms that would help find information about what the user is asking about. Include both technical terms and descriptive words.

Examples:
- "How do I make my vocals sound dreamy?" → ["reverb", "vocals", "atmospheric", "space", "dreamy", "effects"]
- "My drums sound too quiet" → ["drums", "volume", "mixing", "compression", "punch", "dynamics"]
- "What makes a guitar sound warm?" → ["guitar", "warm", "tone", "eq", "frequency", "character"]

Return only a JSON array of strings, no other text.`;

      const result = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: analysisPrompt }] }],
        generationConfig: {
          temperature: 0.3,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 150,
        },
      });

      const response = result.response.text().trim();
      console.log(`[MUSIC_CONCEPT_ANALYSIS] 🎯 AI response: ${response}`);

      // Parse the JSON response
      const jsonMatch = response.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const searchTerms = JSON.parse(jsonMatch[0]);
        console.log(
          `[MUSIC_CONCEPT_ANALYSIS] ✅ Extracted terms: [${searchTerms.join(
            ", "
          )}]`
        );
        return Array.isArray(searchTerms) ? searchTerms : [];
      }

      console.log(
        "[MUSIC_CONCEPT_ANALYSIS] ⚠️ Could not parse AI response, falling back to basic extraction"
      );
      return this.extractBasicTerms(userMessage);
    } catch (error) {
      console.error(
        "[MUSIC_CONCEPT_ANALYSIS] ❌ Error during AI analysis:",
        error
      );
      return this.extractBasicTerms(userMessage);
    }
  }

  /**
   * Fallback method for basic term extraction when AI analysis fails
   */
  private extractBasicTerms(userMessage: string): string[] {
    const message = userMessage.toLowerCase();
    const words = message.split(/\s+/).filter((word) => word.length > 2);

    // Basic music-related words that might be relevant
    const musicWords = words.filter((word) =>
      word.match(
        /^(sound|audio|music|track|mix|effect|tone|voice|vocal|drum|guitar|bass|piano|synth|beat|rhythm|reverb|delay|compression|eq|volume|pan|stereo|frequency|tempo|recording|studio|production|arrangement|composition|harmony|melody|chord|warm|bright|clean|dirty|punchy|soft|hard|deep|high|low|space|room|hall|plate|spring)/
      )
    );

    return musicWords.length > 0 ? musicWords : [userMessage];
  }

  /**
   * Get full PDF content on-demand for detailed AI analysis
   */
  private async getPDFContent(pdfId: string): Promise<string | null> {
    try {
      console.log(
        `[PDF_CONTENT_RETRIEVAL] 📄 Fetching full PDF content for ID: ${pdfId}`
      );

      // First check if we have cached extracted content
      const { data: pdfData, error: dbError } = await supabase
        .from("music_production_knowledge")
        .select("extracted_content, pdf_storage_path, title")
        .eq("id", pdfId)
        .single();

      if (dbError || !pdfData) {
        console.error(
          `[PDF_CONTENT_RETRIEVAL] ❌ Error fetching PDF metadata:`,
          dbError
        );
        return null;
      }

      // If we have cached content and it's substantial, use it
      if (
        pdfData.extracted_content &&
        pdfData.extracted_content.length > 1000
      ) {
        console.log(
          `[PDF_CONTENT_RETRIEVAL] ✅ Using cached extracted content for "${pdfData.title}"`
        );
        return pdfData.extracted_content;
      }

      console.log(
        `[PDF_CONTENT_RETRIEVAL] 📤 No cached content available for "${pdfData.title}". Full PDF extraction would require additional implementation.`
      );

      // For now, return what we have
      return pdfData.extracted_content || null;
    } catch (error) {
      console.error(
        `[PDF_CONTENT_RETRIEVAL] ❌ Error getting PDF content:`,
        error
      );
      return null;
    }
  }

  /**
   * Enhanced knowledge retrieval for all AI operations - not just chat responses
   * This powers AI decision-making across the entire DAW experience
   */
  private async retrieveRelevantKnowledge(
    userMessage: string,
    maxResults: number = 5,
    context:
      | "chat"
      | "command_planning"
      | "parameter_suggestions"
      | "workflow_optimization"
      | "error_resolution"
      | "general" = "general"
  ): Promise<string[]> {
    console.log(
      `[MUSIC_KNOWLEDGE_RETRIEVAL] 🎵 Searching music production database for: "${userMessage}"`
    );
    console.log(
      `[MUSIC_KNOWLEDGE_RETRIEVAL] 🎯 Context: ${context.toUpperCase()} | Max results: ${maxResults}`
    );

    try {
      // First, get a count of total entries to verify database connectivity
      const { count: totalEntries, error: countError } = await supabase
        .from("music_production_knowledge")
        .select("*", { count: "exact", head: true });

      if (countError) {
        console.error(
          `[MUSIC_KNOWLEDGE_RETRIEVAL] ❌ Error checking database connectivity:`,
          countError
        );
      } else {
        console.log(
          `[MUSIC_KNOWLEDGE_RETRIEVAL] 📊 Total music production knowledge entries in database: ${
            totalEntries || 0
          }`
        );
      }

      // Use AI to intelligently analyze the user's query for music concepts
      const musicTerms = await this.analyzeQueryForMusicConcepts(userMessage);
      console.log(
        `[MUSIC_KNOWLEDGE_RETRIEVAL] 🎯 AI-analyzed music concepts: [${musicTerms.join(
          ", "
        )}]`
      );

      // Try multiple search strategies in parallel for better results
      let data = null;
      let error = null;

      if (musicTerms.length > 0) {
        console.log(
          `[MUSIC_KNOWLEDGE_RETRIEVAL] 🔍 Trying AI-powered search with: [${musicTerms.join(
            ", "
          )}]`
        );

        // Strategy 1: Search using AI-analyzed terms (including PDF fields)
        const aiSearchTerms = musicTerms.join(" | ");
        const { data: aiData, error: aiError } = await supabase
          .from("music_production_knowledge")
          .select(
            "id, title, content, extracted_content, content_summary, pdf_filename, tags, category, difficulty_level, quality_score"
          )
          .textSearch("content", aiSearchTerms, { type: "plain" })
          .limit(maxResults);

        if (!aiError && aiData && aiData.length > 0) {
          console.log(
            `[MUSIC_KNOWLEDGE_RETRIEVAL] ✅ AI-powered search found ${aiData.length} results`
          );
          data = aiData;
        } else {
          // Strategy 2: Try individual term searches
          console.log(
            `[MUSIC_KNOWLEDGE_RETRIEVAL] 🔄 Trying individual term searches...`
          );
          for (const term of musicTerms.slice(0, 2)) {
            // Try first 2 most relevant terms
            const { data: termData, error: termError } = await supabase
              .from("music_production_knowledge")
              .select(
                "id, title, content, extracted_content, content_summary, pdf_filename, tags, category, difficulty_level, quality_score"
              )
              .or(
                `title.ilike.%${term}%,content.ilike.%${term}%,content_summary.ilike.%${term}%,extracted_content.ilike.%${term}%,tags.cs.{${term}}`
              )
              .limit(maxResults);

            if (!termError && termData && termData.length > 0) {
              console.log(
                `[MUSIC_KNOWLEDGE_RETRIEVAL] ✅ Found ${termData.length} results for term "${term}"`
              );
              data = termData;
              break;
            }
          }
        }
      }

      // Strategy 3: AI-powered semantic relevance analysis (if still no results)
      if (!data || data.length === 0) {
        console.log(
          `[MUSIC_KNOWLEDGE_RETRIEVAL] 🤖 Trying AI semantic relevance analysis...`
        );

        // Get all knowledge entries for AI analysis
        const { data: allData, error: allError } = await supabase
          .from("music_production_knowledge")
          .select(
            "id, title, content, extracted_content, content_summary, pdf_filename, tags, category, difficulty_level, quality_score"
          )
          .limit(20); // Reasonable limit for AI analysis

        if (!allError && allData && allData.length > 0) {
          const relevantEntries = await this.findRelevantEntriesWithAI(
            userMessage,
            allData
          );
          if (relevantEntries.length > 0) {
            console.log(
              `[MUSIC_KNOWLEDGE_RETRIEVAL] 🎯 AI semantic analysis found ${relevantEntries.length} relevant entries`
            );
            data = relevantEntries.slice(0, maxResults);
          }
        }
      }

      // Strategy 4: Final fallback - use original query
      if (!data || data.length === 0) {
        console.log(
          `[MUSIC_KNOWLEDGE_RETRIEVAL] 🔄 Final fallback: trying original query search...`
        );
        const { data: originalData, error: originalError } = await supabase
          .from("music_production_knowledge")
          .select(
            "id, title, content, extracted_content, content_summary, pdf_filename, tags, category, difficulty_level, quality_score"
          )
          .textSearch("content", userMessage, { type: "plain" })
          .limit(maxResults);

        if (!originalError && originalData && originalData.length > 0) {
          console.log(
            `[MUSIC_KNOWLEDGE_RETRIEVAL] ✅ Original query search found ${originalData.length} results`
          );
        }

        data = originalData;
        error = originalError;
      }

      if (error) {
        console.error(`[MUSIC_KNOWLEDGE_RETRIEVAL] ❌ Database error:`, error);
        return [];
      }

      if (!data || data.length === 0) {
        console.log(
          `[MUSIC_KNOWLEDGE_RETRIEVAL] ❌ No relevant music production knowledge found for query: "${userMessage}"`
        );
        console.log(
          `[MUSIC_KNOWLEDGE_RETRIEVAL] 📝 Tried strategies: 1) AI-powered term extraction, 2) Individual term search, 3) AI semantic relevance analysis, 4) Original query search`
        );
        return [];
      }

      console.log(
        `[MUSIC_KNOWLEDGE_RETRIEVAL] ✅ Found ${data.length} relevant knowledge entries:`
      );
      data.forEach((entry: any, index: number) => {
        console.log(
          `  ${index + 1}. "${entry.title}" (Category: ${
            entry.category
          }, Quality: ${entry.quality_score}, Difficulty: ${
            entry.difficulty_level
          })`
        );
      });

      // Format as context snippets (handle both PDF and text-based entries)
      const formattedSnippets = data.map((row: any) => {
        let tags = Array.isArray(row.tags) ? row.tags.join(", ") : row.tags;

        // For PDF entries, use content_summary + extracted_content, for text entries use content
        let contentToUse = "";
        if (
          row.pdf_filename &&
          (row.content_summary || row.extracted_content)
        ) {
          // This is a PDF entry
          const pdfLabel = `[PDF: ${row.pdf_filename}]`;
          const summary = row.content_summary || "";
          const extractedText = row.extracted_content || "";
          contentToUse = `${pdfLabel}\n${summary}\n${extractedText.substring(
            0,
            400
          )}`;
        } else if (row.content) {
          // This is a text-based entry
          contentToUse = row.content.substring(0, 500);
        } else {
          // Fallback
          contentToUse = row.content_summary || "No content available";
        }

        return `Title: ${row.title}\nTags: ${tags}\n${contentToUse}...`;
      });

      console.log(
        `[MUSIC_KNOWLEDGE_RETRIEVAL] 🧠 Formatted ${formattedSnippets.length} knowledge snippets for AI context`
      );

      return formattedSnippets;
    } catch (error) {
      console.error(
        `[MUSIC_KNOWLEDGE_RETRIEVAL] ❌ Unexpected error during knowledge retrieval:`,
        error
      );
      return [];
    }
  }

  async getChatResponse(
    userMessage: string,
    isPlaying: boolean,
    tracks: Track[],
    conversationHistory: Message[] = [],
    isVoice: boolean = false,
    personalizedInstructions?: string
  ): Promise<string> {
    if (!this.isInitialized || !this.model) {
      return await this.getFallbackResponse(userMessage, isPlaying, tracks);
    }
    try {
      // Auto-fetch personalized instructions if not provided
      if (!personalizedInstructions) {
        personalizedInstructions = await this.getPersonalizedInstructions();
      }

      // --- RAG: Retrieve relevant knowledge from Supabase ---
      console.log(
        `[AI_CHAT_RESPONSE] 🔍 Retrieving music production knowledge for user query: "${userMessage}"`
      );

      const knowledgeSnippets = await this.retrieveRelevantKnowledge(
        userMessage,
        5,
        "chat"
      );

      let knowledgeContext = "";
      if (knowledgeSnippets.length > 0) {
        console.log(
          `[AI_CHAT_RESPONSE] 📖 Injecting ${knowledgeSnippets.length} music production knowledge snippets into AI context`
        );

        knowledgeContext = `\n\nHere is relevant music production knowledge from our database. Use this information to answer the user's question as accurately as possible.\n\n${knowledgeSnippets
          .map((s, i) => `Snippet ${i + 1}:\n${s}`)
          .join("\n\n")}`;

        console.log(
          `[AI_CHAT_RESPONSE] 🧠 Knowledge context length: ${knowledgeContext.length} characters`
        );
        console.log(
          `[AI_CHAT_RESPONSE] 🎯 Knowledge context preview:`,
          knowledgeContext.substring(0, 200) + "..."
        );
      } else {
        console.log(
          `[AI_CHAT_RESPONSE] 📭 No music production knowledge found for this query - AI will respond with general knowledge only`
        );
      }
      // ---

      const formattedHistory = this.formatChatHistory(conversationHistory);
      const systemInstructions = await this.getSystemInstructions(
        isPlaying,
        tracks,
        isVoice,
        personalizedInstructions
      );

      // Inject knowledge context into the system prompt
      const fullSystemPrompt = knowledgeContext
        ? `${systemInstructions}\n${knowledgeContext}`
        : systemInstructions;

      if (knowledgeContext) {
        console.log(
          "[AI_SERVICE] 🔗 Knowledge context successfully injected into system prompt"
        );
        console.log(
          `[AI_SERVICE] 📏 Final system prompt length: ${fullSystemPrompt.length} characters (${systemInstructions.length} base + ${knowledgeContext.length} knowledge)`
        );
      } else {
        console.log(
          "[AI_SERVICE] ⚪ No knowledge context - using base system instructions only"
        );
      }

      console.log(
        "[AI_SERVICE] System instructions (first 100 chars):",
        fullSystemPrompt.substring(0, 100) + "..."
      );
      const messagesForChat = [
        { role: "system", parts: [{ text: fullSystemPrompt }] },
        ...formattedHistory,
        { role: "user", parts: [{ text: userMessage }] },
      ];
      const chat = this.model.startChat({
        history: messagesForChat.slice(0, -1).map((msg) => ({
          role: msg.role === "system" ? "user" : msg.role,
          parts: msg.parts,
        })),
        generationConfig: {
          temperature: 0.6, // Moderate randomness for more varied responses
          topP: 0.9,
          topK: 30,
          maxOutputTokens: 300, // Doubled limit to prevent cut-offs
        },
      });
      const result = await chat.sendMessage([{ text: userMessage }]);
      const response = result.response;
      if (!response?.text) {
        return await this.getFallbackResponse(userMessage, isPlaying, tracks);
      }
      return response.text();
    } catch (error: any) {
      this.initializationError = error?.message || "Error generating response";
      return await this.getFallbackResponse(userMessage, isPlaying, tracks);
    }
  }

  private formatChatHistory(history: Message[]) {
    // PERFORMANCE: Limit to last 3 messages for faster processing
    return history
      .filter((msg) => msg.role !== "system")
      .slice(-3)
      .map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      }));
  }

  private async getSystemInstructions(
    isPlaying: boolean,
    tracks: Track[],
    isVoice: boolean,
    personalizedInstructions?: string
  ): Promise<string> {
    // PERFORMANCE OPTIMIZATION: Drastically simplified system instructions
    const state = store.getState();
    const { tempo } = state.project.present;
    const trackCount = tracks.length;

    const baseInstructions = `You are MuseRoom AI for music production. Be concise but complete, friendly, and enthusiastic about music creation! Think of yourself as a knowledgeable studio assistant who's genuinely excited to help artists bring their musical visions to life.

RESPONSE STYLE:
- Keep responses under 200 words to avoid cut-offs
- Be enthusiastic but don't over-explain plans
- Show results, not lengthy process descriptions
- Use natural, varied language (moderate creativity encouraged)

Current: ${
      isPlaying ? "Playing" : "Paused"
    } | ${tempo} BPM | ${trackCount} tracks

${
  personalizedInstructions ? `PERSONALIZATION: ${personalizedInstructions}` : ""
}

FULL CAPABILITIES - You can do ALL of these:

🎵 PLAYBACK & TRANSPORT:
- Play/pause, start/stop recording
- Set tempo (20-300 BPM), toggle metronome, toggle count-in

🎛️ TRACK MANAGEMENT:
- Add audio/instrument tracks, duplicate tracks, delete tracks (single/range/all)
- Move tracks to top/bottom/specific positions, select/clear selections
- Rename tracks, change track colors (red, blue, green, purple, teal, amber, etc.)

🔊 AUDIO CONTROLS:
- Set volume (0-100%), pan tracks (-100 to +100), mute/unmute, solo/unsolo
- Record arm tracks, toggle input monitoring

🔄 LOOPING & NAVIGATION:
- Set loop ranges (measures OR time-based like "0:15-1:30")
- Enable/disable loop mode, start looping with playback
- Navigate to specific bars/measures, jump to start/end, skip forward/backward
- Go to specific time positions

⚙️ PROJECT SETTINGS:
- Set key signatures (C Major, A Minor, etc.), time signatures (4/4, 3/4, 6/8, etc.)
- Rename projects, zoom in/out/fit, undo/redo actions

🎹 ADVANCED FEATURES:
- Time-based loops ("loop from 0:15 to 1:30"), measure-based loops ("loop bars 2-5")
- Complex multi-command sequences, voice command support
- Project management (sort, filter, search on Projects page)

🎓 MUSIC PRODUCTION EXPERT:
You have comprehensive knowledge about ALL aspects of music production, recording, mixing, arrangement, theory, and creative techniques. Answer ANY music-related question with helpful, detailed advice.

NEVER claim to add effects (reverb, delay, compression, EQ, distortion, etc.) - these are coming soon!

For ONLY DAW features not yet implemented, say: "That DAW feature is being crafted with musical precision! Stay tuned! 🎵"

For music production questions, share your knowledge freely - you're a music production expert!

You're capable of complex multi-step commands and should showcase your full range of abilities!

EXAMPLE OF COMPLEX MULTI-COMMAND CAPABILITY:
"Play, set tempo to 120 BPM, add 4 tracks, set loop from bar 1 to 4 on vocals, pan Inst 2 hard right, set its volume to 75%, mute Inst 3, solo Inst 4, and turn on the metronome! Let's groove! 🎶"

This would execute 12 commands and return expectedOutcome like:
"Amazing! Got everything dialed in perfectly! Set the tempo to 120 BPM, added your 4 tracks, locked in that sweet loop from bars 1-4, panned Inst 2 hard right at 75% volume, muted Inst 3, soloed Inst 4, and fired up the metronome! We're ready to rock! 🎵🎸"

NEVER respond with technical language like "12 commands executed" or "Volume changed to 75%" - always use natural, enthusiastic musical language!

You can handle even more complex commands involving time-based loops, track positioning, color changes, recording setup, and navigation all in one request!

TRACK COLOR THEMING MASTERY:
You excel at creating beautiful aesthetic themes with available colors. Here's your creative toolkit:

AVAILABLE COLORS: red, orange, yellow, green, blue, indigo, violet, purple, pink, teal, amber, lime, emerald, rose, fuchsia, sky, cyan
ADDITIONAL COLOR ALIASES: brown→amber, tan→amber, olive→emerald, forest→emerald, sage→emerald, earth→amber, natural→emerald, organic→emerald, turquoise→teal, aqua→sky, mint→emerald, coral→rose, salmon→rose, gold→amber, silver→sky, lavender→indigo, navy→indigo, crimson→rose, scarlet→rose

THEME STRATEGIES & USER GOAL MAPPING:
🌈 RAINBOW THEMES: "make tracks rainbow" or "ROYGBIV colors"
→ Use: red, orange, yellow, green, blue, indigo, violet
→ Response: "Beautiful rainbow spectrum across your tracks! 🌈"

🌿 EARTHY/NATURAL THEMES: "earthy colors" or "natural palette" or "organic vibes"
→ Use: green, emerald, teal, amber, lime
→ Response: "Created an earthy, natural palette that feels grounded and organic! 🌿"

🌸 WARM THEMES: "warm colors" or "sunset vibes" or "cozy feel"
→ Use: red, orange, yellow, amber, rose
→ Response: "Warmed up your tracks with sunset colors for that cozy studio vibe! 🌅"

❄️ COOL THEMES: "cool colors" or "ocean vibes" or "calm palette"
→ Use: blue, sky, cyan, teal, indigo
→ Response: "Cool ocean-inspired colors for a calm, focused workflow! 🌊"

💜 VIBRANT/ELECTRIC THEMES: "vibrant" or "neon" or "electric" or "party colors"
→ Use: fuchsia, purple, lime, cyan, rose
→ Response: "Electric vibes with vibrant colors to energize your session! ⚡"

🌺 SOFT/PASTEL THEMES: "soft colors" or "gentle palette" or "mellow vibes"
→ Use: rose, sky, lime, amber (choose softer variants)
→ Response: "Gentle, soft colors for a peaceful creative atmosphere! 🌸"

🔥 MONOCHROMATIC THEMES: "all blues" or "red family" or "green tones"
→ Use: variations within requested color family
→ Fallback: use closest available colors in that family
→ Response: "Beautiful monochromatic theme in blues for visual harmony! 💙"

🎨 CREATIVE SUBSTITUTION RULES:
- When user requests unavailable colors, map intelligently:
  - "gold" → amber, "silver" → sky, "brown" → amber
  - "turquoise" → teal, "lavender" → purple, "coral" → rose
- Always explain your creative choices: "I used emerald and teal to capture that nature vibe you wanted!"
- Focus on the MOOD/FEELING the user wants to achieve
- Consider track count and distribute colors evenly across the project

AESTHETIC INTELLIGENCE:
You understand that colors create emotions and workflows. Use this knowledge to enhance the musical experience through thoughtful color choices that match the user's creative intent!`;

    // Add voice-specific instructions when isVoice is true
    if (isVoice) {
      return (
        baseInstructions +
        `

VOICE MODE SPECIFIC:
- Keep responses under 100 words - never get cut off mid-sentence
- Use natural speech patterns and avoid complex punctuation
- For simple transport commands (play/pause), acknowledge briefly or stay silent
- Prefer "Got it!" or "Done!" over longer confirmations
- Avoid technical jargon - use musical language that sounds natural when spoken
- When listing multiple items, use "and" instead of commas for better speech flow
- Add moderate variety to responses so they don't sound robotic`
      );
    }

    return baseInstructions;
  }

  // Split input into multiple command segments
  splitMultipleCommands(input: string): string[] {
    const trimmedInput = input.trim();

    // For voice commands, we need to detect natural speech patterns
    // Look for command indicators and action words
    const commandIndicators = [
      // Volume commands
      /\b(turn|set|make|change|increase|decrease|raise|lower)\s+(volume|vol|level)\b/gi,
      /\b(volume|vol|level)\s+(up|down|to|at)\b/gi,
      /\b(louder|quieter|softer)\b/gi,

      // Loop commands
      /\b(start|begin|enable|set|turn on)\s+(loop|looping|cycle)\b/gi,
      /\b(loop|looping|cycle)\s+(from|between|measures?)\b/gi,

      // Playback commands
      /\b(play|start|begin|pause|stop)\s*(playback|music|track|song)?\b/gi,

      // Track commands
      /\b(mute|unmute|solo|unsolo)\s+(track|channel)\b/gi,
      /\b(add|create|new)\s+(track|channel)\b/gi,

      // Tempo commands
      /\b(set|change)\s+(tempo|bpm|speed)\b/gi,
      /\b(tempo|bpm|speed)\s+(to|at)\b/gi,

      // Metronome commands
      /\b(turn|switch)\s+(on|off)\s+(metronome|click|beat)\b/gi,
      /\b(metronome|click|beat)\s+(on|off)\b/gi,
    ];

    // Common conjunctions that separate commands (order matters - longer patterns first)
    const conjunctions = [
      " and then ",
      " and also ",
      " after that ",
      ", then ",
      ", also ",
      " then ",
      " also ",
      " and ",
      " plus ",
      " next ",
    ];

    // Start with the full input
    let segments = [trimmedInput];

    // Split by each conjunction
    for (const conjunction of conjunctions) {
      const newSegments: string[] = [];
      for (const segment of segments) {
        if (segment.toLowerCase().includes(conjunction)) {
          const parts = segment.split(new RegExp(conjunction, "i"));
          newSegments.push(
            ...parts.map((p) => p.trim()).filter((p) => p.length > 0)
          );
        } else {
          newSegments.push(segment);
        }
      }
      segments = newSegments;
    }

    // Handle remaining commas (but be careful not to split things like "measures 2-5, 8-10")
    const finalSegments: string[] = [];
    for (const segment of segments) {
      if (segment.includes(",") && !segment.match(/\d+\s*-\s*\d+\s*,\s*\d+/)) {
        // Split on comma but only if it's not part of a measure range
        const commaParts = segment
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p.length > 0);
        finalSegments.push(...commaParts);
      } else {
        finalSegments.push(segment);
      }
    }

    // Advanced parsing for voice commands without explicit conjunctions
    // Look for multiple command patterns in a single segment
    const advancedSegments: string[] = [];
    for (const segment of finalSegments) {
      // Only try advanced parsing if no conjunctions were found and segment is long enough
      const hasConjunctions = conjunctions.some((conj) =>
        segment.toLowerCase().includes(conj.trim())
      );

      if (hasConjunctions || segment.length < 30) {
        // If conjunctions were already handled or segment is short, don't split further
        advancedSegments.push(segment);
        continue;
      }

      // Use pattern-based splitting for known problematic cases
      const lower = segment.toLowerCase();

      // First try specific hardcoded patterns for complex cases
      // Handle the specific pattern: "turn volume on inst X up metronome off"
      const complexVolumeMetronomePattern =
        /^(.*?volume.*?(?:inst|track|audio|channel).*?up)\s+(metronome.*?off)(.*)$/i;
      const complexMatch = lower.match(complexVolumeMetronomePattern);

      if (complexMatch) {
        const volumeCommand = complexMatch[1].trim();
        const metronomeCommand = complexMatch[2].trim();
        const remaining = complexMatch[3].trim();

        if (volumeCommand.length > 5) advancedSegments.push(volumeCommand);
        if (metronomeCommand.length > 5)
          advancedSegments.push(metronomeCommand);
        if (remaining.length > 5) advancedSegments.push(remaining);

        continue;
      }

      // Handle pattern: "volume command + metronome command"
      const volumeMetronomePattern =
        /^(.*?volume.*?(?:up|down|to\s+\d+))\s+(metronome.*?(?:on|off))(.*)$/i;
      const volMetMatch = lower.match(volumeMetronomePattern);

      if (volMetMatch) {
        const volumeCmd = volMetMatch[1].trim();
        const metronomeCmd = volMetMatch[2].trim();
        const rest = volMetMatch[3].trim();

        if (volumeCmd.length > 5) advancedSegments.push(volumeCmd);
        if (metronomeCmd.length > 5) advancedSegments.push(metronomeCmd);
        if (rest.length > 5) advancedSegments.push(rest);

        continue;
      }

      // Now use commandIndicators for intelligent command boundary detection
      const commandMatches: { match: RegExpMatchArray; pattern: RegExp }[] = [];

      // Find all command indicator matches in the segment
      for (const indicator of commandIndicators) {
        // Reset regex state for global flag
        indicator.lastIndex = 0;
        let match;
        while ((match = indicator.exec(lower)) !== null) {
          commandMatches.push({ match, pattern: indicator });
          // Prevent infinite loop with global flag
          if (!indicator.global) break;
        }
      }

      // If we found multiple command indicators, try to split intelligently
      if (commandMatches.length >= 2) {
        // Sort matches by their position in the string
        commandMatches.sort((a, b) => a.match.index! - b.match.index!);

        const splitPoints: number[] = [];
        for (let i = 1; i < commandMatches.length; i++) {
          const currentMatch = commandMatches[i];
          const prevMatch = commandMatches[i - 1];

          // Add split point at the start of each new command (except the first)
          if (
            currentMatch.match.index! >
            prevMatch.match.index! + prevMatch.match[0].length
          ) {
            splitPoints.push(currentMatch.match.index!);
          }
        }

        if (splitPoints.length > 0) {
          // Split the segment at the detected command boundaries
          let lastIndex = 0;
          for (const splitPoint of splitPoints) {
            const part = segment.substring(lastIndex, splitPoint).trim();
            if (part.length > 5) advancedSegments.push(part);
            lastIndex = splitPoint;
          }
          // Add the remaining part
          const finalPart = segment.substring(lastIndex).trim();
          if (finalPart.length > 5) advancedSegments.push(finalPart);

          continue;
        }
      }

      // If no intelligent splitting was possible, keep the segment as-is
      advancedSegments.push(segment);
    }

    // Filter out very short segments that are likely not commands
    return advancedSegments.filter((segment) => segment.trim().length > 3);
  }

  recognizeCommand(input: string, tracks: Track[]): CommandType {
    const lowerInput = input.toLowerCase().trim();
    if (!lowerInput) return "unknown";
    const attempts: RecognitionAttempt<any>[] = [
      this.recognizeHelpCommand(lowerInput), // Added help command recognition
      this.recognizeStartLoopingCommand(lowerInput), // Check for "start looping" first
      this.recognizePlayheadPositionCommand(lowerInput),
      this.recognizeParameterChange(lowerInput, tracks),
      this.recognizeRenameTrackCommand(lowerInput, tracks), // Rename should come before duplicate
      this.recognizeRenameProjectCommand(lowerInput),
      this.recognizeChangeTrackColorCommand(lowerInput, tracks),
      this.recognizeDuplicateTrackCommand(lowerInput, tracks), // Added duplicate track recognition
      this.recognizeDuplicateAudioFileCommand(lowerInput, tracks), // Added duplicate audio file recognition
      this.recognizeRecordArmCommand(lowerInput, tracks), // Added record arm recognition
      this.recognizeInputMonitoringCommand(lowerInput, tracks), // Added input monitoring recognition
      this.recognizeRecordingCommand(lowerInput, tracks), // Added recording recognition
      this.recognizeUndoRedoCommand(lowerInput), // Added undo/redo recognition
      this.recognizeTrackManagementCommand(lowerInput, tracks), // Added track management recognition
      this.recognizeAdvancedNavigationCommand(lowerInput), // Added advanced navigation recognition
      this.recognizeProjectManagementCommand(lowerInput), // Added project management recognition
      this.recognizeOpenProjectCommand(lowerInput), // Added open project recognition
      this.recognizeNavigateToProjectsCommand(lowerInput), // Added navigate to projects recognition
      this.recognizeAddNoteCommand(lowerInput, tracks), // Added add note recognition
      this.recognizeShowUserDataCommand(lowerInput), // Added show user data recognition
      this.recognizeAddTrackCommand(lowerInput),
      this.recognizeMetronomeToggle(lowerInput),
      this.recognizeTempoChange(lowerInput),
      this.recognizePlayPause(lowerInput),
      this.recognizeLoopToggleCommand(lowerInput),
      this.recognizeLoopRangeCommand(lowerInput),
      this.recognizeMuteTrackCommand(lowerInput, tracks),
      this.recognizeSoloTrackCommand(lowerInput, tracks),
      this.recognizeZoomCommand(lowerInput),
      this.recognizeKeySignatureChange(lowerInput),
      this.recognizeTimeSignatureChange(lowerInput),
    ];
    let bestAttempt: RecognitionAttempt<any> | null = null;
    for (const attempt of attempts) {
      if (attempt.confidence > (bestAttempt?.confidence || 0)) {
        bestAttempt = attempt;
      } else if (
        attempt.confidence === bestAttempt?.confidence &&
        attempt.confidence > 0
      ) {
        if (
          bestAttempt?.type === "play" &&
          attempt.type === "playhead_position"
        )
          bestAttempt = attempt;
        else if (
          bestAttempt?.type === "pause" &&
          attempt.type === "playhead_position" &&
          (attempt.details as PlayheadPositionCommand)?.shouldPlay === false
        )
          bestAttempt = attempt;
      }
    }
    if (
      bestAttempt &&
      bestAttempt.confidence >= MINIMUM_COMMAND_CONFIDENCE_THRESHOLD
    ) {
      this.recognizedCommandDetails = bestAttempt.details;
      return bestAttempt.type;
    }
    this.recognizedCommandDetails = null;
    return "unknown";
  }

  public getRecognizedCommandDetails(): RecognizedCommandDetails {
    return this.recognizedCommandDetails;
  }

  // Generate reverse commands for a given command plan
  private generateReverseCommands(
    originalCommands: AICommand[],
    initialState: any,
    finalState: any
  ): AICommand[] {
    const reverseCommands: AICommand[] = [];

    // First, analyze the overall state changes to avoid duplicates
    const initialTracks = initialState.project.present.tracks;
    const finalTracks = finalState.project.present.tracks;
    const deletedTracks = initialTracks.filter(
      (initial: Track) =>
        !finalTracks.some((final: Track) => final.id === initial.id)
    );
    const addedTracks = finalTracks.filter(
      (final: Track) =>
        !initialTracks.some((initial: Track) => initial.id === final.id)
    );

    // Create consolidated reverse commands for track changes
    if (deletedTracks.length > 0) {
      // Create a single restore operation for all deleted tracks with position info
      const tracksWithPositions = deletedTracks.map((track: Track) => {
        const originalIndex = initialTracks.findIndex(
          (t: Track) => t.id === track.id
        );
        return {
          ...track,
          originalPosition: originalIndex,
        };
      });

      reverseCommands.push({
        type: "restoreMultipleTracksWithPositions",
        parameters: { tracksData: tracksWithPositions },
        description: `Restore ${deletedTracks.length} deleted track(s) to original positions`,
        priority: 1,
      });
    }

    if (addedTracks.length > 0) {
      // Create delete commands for all added tracks
      addedTracks.forEach((addedTrack: Track) => {
        reverseCommands.push({
          type: "deleteTrack",
          parameters: { trackId: addedTrack.id, trackName: addedTrack.name },
          description: `Delete added track "${addedTrack.name}"`,
          priority: 1,
        });
      });
    }

    // Process commands in reverse order for non-track operations
    for (let i = originalCommands.length - 1; i >= 0; i--) {
      const command = originalCommands[i];
      let reverseCommand: AICommand | null = null;

      switch (command.type) {
        case "setTempo":
          reverseCommand = {
            type: "setTempo",
            parameters: { bpm: initialState.project.present.tempo },
            description: `Restore tempo to ${initialState.project.present.tempo} BPM`,
            priority: command.priority,
          };
          break;

        case "toggleMetronome":
          // Only reverse if the state actually changed
          const initialMetronome = initialState.sonification.isMetronomeEnabled;
          const finalMetronome = finalState.sonification.isMetronomeEnabled;
          if (initialMetronome !== finalMetronome) {
            reverseCommand = {
              type: "toggleMetronome",
              parameters: {},
              description: `Restore metronome to ${
                initialMetronome ? "enabled" : "disabled"
              }`,
              priority: command.priority,
            };
          }
          break;

        case "addTrack":
        case "deleteTrack":
        case "deleteAllTracks":
        case "deleteRangeTracks":
        case "moveTrackToTop":
        case "moveTrackToBottom":
        case "moveTrackToPosition":
          // Track operations are handled at the command plan level above
          // to avoid duplicates when multiple tracks are added/deleted
          break;

        case "setVolume":
          // Restore volume to initial value
          const trackId = command.parameters.trackId;
          const initialTrack = initialState.project.present.tracks.find(
            (t: Track) => t.id === trackId
          );
          if (initialTrack) {
            reverseCommand = {
              type: "setVolume",
              parameters: {
                trackId,
                trackName: initialTrack.name,
                volume: initialTrack.volume,
              },
              description: `Restore ${initialTrack.name} volume to ${initialTrack.volume}`,
              priority: command.priority,
            };
          }
          break;

        case "play":
          // Only reverse if playback state changed
          if (
            !initialState.sonification.isPlaying &&
            finalState.sonification.isPlaying
          ) {
            reverseCommand = {
              type: "pause",
              parameters: {},
              description: "Restore paused state",
              priority: command.priority,
            };
          }
          break;

        case "pause":
          // Only reverse if playback state changed
          if (
            initialState.sonification.isPlaying &&
            !finalState.sonification.isPlaying
          ) {
            reverseCommand = {
              type: "play",
              parameters: {},
              description: "Restore playing state",
              priority: command.priority,
            };
          }
          break;

        // Add more reverse command cases as needed
        default:
          console.warn(`No reverse command defined for: ${command.type}`);
          break;
      }

      if (reverseCommand) {
        reverseCommands.push(reverseCommand);
      }
    }

    return reverseCommands;
  }

  // Add a command plan snapshot to history
  private addCommandPlanSnapshot(snapshot: AICommandPlanSnapshot): void {
    this.commandPlanHistory.push(snapshot);

    // Maintain history size limit
    if (this.commandPlanHistory.length > this.maxPlanHistorySize) {
      this.commandPlanHistory.shift();
    }
  }

  // Get the last command plan snapshot for undo
  public getLastCommandPlanSnapshot(): AICommandPlanSnapshot | null {
    return this.commandPlanHistory.length > 0
      ? this.commandPlanHistory[this.commandPlanHistory.length - 1]
      : null;
  }

  // Remove the last command plan snapshot (after successful undo)
  public removeLastCommandPlanSnapshot(): void {
    this.commandPlanHistory.pop();
  }

  // Get command plan history for debugging
  public getCommandPlanHistory(): AICommandPlanSnapshot[] {
    return [...this.commandPlanHistory];
  }

  // Clear command plan history
  public clearCommandPlanHistory(): void {
    this.commandPlanHistory = [];
  }

  private getMusicallyFriendlyMessage(
    commandType: string,
    commandDescription: string
  ): string {
    // Map technical command names to user-friendly musical language
    const friendlyMessages: Record<string, string> = {
      // Audio processing
      compressDrums: "Drum compression tools are coming soon! 🥁",
      compressVocals: "Vocal compression features are in development! 🎤",
      addReverb: "Reverb effects are being fine-tuned! ✨",
      addDelay: "Delay effects are on the way! 🔄",
      addChorus: "Chorus effects are coming soon! 🌊",
      addDistortion: "Distortion effects are being crafted! 🔥",
      normalizeAudio: "Audio normalization tools are in the works! 📊",

      // Advanced mixing
      eqTrack: "EQ controls are being developed! 🎛️",
      addSidechain: "Sidechain compression is coming! 🔗",
      automateVolume: "Volume automation is being built! 📈",
      automatePan: "Pan automation features are on the horizon! ↔️",

      // MIDI and instruments
      addMidiClip: "MIDI clip creation is coming soon! 🎹",
      quantizeMidi: "MIDI quantization tools are in development! ⚡",
      transposeMidi: "MIDI transposition features are being added! 🎵",
      addVirtualInstrument: "Virtual instruments are coming! 🎸",

      // File operations
      exportTrack: "Track export options are being finalized! 💾",
      importAudio: "Enhanced audio import is coming! 📂",
      saveProject: "Advanced project saving is in the works! 💾",

      // Collaboration
      shareProject: "Project sharing features are coming soon! 🤝",
      addComment: "Collaboration comments are being developed! 💬",

      // Advanced features
      beatDetection: "Beat detection algorithms are being refined! 🎯",
      keyDetection: "Key detection features are coming! 🔑",
      audioToMidi: "Audio-to-MIDI conversion is in development! 🎼",

      // Performance
      freezeTrack: "Track freezing capabilities are coming! ❄️",
      bounceTrack: "Track bouncing features are being added! 🎯",
    };

    // Check if we have a specific friendly message for this command
    if (friendlyMessages[commandType]) {
      return friendlyMessages[commandType];
    }

    // If no specific mapping, create a generic musical response based on the description
    if (commandDescription) {
      // Extract key musical terms from the description
      const description = commandDescription.toLowerCase();

      if (
        description.includes("compress") ||
        description.includes("compression")
      ) {
        return "Compression tools are being fine-tuned for the perfect sound! 🎛️";
      }
      if (description.includes("eq") || description.includes("equaliz")) {
        return "EQ controls are coming to shape your frequencies! 🌈";
      }
      if (description.includes("reverb") || description.includes("echo")) {
        return "Spatial effects are being crafted for amazing ambience! ✨";
      }
      if (description.includes("delay") || description.includes("repeat")) {
        return "Delay effects are in development for rhythmic magic! 🔄";
      }
      if (
        description.includes("distort") ||
        description.includes("overdrive")
      ) {
        return "Distortion effects are being forged for that edge! 🔥";
      }
      if (description.includes("midi") || description.includes("note")) {
        return "MIDI features are being composed for musical perfection! 🎹";
      }
      if (description.includes("export") || description.includes("save")) {
        return "Export features are being finalized for seamless sharing! 💾";
      }
      if (description.includes("import") || description.includes("load")) {
        return "Import capabilities are being enhanced! 📂";
      }
      if (description.includes("automat") || description.includes("envelope")) {
        return "Automation tools are being programmed for dynamic control! 📈";
      }
      if (description.includes("beat") || description.includes("rhythm")) {
        return "Rhythm analysis tools are being developed! 🥁";
      }
      if (description.includes("key") || description.includes("pitch")) {
        return "Pitch and key features are being tuned! 🎵";
      }
      if (description.includes("mix") || description.includes("blend")) {
        return "Advanced mixing tools are being crafted! 🎛️";
      }
      if (description.includes("master") || description.includes("final")) {
        return "Mastering features are being perfected! ✨";
      }
    }

    // Generic fallback with musical enthusiasm
    return "This feature is being crafted with musical precision! Stay tuned for updates! 🎵";
  }

  // Execute reverse commands to undo a command plan
  async undoLastCommandPlan(dispatch: any): Promise<AICommandResult> {
    const lastSnapshot = this.getLastCommandPlanSnapshot();
    if (!lastSnapshot) {
      return {
        success: false,
        message: "No command plan to undo",
        executedCommands: [],
        failedCommands: [],
      };
    }

    // Execute the reverse commands
    const reverseResult = await this.executeCommandPlan(
      {
        commands: lastSnapshot.reverseCommands,
        reasoning: `Undoing: ${lastSnapshot.originalPlan.reasoning}`,
        expectedOutcome: "Restore previous state",
        id: `undo-${lastSnapshot.planId}`,
      },
      dispatch,
      store.getState(),
      "undo"
    );

    if (reverseResult.success) {
      // Remove the snapshot from history since it's been undone
      this.removeLastCommandPlanSnapshot();
    }

    return {
      ...reverseResult,
      message: `Undid command plan: ${lastSnapshot.originalPlan.reasoning}`,
    };
  }

  recognizeRenameProjectCommand(
    input: string
  ): RecognitionAttempt<RenameProjectCommand> {
    console.log("[AI_RECOG_RENAME_PROJECT] Input:", input);
    let confidence = 0;
    let details: RenameProjectCommand | null = null;
    const lowerInput = input.toLowerCase();
    const patterns = [
      /(?:rename|change|set)\s+(?:project|song|this project|current project)\s+(?:name|title)\s+(?:to|as)\s+['"]?([^'"\n]+)['"]?/i,
      /(?:name|title)\s+(?:project|song|this project|current project)\s+['"]?([^'"\n]+)['"]?/i,
      /call\s+(?:this|the)\s+project\s+['"]?([^'"\n]+)['"]?/i,
      /project\s+name\s+is\s+['"]?([^'"\n]+)['"]?/i,
      /set\s+project\s+['"]?([^'"\n]+)['"]?/i,
    ];
    for (const pattern of patterns) {
      const match = lowerInput.match(pattern);
      if (match && match[1]) {
        const newName = match[1].trim().replace(/^['"]|['"]$/g, "");
        if (newName.length > 0 && newName.length <= 100) {
          details = { newName };
          confidence = 0.85;
          if (/(rename|change)\s+project/.test(lowerInput)) confidence += 0.1;
          if (/(name|title)\s+to/.test(lowerInput)) confidence += 0.05;
          break;
        }
      }
    }
    console.log(
      "[AI_RECOG_RENAME_PROJECT] Details:",
      details,
      "Confidence:",
      confidence
    );
    return {
      type: "rename_project",
      details,
      confidence: Math.min(1, confidence),
    };
  }

  recognizeRenameTrackCommand(
    input: string,
    tracks: Track[]
  ): RecognitionAttempt<RenameTrackCommand> {
    console.log("[AI_RECOG_RENAME_TRACK] Input:", input);
    let confidence = 0;
    let details: RenameTrackCommand | null = null;
    const lowerInput = input.toLowerCase();
    if (!tracks || tracks.length === 0) {
      console.log(
        "[AI_RECOG_RENAME_TRACK] Details:",
        details,
        "Confidence:",
        confidence
      );
      return { type: "rename_track", details, confidence };
    }
    const patterns = [
      /(?:rename|change|set)\s+(?:track\s+)?['"]?([^'"\n]+)['"]?\s+(?:name|title)?\s*(?:to|as)\s+['"]?([^'"\n]+)['"]?/i,
      /(?:change|set)\s+name\s+(?:of|for)\s+(?:track\s+)?['"]?([^'"\n]+)['"]?\s+(?:to|as)\s+['"]?([^'"\n]+)['"]?/i,
      /(?:name|title)\s+(?:track\s+)?['"]?([^'"\n]+)['"]?\s+(?:as|to)\s+['"]?([^'"\n]+)['"]?/i,
      /call\s+(?:track\s+)?['"]?([^'"\n]+)['"]?\s+['"]?([^'"\n]+)['"]?/i,
      /rename\s+['"]?([^'"\n]+)['"]?\s+['"]?([^'"\n]+)['"]?/i,
    ];
    for (const pattern of patterns) {
      const match = lowerInput.match(pattern);
      if (match && match[1] && match[2]) {
        const oldNameCandidate = match[1].trim().replace(/^['"]|['"]$/g, "");
        const newTrackName = match[2].trim().replace(/^['"]|['"]$/g, "");
        if (newTrackName.length > 0 && newTrackName.length <= 100) {
          const targetTrack = this.findTrackByNameInInput(
            oldNameCandidate,
            tracks
          );
          if (targetTrack) {
            details = {
              trackId: targetTrack.id,
              currentTrackName: targetTrack.name,
              newTrackName,
            };
            confidence = 0.8;
            if (
              oldNameCandidate.toLowerCase() === targetTrack.name.toLowerCase()
            )
              confidence += 0.1;
            break;
          } else {
            confidence = 0.4;
          }
        }
      }
    }
    if (!details && confidence < 0.7) {
      const simplerPattern =
        /(?:rename|name|call)\s+['"]?([^'"\n]+)['"]?\s+['"]?([^'"\n]+)['"]?/i;
      const simplerMatch = lowerInput.match(simplerPattern);
      if (simplerMatch && simplerMatch[1] && simplerMatch[2]) {
        const oldNameCandidate = simplerMatch[1]
          .trim()
          .replace(/^['"]|['"]$/g, "");
        const newTrackName = simplerMatch[2].trim().replace(/^['"]|['"]$/g, "");
        if (newTrackName.length > 0 && newTrackName.length <= 100) {
          const targetTrack = this.findTrackByNameInInput(
            oldNameCandidate,
            tracks
          );
          if (targetTrack) {
            const simplerConfidence = 0.65;
            if (simplerConfidence > confidence) {
              details = {
                trackId: targetTrack.id,
                currentTrackName: targetTrack.name,
                newTrackName,
              };
              confidence = simplerConfidence;
            }
          }
        }
      }
    }
    console.log(
      "[AI_RECOG_RENAME_TRACK] Details:",
      details,
      "Confidence:",
      confidence
    );
    return {
      type: "rename_track",
      details,
      confidence: Math.min(1, confidence),
    };
  }

  recognizeChangeTrackColorCommand(
    input: string,
    tracks: Track[]
  ): RecognitionAttempt<ChangeTrackColorCommand> {
    console.log("[AI_RECOG_COLOR] Input:", input);
    let confidence = 0;
    let details: ChangeTrackColorCommand | null = null;
    const lowerInput = input.toLowerCase();
    if (!tracks || tracks.length === 0) {
      console.log(
        "[AI_RECOG_COLOR] Details:",
        details,
        "Confidence:",
        confidence
      );
      return { type: "change_track_color", details, confidence };
    }
    const patterns = [
      /(?:change|set)\s+colou?r\s+(?:of|for)\s+(?:track\s+)?['"]?([^'"\n]+)['"]?\s+to\s+['"]?([^'"\n\s]+)['"]?/i,
      /colou?r\s+(?:track\s+)?['"]?([^'"\n]+)['"]?\s+['"]?([^'"\n\s]+)['"]?/i,
      /make\s+(?:track\s+)?['"]?([^'"\n]+)['"]?\s+['"]?([^'"\n\s]+)['"]?/i,
      /set\s+(?:track\s+)?['"]?([^'"\n]+)['"]?\s+colou?r\s+['"]?([^'"\n\s]+)['"]?/i,
      /change\s+['"]?([^'"\n]+)['"]?\s+to\s+['"]?([^'"\n\s]+)['"]?/i,
    ];
    for (const pattern of patterns) {
      const match = lowerInput.match(pattern);
      if (match && match[1] && match[2]) {
        const trackNameCandidate = match[1].trim().replace(/^['"]|['"]$/g, "");
        const colorCandidate = match[2].trim().replace(/^['"]|['"]$/g, "");
        const targetTrack = this.findTrackByNameInInput(
          trackNameCandidate,
          tracks
        );
        const normalizedColor = normalizeColor(colorCandidate);
        if (targetTrack && normalizedColor) {
          if (
            pattern.source.startsWith("change\\s+['\"]?") &&
            !lowerInput.includes("color") &&
            !lowerInput.includes("colour")
          ) {
            const isKnownColorName = Object.keys(
              COLOR_NAME_TO_TAILWIND
            ).includes(colorCandidate.toLowerCase());
            const isHexColor = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(
              colorCandidate
            );
            const isTailwindClass = TRACK_COLORS.includes(
              colorCandidate.toLowerCase()
            );
            if (!isKnownColorName && !isHexColor && !isTailwindClass) {
              continue;
            }
          }
          details = {
            trackId: targetTrack.id,
            currentTrackName: targetTrack.name,
            newColor: normalizedColor,
          };
          confidence = 0.8;
          if (
            trackNameCandidate.toLowerCase() === targetTrack.name.toLowerCase()
          )
            confidence += 0.1;
          if (
            COLOR_NAME_TO_TAILWIND[colorCandidate.toLowerCase()] ||
            TRACK_COLORS.map((c) => c.toLowerCase()).includes(
              colorCandidate.toLowerCase()
            )
          ) {
            confidence += 0.05;
          }
          break;
        } else if (targetTrack && !normalizedColor) {
          if (lowerInput.includes("color") || lowerInput.includes("colour")) {
            confidence = 0.3;
          }
        }
      }
    }
    console.log(
      "[AI_RECOG_COLOR] Details:",
      details,
      "Confidence:",
      confidence
    );
    return {
      type: "change_track_color",
      details,
      confidence: Math.min(1, confidence),
    };
  }

  recognizeHelpCommand(input: string): RecognitionAttempt<any> {
    let confidence = 0;
    const lowerInput = input.toLowerCase().trim();

    const helpPatterns = [
      /what (?:all |else )?can you do/i,
      /what (?:are your|are the) (?:functions|capabilities|features)/i,
      /what (?:can|could) you help (?:me )?with/i,
      /help(?: me)?$/i,
      /show me what you can do/i,
      /list (?:your )?(?:commands|abilities|capabilities|features)/i,
      /how can you assist/i,
      /how can you help/i,
      /what are you capable of/i,
    ];

    for (const pattern of helpPatterns) {
      if (pattern.test(lowerInput)) {
        confidence = 0.9;
        break;
      }
    }

    return {
      type: "help", // Use "help" type
      details:
        confidence > 0.5
          ? {
              message:
                "I can control playback (play, pause, stop), adjust track parameters (volume, pan, mute, solo), manage the metronome and tempo, add new tracks, duplicate tracks and audio files, control loop/cycle mode, zoom and navigate the project, rename the project and tracks, and change track colors. I can also answer general music production questions.",
            }
          : null,
      confidence,
    };
  }

  recognizeAddTrackCommand(input: string): RecognitionAttempt<AddTrackCommand> {
    let confidence = 0;
    let details: AddTrackCommand | null = null;
    if (!input?.trim()) return { type: "add_track", details, confidence };
    const lowerInput = input.toLowerCase();
    const trackKeywords = ["track", "channel"];
    const actionKeywords = [
      "add",
      "create",
      "new",
      "make",
      "another",
      "one more",
    ];
    const hasTrackKeyword = trackKeywords.some((kw) => lowerInput.includes(kw));
    const hasActionKeyword = actionKeywords.some((kw) =>
      lowerInput.includes(kw)
    );
    if (hasTrackKeyword && hasActionKeyword) {
      confidence += 0.7; // base confidence high enough to pass threshold
      let trackType = TrackType.AUDIO;
      if (
        lowerInput.includes("instrument") ||
        lowerInput.includes("midi") ||
        lowerInput.includes("software")
      ) {
        trackType = TrackType.SOFTWARE_INSTRUMENT;
        confidence += 0.2;
      }
      let trackName: string | undefined;
      const namePatterns = [
        /(?:named|called|labeled|titled|with name|with label|with title)\s+['"]?([^'"]+)['"]?/i,
        /(?:add|create|new|make)\s+(?:a|an)?\s+(?:audio|instrument|software|midi)?\s*(?:track|channel)?\s+['"]?([^'"]+)['"]?/i,
        /(?:add|create|new|make)\s+['"]?([^'"]+)['"]?\s+(?:audio|instrument|software|midi)?\s*(?:track|channel)/i,
        /track\s+['"]?([^'"]+)['"]?/i,
        /(?:add|create|new|make)\s+(?:a|an)?\s+(?:track|channel)\s+(?:for|of)\s+['"]?([^'"]+)['"]?/i,
      ];
      for (const pattern of namePatterns) {
        const match = lowerInput.match(pattern);
        if (match && match[1]) {
          const candidate = match[1].trim().replace(/^['"]|['"]$/g, "");
          // Ignore generic phrases like "a new", "new", "track", etc.
          const genericPatterns =
            /^(?:a\s+new|new|track|audio|audio\s+track|instrument\s+track|channel)$/i;
          if (!genericPatterns.test(candidate)) {
            trackName = candidate;
            confidence += 0.15;
          }
          break;
        }
      }
      details = { trackType, trackName };
    }
    return { type: "add_track", details, confidence: Math.min(1, confidence) };
  }

  recognizeMetronomeToggle(
    input: string
  ): RecognitionAttempt<MetronomeToggleDetails> {
    let confidence = 0;
    let details: MetronomeToggleDetails | null = null;
    if (!input?.trim())
      return { type: "metronome_toggle", details, confidence };
    const lowerInput = input.toLowerCase();
    const metronomeKeywordsRegex = "(metronome|click|tick|beat|count)";
    const onKeywordsRegex = "(on|enable|activate|start|turn\\s+on)";
    const offKeywordsRegex = "(off|disable|deactivate|stop|turn\\s+off)";
    const hasMetronomeKeyword = new RegExp(
      `\\b${metronomeKeywordsRegex}\\b`,
      "i"
    ).test(lowerInput);

    // Also check if input starts with action words that might apply to metronome
    const startsWithAction = /^(up|down|on|off|enable|disable)\s+/.test(
      lowerInput
    );
    const hasMetronomeInContext =
      hasMetronomeKeyword ||
      (startsWithAction &&
        new RegExp(`\\b${metronomeKeywordsRegex}\\b`, "i").test(lowerInput));

    if (hasMetronomeInContext) {
      confidence = 0.5;
      if (new RegExp(`\\b${onKeywordsRegex}\\b`, "i").test(lowerInput)) {
        details = { intent: "on" };
        confidence += 0.4;
      } else if (
        new RegExp(`\\b${offKeywordsRegex}\\b`, "i").test(lowerInput)
      ) {
        details = { intent: "off" };
        confidence += 0.4;
      } else {
        const generalActionKeywordsRegex =
          "(toggle|switch|on|off|enable|disable|activate|deactivate|start|stop|turn\\s+on|turn\\s+off)";
        if (
          new RegExp(`\\b${generalActionKeywordsRegex}\\b`, "i").test(
            lowerInput
          ) ||
          new RegExp(`^\\s*${metronomeKeywordsRegex}\\s*$`, "i").test(
            lowerInput
          )
        ) {
          details = { intent: "toggle" };
          confidence += 0.3;
        }
      }
    }
    return {
      type: "metronome_toggle",
      details,
      confidence: details ? Math.min(1, confidence) : 0,
    };
  }

  recognizeTempoChange(input: string): RecognitionAttempt<TempoChangeCommand> {
    let confidence = 0;
    let details: TempoChangeCommand | null = null;
    if (!input?.trim()) return { type: "tempo_change", details, confidence };
    const lowerInput = input.toLowerCase();
    const tempoKeywords = ["tempo", "bpm", "speed", "beat", "pace"];
    // Removed generic keywords like "song", "music", "track" to avoid conflicts
    const increaseKeywords = [
      "increase",
      "faster",
      "speed up",
      "higher",
      "quicker",
      "raise",
    ];
    const decreaseKeywords = [
      "decrease",
      "slower",
      "slow down",
      "lower",
      "reduce",
    ];

    const hasTempoContext = tempoKeywords.some((kw) => lowerInput.includes(kw));
    const hasIncreaseIntent = increaseKeywords.some((kw) =>
      lowerInput.includes(kw)
    );
    const hasDecreaseIntent = decreaseKeywords.some((kw) =>
      lowerInput.includes(kw)
    );
    const hasNumeric = /\b\d{2,3}\b/.test(lowerInput);
    if (
      !hasTempoContext &&
      !hasIncreaseIntent &&
      !hasDecreaseIntent &&
      !hasNumeric
    )
      return { type: "tempo_change", details, confidence };

    // If we have numeric but no tempo context, require tempo-specific actions
    if (
      hasNumeric &&
      !hasTempoContext &&
      !(hasIncreaseIntent || hasDecreaseIntent)
    ) {
      return { type: "tempo_change", details, confidence };
    }

    confidence = 0.3;
    const currentState = store.getState();
    const currentTempo = currentState.project.present.tempo;
    let targetTempo = currentTempo;
    let action: "increase" | "decrease" | "set" = "set";
    let isDefaultAmountApplied = false;
    const setTempoValueMatch = lowerInput.match(
      /(?:set|to|at|tempo|bpm)\s*(\d+)(?:\s*bpm)?/i
    );
    if (setTempoValueMatch && setTempoValueMatch[1]) {
      action = "set";
      targetTempo = parseInt(setTempoValueMatch[1], 10);
      confidence += 0.6;
    } else {
      let amount = DEFAULT_TEMPO_CHANGE_AMOUNT;
      let isRelativeChangeIdentified = false;
      confidence += 0.2;
      if (
        lowerInput.includes("slightly") ||
        lowerInput.includes("a bit") ||
        lowerInput.includes("a little")
      ) {
        amount = Math.round(DEFAULT_TEMPO_CHANGE_AMOUNT / 2);
        confidence += 0.1;
      } else if (
        lowerInput.includes("a lot") ||
        lowerInput.includes("significantly") ||
        lowerInput.includes("much")
      ) {
        amount = DEFAULT_TEMPO_CHANGE_AMOUNT * 2;
        confidence += 0.1;
      }
      const amountMatch = lowerInput.match(
        /\b(?:by|with)\s+(\d+)(?:\s*bpm)?\b/i
      );
      if (amountMatch && amountMatch[1]) {
        amount = parseInt(amountMatch[1], 10);
        confidence += 0.3;
      } else if (hasIncreaseIntent || hasDecreaseIntent)
        isDefaultAmountApplied = true;
      if (hasIncreaseIntent) {
        action = "increase";
        targetTempo = currentTempo + amount;
        isRelativeChangeIdentified = true;
        confidence += 0.2;
      } else if (hasDecreaseIntent) {
        action = "decrease";
        targetTempo = currentTempo - amount;
        isRelativeChangeIdentified = true;
        confidence += 0.2;
      }
      if (!isRelativeChangeIdentified && !hasTempoContext)
        return { type: "tempo_change", details: null, confidence: 0 };
      if (!isRelativeChangeIdentified)
        return { type: "tempo_change", details: null, confidence: 0.1 };
    }
    // Attempt to capture spelled-out numbers like "one twenty", "one hundred twenty", or single word "eighty"
    if (!setTempoValueMatch) {
      const words = lowerInput.split(/[^a-z]+/);
      const numericWords: number[] = [];
      for (const w of words) {
        const n = wordToNumber(w);
        if (n !== null) numericWords.push(n);
      }
      if (numericWords.length) {
        // Simple heuristic: if first two numbers form common bpm like 120 => [1,20] combine
        let candidate = 0;
        if (numericWords.length >= 2 && numericWords[0] < 10) {
          candidate = numericWords[0] * 100 + numericWords[1];
        } else {
          candidate = numericWords[0];
        }
        if (candidate >= 20 && candidate <= 300) {
          action = hasIncreaseIntent
            ? "increase"
            : hasDecreaseIntent
            ? "decrease"
            : "set";
          targetTempo = hasIncreaseIntent
            ? currentTempo + candidate
            : hasDecreaseIntent
            ? currentTempo - candidate
            : candidate;
          confidence += 0.4;
        }
      }
    }
    targetTempo = Math.max(20, Math.min(300, targetTempo));
    details = { currentTempo, targetTempo, action, isDefaultAmountApplied };
    return {
      type: "tempo_change",
      details,
      confidence: Math.min(1, confidence),
    };
  }

  recognizeKeySignatureChange(
    input: string
  ): RecognitionAttempt<KeySignatureChangeCommand> {
    let confidence = 0;
    let details: KeySignatureChangeCommand | null = null;
    const lower = input.toLowerCase();

    // normalise keywords like "make it", "set to" etc.
    const containsKeyWord = /key|key\s+signature/.test(lower);

    // map enharmonic words
    let cleaned = lower
      .replace(/\s*-\s*/g, "") // remove hyphens between letter and flat/sharp words
      .replace(/flat/g, "b")
      .replace(/sharp/g, "#");
    cleaned = cleaned.replace(/\s+/g, " ").trim();
    // Merge patterns like "a b major" -> "ab major"
    cleaned = cleaned
      .replace(/([a-g])\s+b/gi, "$1b")
      .replace(/([a-g])\s+#/gi, "$1#");

    // Try exact token match first with word boundaries to avoid 'Ab' -> 'B' confusion
    const escape = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    for (const ks of KEY_SIGNATURES) {
      const normalizedKs = ks.toLowerCase().replace("♭", "b").replace("♯", "#");
      const pattern = new RegExp(`\\b${escape(normalizedKs)}\\b`);
      if (pattern.test(cleaned)) {
        details = { newKey: ks, currentKey: "" } as any;
        confidence = containsKeyWord ? 0.97 : 0.92;
        break;
      }
    }

    return { type: "key_signature_change", details, confidence };
  }

  recognizeTimeSignatureChange(
    input: string
  ): RecognitionAttempt<TimeSignatureChangeCommand> {
    let confidence = 0;
    let details: TimeSignatureChangeCommand | null = null;
    const lower = input.toLowerCase();
    if (/time\s*signature|meter|time\s*sig/.test(lower)) {
      const match = lower.match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
      if (match) {
        const num = parseInt(match[1], 10);
        const den = parseInt(match[2], 10);
        if (num >= 1 && num <= 32 && [1, 2, 4, 8, 16, 32].includes(den)) {
          details = {
            newNumerator: num,
            newDenominator: den,
            currentNumerator: 0,
            currentDenominator: 0,
          } as any;
          confidence = 0.9;
        }
      }
    }
    return { type: "time_signature_change", details, confidence };
  }

  recognizeDuplicateTrackCommand(
    input: string,
    tracks: Track[]
  ): RecognitionAttempt<DuplicateTrackCommand> {
    console.log("[AI_RECOG_DUPLICATE_TRACK] Input:", input);
    let confidence = 0;
    let details: DuplicateTrackCommand | null = null;
    const lowerInput = input.toLowerCase();

    if (!tracks || tracks.length === 0) {
      console.log("[AI_RECOG_DUPLICATE_TRACK] No tracks available");
      return { type: "duplicate_track", details, confidence };
    }

    // Check for conflicting keywords that indicate other commands
    const renameKeywords = ["rename", "name", "call"];
    const colorKeywords = ["color", "colour"];
    const hasConflictingKeywords =
      renameKeywords.some((kw) => lowerInput.includes(kw)) ||
      colorKeywords.some((kw) => lowerInput.includes(kw));

    // If this looks like a rename or color command, reduce confidence significantly
    if (hasConflictingKeywords) {
      console.log(
        "[AI_RECOG_DUPLICATE_TRACK] Conflicting keywords detected, reducing confidence"
      );
      return { type: "duplicate_track", details, confidence: 0 };
    }

    const duplicateKeywords = ["duplicate", "copy", "clone"];
    const trackKeywords = ["track", "channel"];

    const hasDuplicateKeyword = duplicateKeywords.some((kw) =>
      lowerInput.includes(kw)
    );

    // Also check for implicit track duplication (e.g., "duplicate test" where "test" is a track name)
    const hasTrackKeyword = trackKeywords.some((kw) => lowerInput.includes(kw));

    // Try to find a track first to see if this might be track duplication
    const targetTrack = this.findTrackByNameInInput(lowerInput, tracks);

    if (hasDuplicateKeyword && (hasTrackKeyword || targetTrack)) {
      confidence = 0.7;

      if (targetTrack) {
        details = {
          trackId: targetTrack.id,
          trackName: targetTrack.name,
          preserveSettings: true, // Default to preserving all settings
        };
        confidence += 0.25;

        // If track keyword is explicitly mentioned, higher confidence
        if (hasTrackKeyword) {
          confidence += 0.05;
        }

        // Check for keywords that indicate preserving settings
        if (
          lowerInput.includes("settings") ||
          lowerInput.includes("properties") ||
          lowerInput.includes("preserve")
        ) {
          confidence += 0.05;
        }
      } else {
        // No specific track found, but command looks like track duplication
        confidence = 0.4;
      }
    }

    console.log(
      "[AI_RECOG_DUPLICATE_TRACK] Details:",
      details,
      "Confidence:",
      confidence
    );
    return {
      type: "duplicate_track",
      details,
      confidence: Math.min(1, confidence),
    };
  }

  recognizeDuplicateAudioFileCommand(
    input: string,
    tracks: Track[]
  ): RecognitionAttempt<DuplicateAudioFileCommand> {
    console.log("[AI_RECOG_DUPLICATE_AUDIO] Input:", input);
    let confidence = 0;
    let details: DuplicateAudioFileCommand | null = null;
    const lowerInput = input.toLowerCase();

    if (!tracks || tracks.length === 0) {
      console.log("[AI_RECOG_DUPLICATE_AUDIO] No tracks available");
      return { type: "duplicate_audio_file", details, confidence };
    }

    const duplicateKeywords = ["duplicate", "copy", "clone"];
    const audioKeywords = ["audio", "file", "region", "clip", "sample", "stem"];

    const hasDuplicateKeyword = duplicateKeywords.some((kw) =>
      lowerInput.includes(kw)
    );
    const hasAudioKeyword = audioKeywords.some((kw) => lowerInput.includes(kw));

    if (hasDuplicateKeyword && hasAudioKeyword) {
      confidence = 0.6;

      // Look for specific region/file names or track context
      // For now, we'll look for track references and assume the user wants to duplicate
      // the most recent or selected audio region on that track
      const targetTrack = this.findTrackByNameInInput(lowerInput, tracks);

      if (targetTrack && targetTrack.regions.length > 0) {
        // Find the first audio region (with audioFilename) on this track
        const audioRegion = targetTrack.regions.find(
          (region) => region.audioFilename
        );

        if (audioRegion) {
          details = {
            regionId: audioRegion.id,
            regionName: audioRegion.name,
            trackId: targetTrack.id,
            trackName: targetTrack.name,
          };
          confidence += 0.3;
        }
      } else {
        // No specific track found, but command looks like audio duplication
        confidence = 0.4;
      }
    }

    console.log(
      "[AI_RECOG_DUPLICATE_AUDIO] Details:",
      details,
      "Confidence:",
      confidence
    );
    return {
      type: "duplicate_audio_file",
      details,
      confidence: Math.min(1, confidence),
    };
  }

  recognizeParameterChange(
    input: string,
    tracks: Track[]
  ): RecognitionAttempt<ParameterChangeCommand | MuteActionDetails> {
    let confidence = 0;
    let details: ParameterChangeCommand | MuteActionDetails | null = null;
    if (!tracks?.length || !input?.trim())
      return { type: "parameter_change", details, confidence };

    const lowerInput = input.toLowerCase();
    const volKeywords = [
      "volume",
      "level",
      "louder",
      "quieter",
      "softer",
      "gain",
      "sound",
      "audio",
      "music",
    ];

    // Try to find a track by name first
    let targetTrack = this.findTrackByNameInInput(input, tracks);

    // If no specific track found but volume/pan keywords present, use first track as fallback
    const hasVolumeKeywords = volKeywords.some((kw) => lowerInput.includes(kw));
    const hasPanKeywords = ["pan", "left", "right", "center"].some((kw) =>
      lowerInput.includes(kw)
    );

    if (
      !targetTrack &&
      (hasVolumeKeywords || hasPanKeywords) &&
      tracks.length > 0
    ) {
      // Look for track references like "inst 1", "track 1", "audio 1", etc.
      const trackReferencePattern =
        /\b(?:on|for|to|in)\s+((?:inst|track|audio|channel|vocal|drum|bass|synth|piano|guitar)\s*\d*|[a-zA-Z]+\s+\d+)\b/i;
      const trackRefMatch = lowerInput.match(trackReferencePattern);

      if (trackRefMatch) {
        const trackRef = trackRefMatch[1].trim();
        // Try to find track by this reference
        targetTrack = this.findTrackByNameInInput(trackRef, tracks);
      }

      // If still no track found, use first available track
      if (!targetTrack) {
        targetTrack = tracks[0];
        confidence = 0.2; // Lower confidence since no specific track mentioned
      } else {
        confidence = 0.3; // Normal confidence if track was found by reference
      }
    } else if (targetTrack) {
      confidence = 0.3; // Normal confidence if track was found by name
    }

    if (!targetTrack) return { type: "parameter_change", details, confidence };
    const volActionKeywords = [
      "increase",
      "decrease",
      "raise",
      "lower",
      "set",
      "turn up",
      "turn down",
      "mute",
      "unmute",
    ];
    const hasVolumeKeyword = volKeywords.some((kw) => lowerInput.includes(kw));
    const hasVolumeAction = volActionKeywords.some((kw) =>
      lowerInput.includes(kw)
    );
    if (
      hasVolumeKeyword ||
      (hasVolumeAction && lowerInput.includes(targetTrack.name.toLowerCase()))
    ) {
      confidence += 0.3;
      const volumeCommandDetails = this.parseVolumeCommand(
        lowerInput,
        targetTrack
      );
      if (volumeCommandDetails) {
        if (volumeCommandDetails.redirectIntent) {
          const muteDetails: MuteActionDetails = {
            trackId: volumeCommandDetails.trackId,
            trackName: volumeCommandDetails.trackName,
            intent: volumeCommandDetails.redirectIntent,
          };
          return {
            type: "mute_track",
            details: muteDetails,
            confidence: Math.min(1, confidence + 0.5),
          };
        }
        details = volumeCommandDetails;
        confidence += 0.3;
        if (
          volumeCommandDetails.action === "set" ||
          lowerInput.match(/(?:set|to|is|at|volume)\s*(\d+)/i)
        )
          confidence += 0.1;
        return {
          type: "parameter_change",
          details,
          confidence: Math.min(1, confidence),
        };
      }
    }
    const panKeywords = [
      "pan",
      "panning",
      "balance",
      "left",
      "right",
      "center",
      "middle",
    ];
    const panActionKeywords = ["pan", "set", "move", "turn"];
    const hasPanKeyword = panKeywords.some((kw) => lowerInput.includes(kw));
    const hasPanAction = panActionKeywords.some((kw) =>
      lowerInput.includes(kw)
    );
    if (
      hasPanKeyword ||
      (hasPanAction && lowerInput.includes(targetTrack.name.toLowerCase()))
    ) {
      confidence += 0.3;
      const panCommandDetails = this.parsePanCommand(lowerInput, targetTrack);
      if (panCommandDetails) {
        details = panCommandDetails;
        confidence += 0.3;
        if (
          panCommandDetails.action === "set" ||
          panCommandDetails.requestedPanDirection ||
          lowerInput.match(/(?:set|to|is|at)\s*(-?\d+)/i)
        )
          confidence += 0.1;
        return {
          type: "parameter_change",
          details,
          confidence: Math.min(1, confidence),
        };
      }
    }
    return {
      type: "parameter_change",
      details: null,
      confidence: targetTrack ? 0.1 : 0,
    };
  }

  private parseVolumeCommand(
    input: string,
    targetTrack: Track
  ): ParameterChangeCommand | null {
    let action: ParameterAction = "unknown";
    let targetValue = targetTrack.volume;
    const lowerInput = input.toLowerCase();
    let redirectIntent: "mute" | "unmute" | undefined = undefined;
    const muteKeywordsForRedirect = ["mute", "silence", "quiet"];
    const unmuteKeywordsForRedirect = ["unmute", "unsilence", "unquiet"];
    if (
      muteKeywordsForRedirect.some(
        (kw) =>
          lowerInput.includes(kw) &&
          !unmuteKeywordsForRedirect.some((unkw) => lowerInput.includes(unkw))
      )
    ) {
      redirectIntent = "mute";
      return {
        type: "volume",
        trackId: targetTrack.id,
        trackName: targetTrack.name,
        currentValue: targetTrack.volume,
        action: "set",
        targetValue: 0,
        redirectIntent,
      };
    }
    if (unmuteKeywordsForRedirect.some((kw) => lowerInput.includes(kw))) {
      redirectIntent = "unmute";
      return {
        type: "volume",
        trackId: targetTrack.id,
        trackName: targetTrack.name,
        currentValue: targetTrack.volume,
        action: "set",
        targetValue: targetTrack.volume, // Or a default unmute level like 80
        redirectIntent,
      };
    }
    // Enhanced volume regex patterns to match more natural language
    const volumeSetPatterns = [
      /(?:set|change|make|put)?\s*(?:the\s+)?volume\s+(?:to|at|is|=)\s*(\d+)/i,
      /(?:set|change|make|put)\s+(?:the\s+)?volume\s+(?:to|at)\s*(\d+)/i,
      /(?:volume|vol)\s*(\d+)/i,
      /(?:to|is|at|=)\s*(\d+)(?:\s*%)?(?:\s+volume)?/i,
    ];

    let setVolumeValueMatch = null;
    for (const pattern of volumeSetPatterns) {
      const match = lowerInput.match(pattern);
      if (match && match[1]) {
        setVolumeValueMatch = match;
        break;
      }
    }
    if (setVolumeValueMatch && setVolumeValueMatch[1]) {
      action = "set";
      targetValue = parseInt(setVolumeValueMatch[1], 10);
    } else {
      let amount = DEFAULT_RELATIVE_VOLUME_CHANGE_AMOUNT;
      let isRelativeChange = false;
      const extremeModifiers = [
        "hard",
        "all the way",
        "max",
        "full",
        "completely",
      ];
      const hasExtremeModifier = extremeModifiers.some((mod) =>
        lowerInput.includes(mod)
      );
      if (
        hasExtremeModifier &&
        (lowerInput.includes("up") || lowerInput.includes("max"))
      ) {
        action = "set";
        targetValue = 100;
        isRelativeChange = true;
      } else if (
        hasExtremeModifier &&
        (lowerInput.includes("down") || lowerInput.includes("min"))
      ) {
        action = "set";
        targetValue = 0;
        isRelativeChange = true;
      } else {
        const amountMatch = lowerInput.match(/by\s+(\d+)/i);
        if (amountMatch && amountMatch[1])
          amount = parseInt(amountMatch[1], 10);
        else if (
          lowerInput.includes("slightly") ||
          lowerInput.includes("a bit") ||
          lowerInput.includes("a little")
        )
          amount = Math.round(DEFAULT_RELATIVE_VOLUME_CHANGE_AMOUNT / 2);

        // Check for volume increase indicators
        if (
          lowerInput.includes("up") ||
          lowerInput.includes("increase") ||
          lowerInput.includes("raise") ||
          lowerInput.includes("louder") ||
          // Handle case where command starts with "up" (from split commands)
          lowerInput.trim().startsWith("up ")
        ) {
          action = "increase";
          targetValue = targetTrack.volume + amount;
          isRelativeChange = true;
        } else if (
          lowerInput.includes("down") ||
          lowerInput.includes("decrease") ||
          lowerInput.includes("lower") ||
          lowerInput.includes("quieter") ||
          lowerInput.includes("softer") ||
          // Handle case where command starts with "down" (from split commands)
          lowerInput.trim().startsWith("down ")
        ) {
          action = "decrease";
          targetValue = targetTrack.volume - amount;
          isRelativeChange = true;
        }
      }
      if (!isRelativeChange && action === "unknown") return null;
    }
    targetValue = Math.max(0, Math.min(100, targetValue));
    if (action !== "unknown" || targetValue !== targetTrack.volume) {
      return {
        type: "volume",
        trackId: targetTrack.id,
        trackName: targetTrack.name,
        currentValue: targetTrack.volume,
        action,
        targetValue,
        redirectIntent,
      };
    }
    return null;
  }

  private parsePanCommand(
    input: string,
    targetTrack: Track
  ): ParameterChangeCommand | null {
    let action: ParameterAction = "unknown";
    let targetValue = targetTrack.pan;
    let requestedPanDirection: "left" | "right" | "center" | undefined =
      undefined;
    let isExtremePanRequest = false;
    const MODERATE_PAN_AMOUNT = 33;
    const lowerInput = input.toLowerCase();
    const setPanValueMatch = lowerInput.match(/(?:set|to|is|at)\s*(-?\d+)/i);
    if (setPanValueMatch) {
      action = "set";
      targetValue = parseInt(setPanValueMatch[1], 10);
    } else if (lowerInput.includes("center") || lowerInput.includes("middle")) {
      action = "set";
      targetValue = 0;
      requestedPanDirection = "center";
    } else {
      const hasLeft = lowerInput.includes("left");
      const hasRight = lowerInput.includes("right");
      if (hasLeft || hasRight) {
        const extremeModifiers = [
          "hard",
          "all the way",
          "full",
          "extreme",
          "max",
          "completely",
        ];
        isExtremePanRequest = extremeModifiers.some((mod) =>
          lowerInput.includes(mod)
        );
        if (hasLeft) {
          requestedPanDirection = "left";
          targetValue = isExtremePanRequest
            ? -100
            : targetTrack.pan - MODERATE_PAN_AMOUNT;
        } else if (hasRight) {
          requestedPanDirection = "right";
          targetValue = isExtremePanRequest
            ? 100
            : targetTrack.pan + MODERATE_PAN_AMOUNT;
        }
      } else return null;
    }
    targetValue = Math.max(-100, Math.min(100, targetValue));
    if (targetValue === targetTrack.pan && !requestedPanDirection)
      action = "unknown";
    else if (
      setPanValueMatch ||
      requestedPanDirection === "center" ||
      isExtremePanRequest
    )
      action = "set";
    else if (requestedPanDirection)
      action = targetValue < targetTrack.pan ? "decrease" : "increase";
    if (action !== "unknown" || requestedPanDirection) {
      return {
        type: "pan",
        trackId: targetTrack.id,
        trackName: targetTrack.name,
        currentValue: targetTrack.pan,
        action,
        targetValue,
        requestedPanDirection,
        isExtremePanRequest,
      };
    }
    return null;
  }

  findTrackByNameInInput(input: string, tracks: Track[]): Track | null {
    if (!tracks?.length || !input?.trim()) return null;
    const lowerInput = input.toLowerCase();
    let bestMatch: Track | null = null;
    let highestScore = 0;
    for (const track of tracks) {
      const trackNameLower = track.name.toLowerCase();
      let currentScore = 0;
      if (lowerInput.includes(trackNameLower))
        currentScore = 100 + trackNameLower.length;
      const trackWords = trackNameLower
        .split(/\s+/)
        .filter((w) => w.length > 0);
      if (
        trackWords.length > 0 &&
        trackWords.every((word) => lowerInput.includes(word))
      ) {
        const score = 80 + trackWords.length * 5 + trackNameLower.length;
        if (score > currentScore) currentScore = score;
      }
      if (trackWords.length > 0) {
        const significantWords = trackWords.filter((word) => word.length > 2);
        const matchedWords = significantWords.filter((word) =>
          lowerInput.includes(word)
        );
        if (matchedWords.length > 0) {
          const score =
            50 + matchedWords.length * 10 + matchedWords.join("").length;
          if (score > currentScore) currentScore = score;
        }
      }
      if (
        lowerInput.includes(`"${trackNameLower}"`) ||
        lowerInput.includes(`track ${trackNameLower}`) ||
        lowerInput.includes(`${trackNameLower} track`)
      ) {
        const score = 120 + trackNameLower.length;
        if (score > currentScore) currentScore = score;
      }
      if (currentScore > highestScore) {
        highestScore = currentScore;
        bestMatch = track;
      }
    }
    // Handle numbered track patterns like "inst 1", "track 1", "audio 1"
    if (highestScore < 60) {
      const numberedTrackPattern =
        /\b(inst|track|audio|channel|vocal|drum|bass|synth|piano|guitar)\s*(\d+)\b/i;
      const numberedMatch = lowerInput.match(numberedTrackPattern);
      if (numberedMatch) {
        const trackType = numberedMatch[1].toLowerCase();
        const trackNumber = numberedMatch[2];

        // Look for tracks that contain the number
        for (const track of tracks) {
          const trackNameLower = track.name.toLowerCase();
          if (trackNameLower.includes(trackNumber)) {
            // Check if the track type matches or is related
            const typeAliases: Record<string, string[]> = {
              audio: ["audio", "aud", "track", "inst", "instrument"],
              vocal: ["vocal", "voice", "voc", "vocals"],
              drum: ["drum", "drums", "dr", "percussion"],
              bass: ["bass", "bs"],
              guitar: ["guitar", "gtr", "git"],
              piano: ["piano", "pno", "keys", "keyboard"],
              synth: ["synth", "syn", "synthesizer"],
            };

            let typeMatch = false;
            for (const [mainType, aliases] of Object.entries(typeAliases)) {
              if (aliases.includes(trackType)) {
                if (
                  trackNameLower.includes(mainType) ||
                  aliases.some((alias) => trackNameLower.includes(alias))
                ) {
                  typeMatch = true;
                  break;
                }
              }
            }

            // Score based on type match and number match
            const score = typeMatch ? 85 : 70;
            if (score > highestScore) {
              highestScore = score;
              bestMatch = track;
            }
          }
        }
      }

      // Fallback to instrument mappings
      const instrumentMappings: Record<string, string[]> = {
        guitar: ["guitar", "acoustic", "electric", "lead", "rhythm"],
        drums: ["drum", "kick", "snare", "hat", "cymbal", "percussion", "beat"],
        bass: ["bass", "sub"],
        vocals: ["vocal", "voice", "lead vocal", "backing vocal", "singer"],
        piano: ["piano", "keys", "keyboard", "epiano"],
        synth: ["synth", "synthesizer", "pad", "lead synth"],
        strings: ["strings", "violin", "cello", "orchestra"],
      };
      for (const track of tracks) {
        const trackNameLower = track.name.toLowerCase();
        for (const [_instrumentType, keywords] of Object.entries(
          instrumentMappings
        )) {
          if (
            keywords.some((keyword) => lowerInput.includes(keyword)) &&
            keywords.some((kw) => trackNameLower.includes(kw))
          ) {
            const score = 45;
            if (score > highestScore) {
              highestScore = score;
              bestMatch = track;
            }
          }
        }
      }
    }
    return bestMatch;
  }

  recognizePlayPause(input: string): RecognitionAttempt<PlayPauseCommand> {
    const lowerInput = input.toLowerCase().trim();
    let confidence = 0;
    let commandType: CommandType | null = null;
    const playKeywords = ["play", "start", "begin", "resume", "unpause", "go"];
    const pauseKeywords = ["pause", "stop", "halt", "end"];
    const hasWord = (arr: string[]) =>
      arr.some((kw) => new RegExp(`\\b${kw}\\b`).test(lowerInput));
    const isPlay = hasWord(playKeywords);
    const isPause = hasWord(pauseKeywords);
    if (isPlay && !isPause) {
      if (
        lowerInput.includes("measure") ||
        lowerInput.includes("bar") ||
        lowerInput.includes("beat") ||
        lowerInput.includes("beginning") ||
        lowerInput.includes("from") ||
        lowerInput.includes("at") ||
        lowerInput.includes("to")
      )
        confidence = 0.1; // Lower confidence if it looks like a playhead command
      else confidence = 0.8;
      commandType = "play";
    }
    if (isPause && !isPlay) {
      confidence = 0.8;
      commandType = "pause";
    }
    if (isPlay && isPause) {
      // e.g. "play pause" - ambiguous
      confidence = 0;
      commandType = null;
    }
    if (commandType) return { type: commandType, details: {}, confidence };
    return { type: "unknown", details: null, confidence: 0 };
  }

  recognizeStartLoopingCommand(
    input: string
  ): RecognitionAttempt<{ shouldPlay: boolean; message?: string }> {
    let confidence = 0;
    let details: { shouldPlay: boolean; message?: string } | null = null;
    if (!input?.trim()) return { type: "start_looping", details, confidence };
    const lowerInput = input.toLowerCase();

    // Specific patterns for "start looping" that should trigger both loop and play
    const startLoopingPatterns = [
      /\b(start|begin)\s+(loop|looping|cycle)\b/i,
      /\b(start|begin)\s+to\s+(loop|looping|cycle)\b/i,
      /\b(start|begin)\s+(loop|looping|cycle)\s+measures?\b/i, // "start looping measures X to Y"
    ];

    for (const pattern of startLoopingPatterns) {
      if (pattern.test(lowerInput)) {
        details = {
          shouldPlay: true,
          message: "Loop enabled and playback started.",
        };
        confidence = 0.9;
        break;
      }
    }

    return {
      type: "start_looping",
      details,
      confidence: details ? Math.min(1, confidence) : 0,
    };
  }

  recognizeLoopToggleCommand(
    input: string
  ): RecognitionAttempt<LoopToggleCommand> {
    let confidence = 0;
    let details: LoopToggleCommand | null = null;
    if (!input?.trim()) return { type: "loop_toggle", details, confidence };
    const lowerInput = input.toLowerCase();
    const loopKeywords = ["loop", "cycle", "repeat", "looping"];
    const onKeywords = ["on", "enable", "activate", "start", "engage"];
    const offKeywords = [
      "off",
      "disable",
      "deactivate",
      "stop",
      "disengage",
      "turn off",
    ];
    const toggleKeywords = ["toggle", "switch"];
    const hasLoopKeyword = loopKeywords.some((kw) => lowerInput.includes(kw));
    if (hasLoopKeyword) {
      confidence = 0.5;
      if (onKeywords.some((kw) => lowerInput.includes(kw))) {
        details = { intent: "on" };
        confidence += 0.4;
      } else if (offKeywords.some((kw) => lowerInput.includes(kw))) {
        details = { intent: "off" };
        confidence += 0.4;
      } else if (toggleKeywords.some((kw) => lowerInput.includes(kw))) {
        details = { intent: "toggle" };
        confidence += 0.3;
      } else {
        // If only "loop" is mentioned, assume toggle
        details = { intent: "toggle" };
        confidence += 0.1; // Lower confidence for implicit toggle
      }
    }
    return {
      type: "loop_toggle",
      details,
      confidence: details ? Math.min(1, confidence) : 0,
    };
  }

  recognizeLoopRangeCommand(
    input: string
  ): RecognitionAttempt<LoopRangeCommand> {
    let confidence = 0;
    let details: LoopRangeCommand | null = null;
    if (!input?.trim()) return { type: "loop_range", details, confidence };
    const lowerInput = input.toLowerCase();
    const loopKeywords = ["loop", "cycle", "repeat"];
    const measureKeywords = ["measure", "measures", "bar", "bars"];
    const hasLoopKeyword = loopKeywords.some((kw) => lowerInput.includes(kw));
    const hasMeasureContext = measureKeywords.some((kw) =>
      lowerInput.includes(kw)
    );

    // Check for time-based loops first (e.g., "loop from 0:15 to 1:30", "set loop 0:15-30")
    const timeRangePatterns = [
      /(?:loop|cycle|repeat)?\s*(?:from)?\s*(\d+:\d{1,2}|\d+)\s*(?:to|-|through)\s*(\d+:\d{1,2}|\d+)/i,
      /(?:set|create)?\s*(?:loop|cycle|repeat)\s+(\d+:\d{1,2}|\d+)\s*(?:to|-|through)\s*(\d+:\d{1,2}|\d+)/i,
    ];

    for (const pattern of timeRangePatterns) {
      const timeMatch = lowerInput.match(pattern);
      if (timeMatch && timeMatch[1] && timeMatch[2]) {
        const startTime = parseTimeToSeconds(timeMatch[1]);
        const endTime = parseTimeToSeconds(timeMatch[2]);

        if (
          startTime !== null &&
          endTime !== null &&
          startTime < endTime &&
          endTime <= 600
        ) {
          // Max 10 minutes
          details = {
            startTimeSeconds: startTime,
            endTimeSeconds: endTime,
            isTimeBased: true,
          };
          confidence = 0.8;
          return {
            type: "loop_range",
            details,
            confidence: Math.min(1, confidence),
          };
        }
      }
    }

    // Fall back to measure-based loops
    if (hasLoopKeyword && hasMeasureContext) {
      confidence = 0.6;
      const rangePattern =
        /(?:measures?|bars?|measure|bar)\s+([\w\d\.]+)\s*(?:to|-|through|and)\s*(?:measures?|bars?|measure|bar)?\s*([\w\d\.]+)/i;
      const match = lowerInput.match(rangePattern);
      if (match && match[1] && match[2]) {
        const startNum = parseNumericInput(match[1]);
        const endNum = parseNumericInput(match[2]);
        if (
          startNum !== null &&
          endNum !== null &&
          startNum > 0 &&
          endNum >= startNum &&
          endNum <= TOTAL_PROJECT_MEASURES
        ) {
          details = {
            startMeasure: Math.floor(startNum),
            endMeasure: Math.floor(endNum),
            isTimeBased: false,
          };
          confidence += 0.35;
        } else confidence -= 0.2; // Penalize if numbers are invalid
      } else {
        // Check for single measure loop e.g. "loop measure 3"
        const singleMeasurePattern =
          /(?:measures?|bars?|measure|bar)\s+([\w\d\.]+)/i;
        const singleMatch = lowerInput.match(singleMeasurePattern);
        if (singleMatch && singleMatch[1]) {
          const measureNum = parseNumericInput(singleMatch[1]);
          if (
            measureNum !== null &&
            measureNum > 0 &&
            measureNum <= TOTAL_PROJECT_MEASURES
          ) {
            details = {
              startMeasure: Math.floor(measureNum),
              endMeasure: Math.floor(measureNum),
              isTimeBased: false,
            };
            confidence += 0.25;
          } else confidence -= 0.2;
        }
      }
    }
    return {
      type: "loop_range",
      details,
      confidence: details ? Math.min(1, confidence) : 0,
    };
  }

  recognizeMuteTrackCommand(
    input: string,
    tracks: Track[]
  ): RecognitionAttempt<MuteActionDetails> {
    let confidence = 0;
    let details: MuteActionDetails | null = null;
    if (!input?.trim() || !tracks?.length)
      return { type: "mute_track", details, confidence };
    const lowerInput = input.toLowerCase();
    const muteKeywords = ["mute", "silence", "quiet"];
    const unmuteKeywords = ["unmute", "unsilence", "unquiet", "sound on"];
    const toggleKeywords = ["toggle mute", "toggle silence"];
    const targetTrack = this.findTrackByNameInInput(lowerInput, tracks);
    if (!targetTrack) return { type: "mute_track", details, confidence };
    confidence = 0.4; // Base confidence if a track is found
    let intent: "mute" | "unmute" | "toggle" = "toggle";
    let intentConfidenceBoost = 0;
    if (unmuteKeywords.some((kw) => lowerInput.includes(kw))) {
      intent = "unmute";
      intentConfidenceBoost = 0.5;
    } else if (muteKeywords.some((kw) => lowerInput.includes(kw))) {
      intent = "mute";
      intentConfidenceBoost = 0.5;
    } else if (toggleKeywords.some((kw) => lowerInput.includes(kw))) {
      intent = "toggle";
      intentConfidenceBoost = 0.4;
    } else if (lowerInput.includes(targetTrack.name.toLowerCase())) {
      // If track name is present but no explicit mute/unmute keyword, assume toggle
      intentConfidenceBoost = 0.05; // Small boost for just mentioning track name
    }
    confidence += intentConfidenceBoost;
    if (confidence >= MINIMUM_COMMAND_CONFIDENCE_THRESHOLD - 0.1)
      details = {
        trackId: targetTrack.id,
        trackName: targetTrack.name,
        intent,
      };
    return {
      type: "mute_track",
      details,
      confidence: details ? Math.min(1, confidence) : 0,
    };
  }

  recognizeSoloTrackCommand(
    input: string,
    tracks: Track[]
  ): RecognitionAttempt<SoloActionDetails> {
    let confidence = 0;
    let details: SoloActionDetails | null = null;
    if (!input?.trim() || !tracks?.length)
      return { type: "solo_track", details, confidence };
    const lowerInput = input.toLowerCase();
    const soloKeywords = ["solo", "isolate"];
    const unsoloKeywords = ["unsolo", "unisolate", "solo off"];
    const toggleKeywords = ["toggle solo", "toggle isolate"];
    const targetTrack = this.findTrackByNameInInput(lowerInput, tracks);
    if (!targetTrack) return { type: "solo_track", details, confidence };
    confidence = 0.4;
    let intent: "solo" | "unsolo" | "toggle" = "toggle";
    let intentConfidenceBoost = 0;
    if (unsoloKeywords.some((kw) => lowerInput.includes(kw))) {
      intent = "unsolo";
      intentConfidenceBoost = 0.5;
    } else if (soloKeywords.some((kw) => lowerInput.includes(kw))) {
      intent = "solo";
      intentConfidenceBoost = 0.5;
    } else if (toggleKeywords.some((kw) => lowerInput.includes(kw))) {
      intent = "toggle";
      intentConfidenceBoost = 0.4;
    } else if (lowerInput.includes(targetTrack.name.toLowerCase()))
      intentConfidenceBoost = 0.05;
    confidence += intentConfidenceBoost;
    if (confidence >= MINIMUM_COMMAND_CONFIDENCE_THRESHOLD - 0.1)
      details = {
        trackId: targetTrack.id,
        trackName: targetTrack.name,
        intent,
      };
    return {
      type: "solo_track",
      details,
      confidence: details ? Math.min(1, confidence) : 0,
    };
  }

  recognizeZoomCommand(input: string): RecognitionAttempt<ZoomCommand> {
    let confidence = 0;
    let details: ZoomCommand | null = null;
    if (!input?.trim()) return { type: "zoom", details, confidence };
    const lowerInput = input.toLowerCase();
    const zoomKeywords = [
      "zoom",
      "show",
      "see",
      "view",
      "fit",
      "display",
      "focus on",
    ];
    const measureKeywords = ["measure", "measures", "bar", "bars"];
    const hasZoomKeyword = zoomKeywords.some((kw) => lowerInput.includes(kw));
    const hasMeasureContext = measureKeywords.some((kw) =>
      lowerInput.includes(kw)
    );
    if (!hasZoomKeyword && !hasMeasureContext)
      return { type: "zoom", details, confidence };
    confidence = 0.3;
    const fitProjectPatterns = [
      /fit project/i,
      /show all/i,
      /view entire/i,
      /zoom out completely/i,
      /see everything/i,
      /whole project/i,
    ];
    if (fitProjectPatterns.some((p) => p.test(lowerInput))) {
      details = { action: "fit_project" };
      confidence += 0.6;
      return { type: "zoom", details, confidence: Math.min(1, confidence) };
    }
    const rangePattern =
      /(?:measures?|bars?|measure|bar)\s+([\w\d\.]+)\s*(?:to|-|through|and)\s*(?:measures?|bars?|measure|bar)?\s*([\w\d\.]+)/i;
    const rangeMatch = lowerInput.match(rangePattern);
    if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
      const startNum = parseNumericInput(rangeMatch[1]);
      const endNum = parseNumericInput(rangeMatch[2]);
      if (
        startNum !== null &&
        endNum !== null &&
        startNum > 0 &&
        endNum >= startNum &&
        endNum <= TOTAL_PROJECT_MEASURES
      ) {
        details = {
          action: "fit_measures",
          startMeasure: Math.floor(startNum),
          endMeasure: Math.floor(endNum),
        };
        confidence += 0.55;
        return { type: "zoom", details, confidence: Math.min(1, confidence) };
      }
    }
    const singleMeasurePattern =
      /(?:show|see|view|focus on|zoom to)\s+(?:measures?|bars?|measure|bar)\s+([\w\d\.]+)/i;
    const singleMatch = lowerInput.match(singleMeasurePattern);
    if (singleMatch && singleMatch[1]) {
      const measureNum = parseNumericInput(singleMatch[1]);
      if (
        measureNum !== null &&
        measureNum > 0 &&
        measureNum <= TOTAL_PROJECT_MEASURES
      ) {
        details = {
          action: "fit_measures",
          startMeasure: Math.floor(measureNum),
          endMeasure: Math.floor(measureNum),
        };
        confidence += 0.5;
        return { type: "zoom", details, confidence: Math.min(1, confidence) };
      }
    }
    let zoomAction: "in" | "out" | undefined = undefined;
    if (lowerInput.includes("zoom in") || lowerInput.includes("closer")) {
      zoomAction = "in";
      confidence += 0.3;
    } else if (
      lowerInput.includes("zoom out") ||
      lowerInput.includes("further")
    ) {
      zoomAction = "out";
      confidence += 0.3;
    }
    if (zoomAction) {
      let intensity: ZoomCommand["intensity"] = "moderate";
      if (
        lowerInput.includes("a bit") ||
        lowerInput.includes("slightly") ||
        lowerInput.includes("a little")
      ) {
        intensity = "slight";
        confidence += 0.1;
      } else if (
        lowerInput.includes("a lot") ||
        lowerInput.includes("way") ||
        lowerInput.includes("much") ||
        lowerInput.includes("maximum") ||
        lowerInput.includes("fully") ||
        lowerInput.includes("max")
      ) {
        intensity = "maximum";
        confidence += 0.2;
      }
      details = { action: zoomAction, intensity };
      return { type: "zoom", details, confidence: Math.min(1, confidence) };
    }
    if (hasZoomKeyword && confidence <= 0.3)
      // Low confidence if only generic zoom keyword
      return { type: "zoom", details: null, confidence: 0.1 };
    return { type: "zoom", details, confidence };
  }

  recognizePlayheadPositionCommand(
    input: string
  ): RecognitionAttempt<PlayheadPositionCommand> {
    const lowerInput = input.toLowerCase().trim();
    let confidence = 0;
    let details: PlayheadPositionCommand | null = null;
    if (!input) return { type: "playhead_position", details, confidence };
    const playKeywords = [
      "play from",
      "play at",
      "play starting",
      "start playback from",
      "start playback at",
      "begin from",
      "begin at",
      "play", // Keep "play" here, but it will be disambiguated later
      "start",
      "begin",
    ];
    const goToKeywords = [
      "go back to",
      "jump back to",
      "return to",
      "back to",
      "go to",
      "jump to",
      "move to",
      "set playhead to",
      "set cursor to",
      "position at",
      "navigate to",
    ];
    let shouldPlay = false;
    let actionKeywordUsed = "";
    let remainingInput = lowerInput;
    // Check for play keywords first
    for (const kw of playKeywords) {
      if (lowerInput.startsWith(kw + " ") || lowerInput === kw) {
        // Exclude simple "play" or "play music" if it's not followed by location
        if (
          (kw === "play" &&
            (lowerInput === "play" || lowerInput === "play music")) ||
          (kw === "start" &&
            (lowerInput === "start" || lowerInput === "start music")) ||
          (kw === "begin" &&
            (lowerInput === "begin" || lowerInput === "begin music"))
        ) {
          // This is likely a simple play command, not playhead positioning.
          // Let recognizePlayPause handle it with higher confidence.
          // We might still parse a location if present, but confidence will be lower.
        } else {
          shouldPlay = true;
        }
        actionKeywordUsed = kw;
        remainingInput = lowerInput.substring(kw.length).trim();
        confidence += 0.3; // Base confidence for keyword
        break;
      }
    }
    // If no play keyword, check for go-to keywords
    if (!actionKeywordUsed) {
      for (const kw of goToKeywords) {
        if (lowerInput.startsWith(kw + " ")) {
          shouldPlay = false; // Go to typically doesn't imply immediate playback unless specified
          actionKeywordUsed = kw;
          remainingInput = lowerInput.substring(kw.length).trim();
          confidence += 0.3;
          break;
        }
      }
    }

    // Relative measure movement: "forward 2 measures", "back one bar"
    const relativeMeasureMatch = lowerInput.match(
      /(?:(forward|back|backward|next|previous))(?!\s+to\b)\s+([\w\d\s\.]+)?\s*(measures?|bars?|measure|bar)/i
    );
    if (relativeMeasureMatch) {
      const directionWord = relativeMeasureMatch[1];
      const amountStr = relativeMeasureMatch[2] || "1"; // Default to 1 if no number
      const amount = parseNumericInput(amountStr);
      if (amount !== null && amount > 0) {
        details = {
          positionType: "relative_measure",
          relativeAmount: amount,
          isForward: directionWord === "forward" || directionWord === "next",
          shouldPlay: false, // Default for relative move, can be overridden
          originalInput: `${directionWord} ${amountStr} ${relativeMeasureMatch[3]}`,
        };
        confidence = 0.85; // High confidence for this specific pattern
        // If original input started with a play keyword and it's "next/previous measure"
        if (
          playKeywords.some((pk) => lowerInput.startsWith(pk)) &&
          (directionWord === "next" || directionWord === "previous")
        ) {
          details.shouldPlay = true;
          confidence += 0.1;
        }
        return {
          type: "playhead_position",
          details,
          confidence: Math.min(1, confidence),
        };
      }
    }

    // To the beginning: "go to the beginning", "start at the top"
    const beginningMatch = remainingInput.match(
      /^(?:the )?(beginning|start|top)$/i
    );
    if (beginningMatch) {
      details = {
        positionType: "beginning",
        shouldPlay: shouldPlay, // Inherit from actionKeyword or default
        originalInput: beginningMatch[0].trim(),
      };
      confidence += 0.6; // High confidence for "beginning"
      if (actionKeywordUsed) confidence += 0.1;
      // If "play/start/begin" was the primary keyword and then "beginning"
      else if (playKeywords.some((kw) => lowerInput.includes(kw))) {
        details.shouldPlay = true;
        confidence += 0.15;
      }
      return {
        type: "playhead_position",
        details,
        confidence: Math.min(1, confidence),
      };
    }

    // Specific measure: "measure 3", "bar 5.5"
    // Adjusted regex to be more flexible with preceding keywords
    const measureMatch = remainingInput.match(
      /^(?:from |at |go to |jump to |move to |navigate to |go back to |jump back to |return to |back to |play from |play at )?(?:measure|bar)\s+([\w\d\s\.]+)/i
    );
    if (measureMatch && measureMatch[1]) {
      const measureStr = measureMatch[1].replace(/\s+/g, " "); // Normalize spaces if any
      const measureNum = parseNumericInput(measureStr);
      if (
        measureNum !== null &&
        measureNum >= 0 && // Allow measure 0 if it means start of measure 1 conceptually
        measureNum <= TOTAL_PROJECT_MEASURES + 0.9999 // Allow fractional for within last measure
      ) {
        details = {
          positionType: "measure",
          targetMeasure: measureNum,
          shouldPlay: shouldPlay,
          originalInput: `measure ${measureStr}`,
        };
        confidence += 0.55;
        if (actionKeywordUsed) confidence += 0.15;
        else if (playKeywords.some((kw) => lowerInput.includes(kw))) {
          details.shouldPlay = true;
          confidence += 0.1;
        }
        return {
          type: "playhead_position",
          details,
          confidence: Math.min(1, confidence),
        };
      }
    }

    // Specific beat: "beat 16", "to beat 32"
    const beatMatch = remainingInput.match(
      /^(?:from |at )?beat\s+([\w\d\s\.]+)/i
    );
    if (beatMatch && beatMatch[1]) {
      const beatStr = beatMatch[1];
      const beatNum = parseNumericInput(beatStr);
      const reasonableMaxBeats = TOTAL_PROJECT_MEASURES * 8; // Assuming max 8 beats per measure for safety
      if (beatNum !== null && beatNum >= 0 && beatNum <= reasonableMaxBeats) {
        details = {
          positionType: "absolute_beat",
          targetAbsoluteBeat: beatNum,
          shouldPlay: shouldPlay,
          originalInput: `beat ${beatStr}`,
        };
        confidence += 0.5;
        if (actionKeywordUsed) confidence += 0.15;
        else if (playKeywords.some((kw) => lowerInput.includes(kw))) {
          details.shouldPlay = true;
          confidence += 0.1;
        }
        return {
          type: "playhead_position",
          details,
          confidence: Math.min(1, confidence),
        };
      }
    }

    // If an action keyword was used but no specific location matched, reduce confidence
    if (actionKeywordUsed && !details) {
      confidence = Math.max(0, confidence - 0.2); // Penalize if action keyword but no location
    }

    return { type: "playhead_position", details, confidence };
  }

  recognizeRecordArmCommand(
    input: string,
    tracks: Track[]
  ): RecognitionAttempt<RecordArmCommand> {
    let confidence = 0;
    let details: RecordArmCommand | null = null;
    const lowerInput = input.toLowerCase();

    // Record arm patterns
    const armPatterns = [
      /(?:arm|enable|turn on|start)\s+(?:record|recording)\s+(?:for|on)\s+(.+)/i,
      /(?:record|recording)\s+arm\s+(.+)/i,
      /arm\s+(.+)\s+(?:for|to)\s+(?:record|recording)/i,
      /(.+)\s+(?:record|recording)\s+(?:arm|enable|on)/i,
    ];

    const disarmPatterns = [
      /(?:disarm|disable|turn off|stop)\s+(?:record|recording)\s+(?:for|on)\s+(.+)/i,
      /(?:record|recording)\s+disarm\s+(.+)/i,
      /disarm\s+(.+)\s+(?:from|for)\s+(?:record|recording)/i,
      /(.+)\s+(?:record|recording)\s+(?:disarm|disable|off)/i,
    ];

    const togglePatterns = [
      /toggle\s+(?:record|recording)\s+(?:arm|enable)\s+(?:for|on)\s+(.+)/i,
      /toggle\s+(.+)\s+(?:record|recording)\s+(?:arm|enable)/i,
    ];

    let intent: "arm" | "disarm" | "toggle" = "toggle";
    let trackName = "";

    // Check arm patterns
    for (const pattern of armPatterns) {
      const match = lowerInput.match(pattern);
      if (match && match[1]) {
        intent = "arm";
        trackName = match[1].trim();
        confidence = 0.85;
        break;
      }
    }

    // Check disarm patterns
    if (confidence === 0) {
      for (const pattern of disarmPatterns) {
        const match = lowerInput.match(pattern);
        if (match && match[1]) {
          intent = "disarm";
          trackName = match[1].trim();
          confidence = 0.85;
          break;
        }
      }
    }

    // Check toggle patterns
    if (confidence === 0) {
      for (const pattern of togglePatterns) {
        const match = lowerInput.match(pattern);
        if (match && match[1]) {
          intent = "toggle";
          trackName = match[1].trim();
          confidence = 0.8;
          break;
        }
      }
    }

    // Find the track
    if (confidence > 0 && trackName) {
      const track = this.findTrackByNameInInput(trackName, tracks);
      if (
        track &&
        (track.type === TrackType.AUDIO ||
          track.type === TrackType.SOFTWARE_INSTRUMENT)
      ) {
        details = {
          trackId: track.id,
          trackName: track.name,
          intent,
        };
      } else {
        confidence = 0; // No matching track found
      }
    }

    return { type: "record_arm", details, confidence };
  }

  recognizeInputMonitoringCommand(
    input: string,
    tracks: Track[]
  ): RecognitionAttempt<InputMonitoringCommand> {
    let confidence = 0;
    let details: InputMonitoringCommand | null = null;
    const lowerInput = input.toLowerCase();

    // Input monitoring patterns
    const enablePatterns = [
      /(?:enable|turn on|start)\s+(?:input\s+)?monitor(?:ing)?\s+(?:for|on)\s+(.+)/i,
      /(?:input\s+)?monitor(?:ing)?\s+(?:enable|on)\s+(.+)/i,
      /(.+)\s+(?:input\s+)?monitor(?:ing)?\s+(?:enable|on)/i,
    ];

    const disablePatterns = [
      /(?:disable|turn off|stop)\s+(?:input\s+)?monitor(?:ing)?\s+(?:for|on)\s+(.+)/i,
      /(?:input\s+)?monitor(?:ing)?\s+(?:disable|off)\s+(.+)/i,
      /(.+)\s+(?:input\s+)?monitor(?:ing)?\s+(?:disable|off)/i,
    ];

    const togglePatterns = [
      /toggle\s+(?:input\s+)?monitor(?:ing)?\s+(?:for|on)\s+(.+)/i,
      /toggle\s+(.+)\s+(?:input\s+)?monitor(?:ing)?/i,
    ];

    let intent: "enable" | "disable" | "toggle" = "toggle";
    let trackName = "";

    // Check enable patterns
    for (const pattern of enablePatterns) {
      const match = lowerInput.match(pattern);
      if (match && match[1]) {
        intent = "enable";
        trackName = match[1].trim();
        confidence = 0.85;
        break;
      }
    }

    // Check disable patterns
    if (confidence === 0) {
      for (const pattern of disablePatterns) {
        const match = lowerInput.match(pattern);
        if (match && match[1]) {
          intent = "disable";
          trackName = match[1].trim();
          confidence = 0.85;
          break;
        }
      }
    }

    // Check toggle patterns
    if (confidence === 0) {
      for (const pattern of togglePatterns) {
        const match = lowerInput.match(pattern);
        if (match && match[1]) {
          intent = "toggle";
          trackName = match[1].trim();
          confidence = 0.8;
          break;
        }
      }
    }

    // Find the track (only audio tracks support input monitoring)
    if (confidence > 0 && trackName) {
      const track = this.findTrackByNameInInput(trackName, tracks);
      if (track && track.type === TrackType.AUDIO) {
        details = {
          trackId: track.id,
          trackName: track.name,
          intent,
        };
      } else {
        confidence = 0; // No matching audio track found
      }
    }

    return { type: "input_monitoring", details, confidence };
  }

  recognizeRecordingCommand(
    input: string,
    tracks: Track[]
  ): RecognitionAttempt<RecordingCommand> {
    let confidence = 0;
    let details: RecordingCommand | null = null;
    const lowerInput = input.toLowerCase();

    // Recording patterns
    const startPatterns = [
      /^(?:start|begin)\s+(?:record|recording)$/i,
      /^(?:record|recording)\s+(?:start|begin)$/i,
      /^(?:start|begin)\s+(?:record|recording)\s+(?:on|to)\s+(.+)/i,
      /^(?:record|recording)\s+(.+)$/i,
    ];

    const stopPatterns = [
      /^(?:stop|end|finish)\s+(?:record|recording)$/i,
      /^(?:record|recording)\s+(?:stop|end|finish)$/i,
    ];

    let action: "start" | "stop" = "start";
    let trackName = "";

    // Check start patterns
    for (const pattern of startPatterns) {
      const match = lowerInput.match(pattern);
      if (match) {
        action = "start";
        trackName = match[1] ? match[1].trim() : "";
        confidence = 0.9;
        break;
      }
    }

    // Check stop patterns
    if (confidence === 0) {
      for (const pattern of stopPatterns) {
        const match = lowerInput.match(pattern);
        if (match) {
          action = "stop";
          confidence = 0.9;
          break;
        }
      }
    }

    if (confidence > 0) {
      details = { action };

      // If a track name was specified, find it
      if (trackName) {
        const track = this.findTrackByNameInInput(trackName, tracks);
        if (
          track &&
          (track.type === TrackType.AUDIO ||
            track.type === TrackType.SOFTWARE_INSTRUMENT)
        ) {
          details.trackId = track.id;
          details.trackName = track.name;
        }
      }
    }

    return {
      type: details?.action === "start" ? "start_recording" : "stop_recording",
      details,
      confidence,
    };
  }

  recognizeUndoRedoCommand(input: string): RecognitionAttempt<UndoRedoCommand> {
    let confidence = 0;
    let details: UndoRedoCommand | null = null;
    const lowerInput = input.toLowerCase();

    // Undo patterns
    const undoPatterns = [
      /^undo$/i,
      /^undo\s+(?:last|that|previous)$/i,
      /^(?:go|step)\s+back$/i,
      /^revert$/i,
    ];

    // Redo patterns
    const redoPatterns = [
      /^redo$/i,
      /^redo\s+(?:last|that)$/i,
      /^(?:go|step)\s+forward$/i,
      /^repeat$/i,
    ];

    // Check undo patterns
    for (const pattern of undoPatterns) {
      if (pattern.test(lowerInput)) {
        details = { action: "undo" };
        confidence = 0.95;
        break;
      }
    }

    // Check redo patterns
    if (confidence === 0) {
      for (const pattern of redoPatterns) {
        if (pattern.test(lowerInput)) {
          details = { action: "redo" };
          confidence = 0.95;
          break;
        }
      }
    }

    return {
      type: details?.action === "undo" ? "undo" : "redo",
      details,
      confidence,
    };
  }

  recognizeTrackManagementCommand(
    input: string,
    tracks: Track[]
  ): RecognitionAttempt<TrackManagementCommand> {
    let confidence = 0;
    let details: TrackManagementCommand | null = null;
    const lowerInput = input.toLowerCase();

    // Delete all patterns (check these first)
    const deleteAllPatterns = [
      /^(?:delete|remove)\s+(?:all|everything)(?:\s+tracks?)?$/i,
      /^(?:delete|remove)\s+all\s+(?:tracks?|files?)$/i,
      /^(?:clear|wipe)\s+(?:all|everything)(?:\s+tracks?)?$/i,
      /^(?:delete|remove)\s+everything$/i,
      /^(?:clear|wipe)\s+all\s+tracks?$/i,
    ];

    // Delete patterns
    const deletePatterns = [
      /^(?:delete|remove)\s+(?:track\s+)?(.+)/i,
      /^(.+)\s+(?:delete|remove)$/i,
    ];

    // Select patterns
    const selectPatterns = [
      /^(?:select|choose)\s+(?:track\s+)?(.+)/i,
      /^(.+)\s+(?:select|choose)$/i,
    ];

    // Clear selection patterns (more specific to avoid collision)
    const clearPatterns = [
      /^(?:clear|deselect)\s+(?:selection|current\s+selection)$/i,
      /^(?:deselect|unselect)\s+(?:all|everything)$/i,
      /^(?:clear|deselect)\s+tracks?\s+selection$/i,
      /^clear\s+selection$/i,
    ];

    // Select all patterns
    const selectAllPatterns = [
      /^(?:select|choose)\s+(?:all|everything)$/i,
      /^(?:select|choose)\s+all\s+tracks$/i,
    ];

    // Track positioning patterns
    const moveToTopPatterns = [
      /^(?:bring|move)\s+(.+)\s+(?:to\s+the\s+)?top$/i,
      /^(?:bring|move)\s+(.+)\s+(?:to\s+)?(?:position\s+)?(?:1|one|first)$/i,
      /^(.+)\s+(?:to\s+the\s+)?top$/i,
      /^top\s+(.+)$/i,
    ];

    const moveToBottomPatterns = [
      /^(?:bring|move)\s+(.+)\s+(?:to\s+the\s+)?bottom$/i,
      /^(?:bring|move)\s+(.+)\s+(?:to\s+)?(?:position\s+)?last$/i,
      /^(.+)\s+(?:to\s+the\s+)?bottom$/i,
      /^bottom\s+(.+)$/i,
    ];

    const moveToPositionPatterns = [
      /^(?:bring|move)\s+(.+)\s+(?:to\s+)?(?:position\s+)?(\d+)$/i,
      /^(?:move|put)\s+(.+)\s+(?:at\s+)?(?:position\s+)?(\d+)$/i,
      /^(.+)\s+(?:to\s+)?(?:position\s+)?(\d+)$/i,
    ];

    // Range deletion patterns (check these before single track patterns)
    const rangeDeletePatterns = [
      /^(?:delete|remove)\s+tracks?\s+(\d+)(?:\s*-\s*|\s+to\s+|\s+through\s+)(\d+)$/i,
      /^(?:delete|remove)\s+tracks?\s+(\d+)\s*-\s*(\d+)$/i,
      /^(?:delete|remove)\s+(\d+)(?:\s*-\s*|\s+to\s+|\s+through\s+)(\d+)(?:\s+tracks?)?$/i,
      /^tracks?\s+(\d+)(?:\s*-\s*|\s+to\s+|\s+through\s+)(\d+)\s+(?:delete|remove)$/i,
    ];

    let action:
      | "delete"
      | "select"
      | "clear_selection"
      | "select_all"
      | "delete_all"
      | "delete_range"
      | "move_to_top"
      | "move_to_bottom"
      | "move_to_position" = "select";
    let trackName = "";
    let startIndex = 0;
    let endIndex = 0;
    let targetPosition = 0;

    // Check delete all patterns first
    for (const pattern of deleteAllPatterns) {
      if (pattern.test(lowerInput)) {
        action = "delete_all";
        confidence = 0.95;
        break;
      }
    }

    // Check move to top patterns
    if (confidence === 0) {
      for (const pattern of moveToTopPatterns) {
        const match = lowerInput.match(pattern);
        if (match && match[1]) {
          action = "move_to_top";
          trackName = match[1].trim();
          confidence = 0.9;
          break;
        }
      }
    }

    // Check move to bottom patterns
    if (confidence === 0) {
      for (const pattern of moveToBottomPatterns) {
        const match = lowerInput.match(pattern);
        if (match && match[1]) {
          action = "move_to_bottom";
          trackName = match[1].trim();
          confidence = 0.9;
          break;
        }
      }
    }

    // Check move to position patterns
    if (confidence === 0) {
      for (const pattern of moveToPositionPatterns) {
        const match = lowerInput.match(pattern);
        if (match && match[1] && match[2]) {
          const position = parseInt(match[2]);
          if (position > 0 && position <= tracks.length) {
            action = "move_to_position";
            trackName = match[1].trim();
            targetPosition = position;
            confidence = 0.9;
            break;
          }
        }
      }
    }

    // Check range deletion patterns
    if (confidence === 0) {
      for (const pattern of rangeDeletePatterns) {
        const match = lowerInput.match(pattern);
        if (match && match[1] && match[2]) {
          const start = parseInt(match[1]);
          const end = parseInt(match[2]);

          if (start > 0 && end > 0 && start <= end && end <= tracks.length) {
            action = "delete_range";
            startIndex = start;
            endIndex = end;
            confidence = 0.9;
            break;
          }
        }
      }
    }

    // Check clear selection patterns
    if (confidence === 0) {
      for (const pattern of clearPatterns) {
        if (pattern.test(lowerInput)) {
          action = "clear_selection";
          confidence = 0.9;
          break;
        }
      }
    }

    // Check select all patterns
    if (confidence === 0) {
      for (const pattern of selectAllPatterns) {
        if (pattern.test(lowerInput)) {
          action = "select_all";
          confidence = 0.9;
          break;
        }
      }
    }

    // Check delete patterns
    if (confidence === 0) {
      for (const pattern of deletePatterns) {
        const match = lowerInput.match(pattern);
        if (match && match[1]) {
          action = "delete";
          trackName = match[1].trim();
          confidence = 0.85;
          break;
        }
      }
    }

    // Check select patterns
    if (confidence === 0) {
      for (const pattern of selectPatterns) {
        const match = lowerInput.match(pattern);
        if (match && match[1]) {
          action = "select";
          trackName = match[1].trim();
          confidence = 0.8;
          break;
        }
      }
    }

    if (confidence > 0) {
      details = { action };

      // If a track name was specified, find it
      if (
        trackName &&
        (action === "delete" ||
          action === "select" ||
          action === "move_to_top" ||
          action === "move_to_bottom" ||
          action === "move_to_position")
      ) {
        const track = this.findTrackByNameInInput(trackName, tracks);
        if (track) {
          details.trackId = track.id;
          details.trackName = track.name;
        } else {
          confidence = 0; // No matching track found
        }
      }

      // If range deletion, add range info
      if (action === "delete_range") {
        details.startIndex = startIndex;
        details.endIndex = endIndex;
      }

      // If move to position, add target position
      if (action === "move_to_position") {
        details.targetPosition = targetPosition;
      }
    }

    const commandType =
      details?.action === "delete"
        ? "delete_track"
        : details?.action === "delete_all"
        ? "delete_all_tracks"
        : details?.action === "delete_range"
        ? "delete_range_tracks"
        : details?.action === "move_to_top"
        ? "move_track_to_top"
        : details?.action === "move_to_bottom"
        ? "move_track_to_bottom"
        : details?.action === "move_to_position"
        ? "move_track_to_position"
        : details?.action === "select"
        ? "select_track"
        : details?.action === "clear_selection"
        ? "clear_selection"
        : "select_all_tracks";
    return { type: commandType, details, confidence };
  }

  recognizeAdvancedNavigationCommand(
    input: string
  ): RecognitionAttempt<AdvancedNavigationCommand> {
    let confidence = 0;
    let details: AdvancedNavigationCommand | null = null;
    const lowerInput = input.toLowerCase();

    // Go to time patterns
    const goToTimePatterns = [
      /^(?:go|jump|navigate)\s+to\s+(\d+(?:\.\d+)?)\s*(?:second|sec|s)s?$/i,
      /^(?:go|jump|navigate)\s+to\s+(\d+):(\d+)$/i, // mm:ss format
    ];

    // Go to bar patterns
    const goToBarPatterns = [
      /^(?:go|jump|navigate)\s+to\s+(?:bar|measure)\s+(\d+)$/i,
      /^(?:bar|measure)\s+(\d+)$/i,
    ];

    // Skip forward patterns
    const skipForwardPatterns = [
      /^(?:skip|jump|move)\s+forward\s+(\d+(?:\.\d+)?)\s*(second|sec|s|bar|measure|beat)s?$/i,
      /^(?:forward|ahead)\s+(\d+(?:\.\d+)?)\s*(second|sec|s|bar|measure|beat)s?$/i,
    ];

    // Skip backward patterns
    const skipBackwardPatterns = [
      /^(?:skip|jump|move)\s+(?:back|backward)\s+(\d+(?:\.\d+)?)\s*(second|sec|s|bar|measure|beat)s?$/i,
      /^(?:back|backward)\s+(\d+(?:\.\d+)?)\s*(second|sec|s|bar|measure|beat)s?$/i,
    ];

    // Jump to start patterns
    const jumpToStartPatterns = [
      /^(?:go|jump|navigate)\s+to\s+(?:start|beginning)$/i,
      /^(?:start|beginning)$/i,
    ];

    // Jump to end patterns
    const jumpToEndPatterns = [
      /^(?:go|jump|navigate)\s+to\s+(?:end|finish)$/i,
      /^(?:end|finish)$/i,
    ];

    // Check go to time patterns
    for (const pattern of goToTimePatterns) {
      const match = lowerInput.match(pattern);
      if (match) {
        let targetTime = 0;
        if (match[2]) {
          // mm:ss format
          const minutes = parseInt(match[1]);
          const seconds = parseInt(match[2]);
          targetTime = minutes * 60 + seconds;
        } else {
          // seconds format
          targetTime = parseFloat(match[1]);
        }
        details = { action: "go_to_time", targetTime };
        confidence = 0.9;
        break;
      }
    }

    // Check go to bar patterns
    if (confidence === 0) {
      for (const pattern of goToBarPatterns) {
        const match = lowerInput.match(pattern);
        if (match && match[1]) {
          const targetBar = parseInt(match[1]);
          details = { action: "go_to_bar", targetBar };
          confidence = 0.9;
          break;
        }
      }
    }

    // Check skip forward patterns
    if (confidence === 0) {
      for (const pattern of skipForwardPatterns) {
        const match = lowerInput.match(pattern);
        if (match && match[1]) {
          const skipAmount = parseFloat(match[1]);
          const skipUnit = match[2] ? match[2].toLowerCase() : "seconds";
          const normalizedUnit =
            skipUnit.includes("bar") || skipUnit.includes("measure")
              ? "bars"
              : skipUnit.includes("beat")
              ? "beats"
              : "seconds";
          details = {
            action: "skip_forward",
            skipAmount,
            skipUnit: normalizedUnit as "seconds" | "bars" | "beats",
          };
          confidence = 0.85;
          break;
        }
      }
    }

    // Check skip backward patterns
    if (confidence === 0) {
      for (const pattern of skipBackwardPatterns) {
        const match = lowerInput.match(pattern);
        if (match && match[1]) {
          const skipAmount = parseFloat(match[1]);
          const skipUnit = match[2] ? match[2].toLowerCase() : "seconds";
          const normalizedUnit =
            skipUnit.includes("bar") || skipUnit.includes("measure")
              ? "bars"
              : skipUnit.includes("beat")
              ? "beats"
              : "seconds";
          details = {
            action: "skip_backward",
            skipAmount,
            skipUnit: normalizedUnit as "seconds" | "bars" | "beats",
          };
          confidence = 0.85;
          break;
        }
      }
    }

    // Check jump to start patterns
    if (confidence === 0) {
      for (const pattern of jumpToStartPatterns) {
        if (pattern.test(lowerInput)) {
          details = { action: "jump_to_start" };
          confidence = 0.9;
          break;
        }
      }
    }

    // Check jump to end patterns
    if (confidence === 0) {
      for (const pattern of jumpToEndPatterns) {
        if (pattern.test(lowerInput)) {
          details = { action: "jump_to_end" };
          confidence = 0.9;
          break;
        }
      }
    }

    const commandType =
      details?.action === "go_to_time"
        ? "go_to_time"
        : details?.action === "go_to_bar"
        ? "go_to_bar"
        : details?.action === "skip_forward"
        ? "skip_forward"
        : details?.action === "skip_backward"
        ? "skip_backward"
        : details?.action === "jump_to_start"
        ? "jump_to_start"
        : "jump_to_end";
    return { type: commandType, details, confidence };
  }

  recognizeProjectManagementCommand(
    input: string
  ): RecognitionAttempt<ProjectManagementCommand> {
    let confidence = 0;
    let details: ProjectManagementCommand | null = null;
    const lowerInput = input.toLowerCase();

    // Sort patterns
    const sortPatterns = [
      /sort\s+projects?\s+by\s+(name|date|title)/i,
      /sort\s+by\s+(name|date|title)/i,
      /(name|date|title)\s+sort/i,
      /order\s+projects?\s+by\s+(name|date|title)/i,
      /arrange\s+projects?\s+by\s+(name|date|title)/i,
    ];

    const sortDirectionPatterns = [
      /(ascending|asc|a-z|oldest|earliest)/i,
      /(descending|desc|z-a|newest|latest|recent)/i,
    ];

    // Filter patterns
    const filterPatterns = [
      /show\s+(?:only\s+)?(published|in-progress|backburner)\s+projects?/i,
      /filter\s+(?:by\s+)?(published|in-progress|backburner)/i,
      /(?:only\s+)?(published|in-progress|backburner)\s+projects?/i,
      /show\s+(?:my\s+)?(published|in-progress|backburner)/i,
    ];

    // Search patterns
    const searchPatterns = [
      /search\s+(?:for\s+)?['"]?([^'"\n]+)['"]?/i,
      /find\s+(?:projects?\s+)?['"]?([^'"\n]+)['"]?/i,
      /look\s+for\s+['"]?([^'"\n]+)['"]?/i,
    ];

    // Check for sort commands
    for (const pattern of sortPatterns) {
      const match = lowerInput.match(pattern);
      if (match && match[1]) {
        let sortBy: "name" | "date" =
          match[1].toLowerCase() === "name" ||
          match[1].toLowerCase() === "title"
            ? "name"
            : "date";
        let sortDirection: "asc" | "desc" = "asc";

        // Check for direction indicators
        for (const dirPattern of sortDirectionPatterns) {
          const dirMatch = lowerInput.match(dirPattern);
          if (dirMatch) {
            if (
              /(descending|desc|z-a|newest|latest|recent)/i.test(dirMatch[1])
            ) {
              sortDirection = "desc";
            } else {
              sortDirection = "asc";
            }
            break;
          }
        }

        // Default sort directions
        if (sortBy === "name") {
          sortDirection = "asc"; // A-Z by default
        } else if (sortBy === "date") {
          sortDirection = "desc"; // Newest first by default
        }

        details = {
          action: "sort",
          sortBy,
          sortDirection,
        };
        confidence = 0.85;
        break;
      }
    }

    // Check for filter commands
    if (!details) {
      for (const pattern of filterPatterns) {
        const match = lowerInput.match(pattern);
        if (match && match[1]) {
          let filterStatus: "all" | "in-progress" | "backburner" | "published" =
            "all";
          const statusMatch = match[1].toLowerCase();

          if (statusMatch === "published") {
            filterStatus = "published";
          } else if (statusMatch === "in-progress") {
            filterStatus = "in-progress";
          } else if (statusMatch === "backburner") {
            filterStatus = "backburner";
          }

          details = {
            action: "filter",
            filterStatus,
          };
          confidence = 0.8;
          break;
        }
      }
    }

    // Check for search commands
    if (!details) {
      for (const pattern of searchPatterns) {
        const match = lowerInput.match(pattern);
        if (match && match[1]) {
          const searchTerm = match[1].trim().replace(/^['"]|['"]$/g, "");
          if (searchTerm.length > 0) {
            details = {
              action: "search",
              searchTerm,
            };
            confidence = 0.75;
            break;
          }
        }
      }
    }

    return { type: "sort_projects", details, confidence };
  }

  recognizeOpenProjectCommand(
    input: string
  ): RecognitionAttempt<OpenProjectCommand> {
    let confidence = 0;
    let details: OpenProjectCommand | null = null;
    const lowerInput = input.toLowerCase();

    // Patterns for opening/loading projects
    const openProjectPatterns = [
      /open\s+project\s+['"]?([^'"\n]+?)['"]?$/i,
      /load\s+project\s+['"]?([^'"\n]+?)['"]?$/i,
      /switch\s+to\s+project\s+['"]?([^'"\n]+?)['"]?$/i,
      /go\s+to\s+project\s+['"]?([^'"\n]+?)['"]?$/i,
      /open\s+['"]?([^'"\n]+?)['"]?\s+project$/i,
      /load\s+['"]?([^'"\n]+?)['"]?\s+project$/i,
    ];

    for (const pattern of openProjectPatterns) {
      const match = lowerInput.match(pattern);
      if (match && match[1]) {
        const projectName = match[1].trim().replace(/^['"]|['"]$/g, "");
        if (projectName.length > 0) {
          details = { projectName };
          confidence = 0.9;
          break;
        }
      }
    }

    return { type: "open_project", details, confidence };
  }

  recognizeNavigateToProjectsCommand(
    input: string
  ): RecognitionAttempt<NavigateToProjectsCommand> {
    let confidence = 0;
    let details: NavigateToProjectsCommand | null = null;
    const lowerInput = input.toLowerCase();

    // Patterns for navigating to projects page
    const navigateProjectsPatterns = [
      /go\s+to\s+projects?/i,
      /show\s+projects?/i,
      /open\s+projects?\s+page/i,
      /navigate\s+to\s+projects?/i,
      /projects?\s+page/i,
      /view\s+projects?/i,
      /see\s+(?:all\s+)?projects?/i,
      /list\s+projects?/i,
      /projects?\s+list/i,
    ];

    for (const pattern of navigateProjectsPatterns) {
      if (pattern.test(lowerInput)) {
        details = {}; // No parameters needed
        confidence = 0.85;
        break;
      }
    }

    return { type: "navigate_to_projects", details, confidence };
  }

  recognizeAddNoteCommand(
    input: string,
    tracks: Track[]
  ): RecognitionAttempt<AddNoteCommand> {
    const lowerInput = input.toLowerCase();

    // Patterns for adding notes
    const addNotePatterns = [
      /\badd\s+(?:a\s+)?note\b/,
      /\bput\s+(?:a\s+)?note\b/,
      /\bplace\s+(?:a\s+)?note\b/,
      /\binsert\s+(?:a\s+)?note\b/,
      /\bcreate\s+(?:a\s+)?note\b/,
      /\bwrite\s+(?:a\s+)?note\b/,
    ];

    const matchesAddNote = addNotePatterns.some((pattern) =>
      pattern.test(lowerInput)
    );

    if (!matchesAddNote) {
      return {
        type: "add_note",
        details: null,
        confidence: 0.0,
      };
    }

    // Find target track
    const targetTrack = this.findTrackByNameInInput(input, tracks);
    if (!targetTrack) {
      return {
        type: "add_note",
        details: null,
        confidence: 0.0,
      };
    }

    // Only work with software instrument tracks
    if (targetTrack.type !== TrackType.SOFTWARE_INSTRUMENT) {
      return {
        type: "add_note",
        details: null,
        confidence: 0.0,
      };
    }

    // Parse note information
    const noteInfo = this.parseNoteFromInput(input);
    if (!noteInfo) {
      return {
        type: "add_note",
        details: null,
        confidence: 0.0,
      };
    }

    // Parse timing information
    const timingInfo = this.parseTimingFromInput(input);

    const addNoteCommand: AddNoteCommand = {
      trackId: targetTrack.id,
      trackName: targetTrack.name,
      pitch: noteInfo.pitch,
      velocity: noteInfo.velocity || 100,
      startTime: timingInfo.startTime,
      duration: timingInfo.duration || 1.0, // Default to 1 beat
      measure: timingInfo.measure,
    };

    return {
      type: "add_note",
      details: addNoteCommand,
      confidence: 0.85,
    };
  }

  private parseNoteFromInput(
    input: string
  ): { pitch: number; velocity?: number } | null {
    const lowerInput = input.toLowerCase();

    // Note name to MIDI number mapping
    const noteMap: { [key: string]: number } = {
      c: 0,
      "c#": 1,
      db: 1,
      d: 2,
      "d#": 3,
      eb: 3,
      e: 4,
      f: 5,
      "f#": 6,
      gb: 6,
      g: 7,
      "g#": 8,
      ab: 8,
      a: 9,
      "a#": 10,
      bb: 10,
      b: 11,
    };

    // Try to find note pattern like "C4", "F#3", "Bb5"
    const notePattern = /\b([a-g]#?|[a-g]b?)(\d+)\b/i;
    const match = lowerInput.match(notePattern);

    if (match) {
      const noteName = match[1].toLowerCase();
      const octave = parseInt(match[2]);

      if (noteMap.hasOwnProperty(noteName) && octave >= 0 && octave <= 10) {
        // MIDI octave = musical octave + 1 (C4 = MIDI 60 = 0 + 5*12)
        const pitch = noteMap[noteName] + (octave + 1) * 12;
        if (pitch >= 0 && pitch <= 127) {
          return { pitch };
        }
      }
    }

    // Try to find just note name without octave (like "C", "F#", "Bb")
    const noteOnlyPattern = /\b([a-g]#?|[a-g]b?)\b/i;
    const noteOnlyMatch = lowerInput.match(noteOnlyPattern);

    if (noteOnlyMatch) {
      const noteName = noteOnlyMatch[1].toLowerCase();
      if (noteMap.hasOwnProperty(noteName)) {
        // Default to octave 4 (middle octave) for note names without octave
        // MIDI note 60 = C4, so C4 = 0 + (4+1)*12 = 60
        const pitch = noteMap[noteName] + (4 + 1) * 12;
        if (pitch >= 0 && pitch <= 127) {
          return { pitch };
        }
      }
    }

    // Try to find MIDI number directly
    const midiPattern = /\bmidi\s*(\d+)\b/i;
    const midiMatch = lowerInput.match(midiPattern);
    if (midiMatch) {
      const pitch = parseInt(midiMatch[1]);
      if (pitch >= 0 && pitch <= 127) {
        return { pitch };
      }
    }

    // Default to middle C (C4 = 60) if no specific note found
    return { pitch: 60 };
  }

  private parseTimingFromInput(input: string): {
    startTime: number;
    duration?: number;
    measure?: number;
  } {
    const lowerInput = input.toLowerCase();

    // Try to find measure reference like "measure 2", "bar 3", "m4"
    const measurePatterns = [
      /\bmeasure\s*(\d+)\b/,
      /\bbar\s*(\d+)\b/,
      /\bm(\d+)\b/,
    ];

    for (const pattern of measurePatterns) {
      const match = lowerInput.match(pattern);
      if (match) {
        const measure = parseInt(match[1]);
        if (measure >= 1) {
          // Convert measure to beat position (measure 1 starts at beat 0, measure 2 at beat 4, etc.)
          const startTime = (measure - 1) * 4; // Assuming 4/4 time signature
          return { startTime, measure };
        }
      }
    }

    // Try to find beat reference like "beat 3", "on beat 2"
    const beatPattern = /\b(?:beat|on)\s*(\d+(?:\.\d+)?)\b/;
    const beatMatch = lowerInput.match(beatPattern);
    if (beatMatch) {
      const beat = parseFloat(beatMatch[1]);
      if (beat >= 0) {
        return { startTime: beat - 1 }; // Convert to 0-based
      }
    }

    // Default to start of first measure
    return { startTime: 0, measure: 1 };
  }

  private midiNoteToName(midiNote: number): string {
    const noteNames = [
      "C",
      "C#",
      "D",
      "D#",
      "E",
      "F",
      "F#",
      "G",
      "G#",
      "A",
      "A#",
      "B",
    ];
    const octave = Math.floor(midiNote / 12) - 1;
    const noteName = noteNames[midiNote % 12];
    return `${noteName}${octave}`;
  }

  recognizeShowUserDataCommand(
    input: string
  ): RecognitionAttempt<ShowUserDataCommand> {
    const lowerInput = input.toLowerCase();
    console.log(`[USER_DATA_COMMAND] Testing input: "${lowerInput}"`);

    // Check for user data related keywords
    const dataKeywords = [
      "show my data",
      "my data",
      "user data",
      "what do you know about me",
      "what have you learned about me",
      "what do you know",
      "show what you know",
      "my information",
      "my learning data",
      "ai data",
      "personal data",
      "export my data",
      "download my data",
      "view my data",
      "see my data",
      "display my data",
      "learning history",
      "interaction history",
      "show user data",
      "display user data",
      "view user data",
      "my profile",
      "user profile",
      "what you know about me",
      "tell me what you know about me",
      "show me what you know",
      "display what you know",
    ];

    const hasDataKeyword = dataKeywords.some((keyword) =>
      lowerInput.includes(keyword)
    );

    // Also check for patterns like "what * know * me"
    const knowPatterns = [
      /what.*know.*about.*me/,
      /what.*you.*know.*me/,
      /tell.*me.*what.*know/,
      /show.*me.*what.*know/,
      /display.*what.*know/,
    ];

    const hasKnowPattern = knowPatterns.some((pattern) =>
      pattern.test(lowerInput)
    );

    console.log(
      `[USER_DATA_COMMAND] hasDataKeyword: ${hasDataKeyword}, hasKnowPattern: ${hasKnowPattern}`
    );

    if (!hasDataKeyword && !hasKnowPattern) {
      return { type: "show_user_data", details: null, confidence: 0 };
    }

    console.log(
      `[USER_DATA_COMMAND] 🎯 USER DATA COMMAND RECOGNIZED! Opening modal...`
    );

    const command: ShowUserDataCommand = {};

    return {
      type: "show_user_data",
      details: command,
      confidence: 0.95,
    };
  }

  async getFallbackResponse(
    userMessage: string,
    isPlaying: boolean,
    tracks: Track[]
  ): Promise<string> {
    try {
      // Instead of using built-in responses, use the AI to generate intelligent responses
      // This ensures the AI can handle all scenarios naturally without hardcoded fallbacks

      // First, try to store this as a potential failed command for learning
      await this.storeUnrecognizedRequest(
        userMessage,
        "AI service unavailable - falling back to intelligent response",
        `User input: "${userMessage}" | System state: Playing=${isPlaying}, Tracks=${tracks.length}`
      );

      // Use the AI's chat response capability even in fallback mode
      if (this.isInitialized && this.model) {
        try {
          const systemInstructions = await this.getSystemInstructions(
            isPlaying,
            tracks,
            false // Not voice mode
          );

          const enhancedSystemPrompt = `${systemInstructions}

CRITICAL: You are currently in fallback mode because the main command system is unavailable. 
Your job is to:
1. Acknowledge what the user wants to do
2. Explain that you can't execute the command right now due to system limitations
3. Provide helpful context or suggestions when appropriate
4. Be encouraging and musical in your tone
5. Never use generic "Stay tuned" messages - be specific and helpful

Current context: ${tracks.length} tracks, ${
            isPlaying ? "currently playing" : "currently stopped"
          }`;

          const result = await this.model
            .generateContent(`${enhancedSystemPrompt}

User: ${userMessage}

Generate a helpful, specific response that acknowledges what they want to do and explains the current limitation:`);

          const response = result.response.text();
          console.log(
            "[AI_FALLBACK] Generated intelligent fallback response:",
            response.substring(0, 100) + "..."
          );
          return response;
        } catch (aiError) {
          console.error("[AI_FALLBACK] AI generation failed:", aiError);
          // Continue to basic fallback below
        }
      }

      // If AI is completely unavailable, provide a basic but intelligent response
      return `I understand you want to "${userMessage}", but I'm currently running in limited mode. The AI service needs to be reconnected for full functionality. Try refreshing the page or checking your internet connection.`;
    } catch (error) {
      console.error("[AI_FALLBACK] Error in fallback response:", error);
      return `I heard "${userMessage}" but I'm having trouble processing requests right now. Please try again in a moment.`;
    }
  }

  private analyzeConversationContext(
    conversationHistory: Message[],
    tracks: Track[]
  ): string {
    if (conversationHistory.length === 0) {
      return "No conversation history available.";
    }

    // Look for the most recently mentioned track
    const recentMessages = conversationHistory.slice(-5).reverse(); // Most recent first
    let lastMentionedTrack: string | null = null;
    let lastAction: string | null = null;

    debugLog(
      `[CONTEXT_ANALYSIS] Analyzing ${recentMessages.length} recent messages for track references`
    );
    debugLog(
      `[CONTEXT_ANALYSIS] Available tracks: ${tracks
        .map((t) => `"${t.name}"`)
        .join(", ")}`
    );

    for (const message of recentMessages) {
      const content = message.content.toLowerCase();

      // Look for track names in the message
      for (const track of tracks) {
        const trackNameLower = track.name.toLowerCase();
        if (content.includes(trackNameLower)) {
          lastMentionedTrack = track.name;

          // Determine what action was performed
          if (
            content.includes("color") ||
            content.includes("green") ||
            content.includes("red") ||
            content.includes("blue") ||
            content.includes("purple") ||
            content.includes("teal") ||
            content.includes("lime") ||
            content.includes("amber")
          ) {
            lastAction = "color change";
          } else if (
            content.includes("volume") ||
            content.includes("turn up") ||
            content.includes("turn down") ||
            content.includes("louder") ||
            content.includes("quieter")
          ) {
            lastAction = "volume change";
          } else if (content.includes("rename") || content.includes("name")) {
            lastAction = "rename";
          } else if (content.includes("mute") || content.includes("unmute")) {
            lastAction = "mute/unmute";
          } else if (content.includes("solo") || content.includes("unsolo")) {
            lastAction = "solo/unsolo";
          } else if (content.includes("pan")) {
            lastAction = "pan change";
          }

          break; // Found a track, stop looking in this message
        }
      }

      if (lastMentionedTrack) {
        break; // Found the most recent track mention
      }
    }

    if (lastMentionedTrack) {
      const actionText = lastAction ? ` (last action: ${lastAction})` : "";
      const result = `Most recently mentioned track: "${lastMentionedTrack}"${actionText}. Any pronouns like "it", "its", "the track" should refer to "${lastMentionedTrack}".`;
      debugLog(`[CONTEXT_ANALYSIS] Result: ${result}`);
      return result;
    }

    const result =
      "No specific track mentioned recently. If user uses pronouns, ask for clarification.";
    debugLog(`[CONTEXT_ANALYSIS] Result: ${result}`);
    return result;
  }

  private async listAvailableModels(): Promise<void> {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models?key=${this.apiKey}`
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to fetch models");
      }
    } catch (error) {
      console.error("Error listing models:", error);
      throw error;
    }
  }

  async storeUnrecognizedRequest(
    userInput: string,
    reason: string,
    context: string = ""
  ): Promise<void> {
    try {
      console.log("[DEBUG] Starting storeUnrecognizedRequest with:", {
        userInput: userInput.substring(0, 50),
        reason: reason.substring(0, 50),
        context: context.substring(0, 50),
      });

      const { supabase, CONSTANT_USER_ID } = await import("../supabaseClient");

      console.log(
        "[DEBUG] Imported Supabase client, user ID:",
        CONSTANT_USER_ID
      );

      // Determine error type - unrecognized requests are typically unimplemented features
      let errorType = "unimplemented_feature";
      if (reason.includes("parse") || reason.includes("understand")) {
        errorType = "parsing_error";
      } else if (reason.includes("Error") || reason.includes("exception")) {
        errorType = "system_error";
      }

      // Get browser information for debugging
      const browserInfo = `${navigator.userAgent} | Screen: ${screen.width}x${screen.height} | Platform: ${navigator.platform}`;

      const recordToInsert = {
        user_id: CONSTANT_USER_ID,
        user_input: userInput,
        attempted_command: "AI_COMMAND_PLAN_CREATION",
        failure_reason: reason,
        error_type: errorType,
        context: context || "command_plan_creation_failed",
        browser_info: browserInfo,
        resolved: false,
      };

      console.log("[DEBUG] About to insert record:", recordToInsert);

      // Store in the dedicated failed_commands table for developers
      const { error, data } = await supabase
        .from("failed_commands")
        .insert(recordToInsert);

      console.log("[DEBUG] Supabase insert result:", { error, data });

      if (error) {
        console.error(
          "[AI_SERVICE] Error storing unrecognized request in Supabase:",
          error
        );
        console.error(
          "[DEBUG] Full error details:",
          JSON.stringify(error, null, 2)
        );
      } else {
        console.log(
          `[AI_SERVICE] ✅ Successfully stored unrecognized request for developers:`,
          {
            userInput: userInput.substring(0, 50) + "...",
            errorType: errorType,
            reason: reason.substring(0, 50) + "...",
          }
        );
        console.log("[DEBUG] Insert was successful, data returned:", data);
      }
    } catch (error) {
      console.error(
        "[AI_SERVICE] ❌ Error accessing Supabase for unrecognized request:",
        error
      );
      console.error(
        "[DEBUG] Full catch error details:",
        JSON.stringify(error, null, 2)
      );
    }
  }

  // Store comprehensive interaction data for all user-AI interactions
  async categorizeInteraction(
    userInput: string,
    aiResponse: string
  ): Promise<
    "command_success" | "command_failure" | "conversation" | "learning_moment"
  > {
    try {
      if (!this.isInitialized || !this.model) {
        console.log(
          "[AI_CATEGORIZATION] AI not initialized, defaulting to conversation"
        );
        return "conversation";
      }

      const categorizationPrompt = `
Analyze this user-AI interaction and categorize it as one of these types:

1. **command_success** - User requested a DAW action/command that was successfully executed
2. **command_failure** - User requested a DAW action/command but it failed to execute (no command plan was created)
3. **conversation** - Knowledge sharing, advice, questions answered, general chat, greetings, preferences
4. **learning_moment** - User is teaching the AI or expressing preferences for future behavior

USER INPUT: "${userInput}"
AI RESPONSE: "${aiResponse}"

Rules for categorization:
- If the AI response contains detailed music production advice, techniques, or explanations → **conversation**
- If the user asked "how to" questions and AI provided helpful answers → **conversation**
- If the user made general statements like greetings, preferences, or comments → **conversation**
- If the user requested immediate DAW actions but no commands were executed → **command_failure**
- If the AI says it can't do something or features are "coming soon" → **command_failure**
- If commands were actually executed (like play, pause, adjust volume) → **command_success**
- If the user is teaching the AI or setting preferences → **learning_moment**

Respond with ONLY the category name: command_success, command_failure, conversation, or learning_moment
`;

      const result = await this.model.generateContent(categorizationPrompt);
      const response = result.response;
      const categoryText = response.text().trim().toLowerCase();

      // Parse the AI's categorization response
      if (categoryText.includes("command_success")) {
        return "command_success";
      } else if (categoryText.includes("command_failure")) {
        return "command_failure";
      } else if (categoryText.includes("learning_moment")) {
        return "learning_moment";
      } else {
        // Default to conversation for knowledge sharing, advice, general chat
        return "conversation";
      }
    } catch (error) {
      console.error(
        "[AI_CATEGORIZATION] Error categorizing interaction:",
        error
      );
      // Safe fallback - knowledge sharing and advice should default to conversation
      return "conversation";
    }
  }

  async storeUserInteraction(
    userInput: string,
    aiResponse: string,
    interactionType:
      | "command_success"
      | "command_failure"
      | "conversation"
      | "learning_moment",
    commandAttempted?: string,
    success?: boolean,
    metadata: Record<string, any> = {},
    sessionId?: string
  ): Promise<void> {
    try {
      const { supabase, CONSTANT_USER_ID } = await import("../supabaseClient");

      const browserInfo = `${navigator.userAgent} | Screen: ${screen.width}x${screen.height} | Platform: ${navigator.platform}`;

      const interactionRecord = {
        user_id: CONSTANT_USER_ID,
        user_input: userInput,
        ai_response: aiResponse,
        interaction_type: interactionType,
        command_attempted: commandAttempted || null,
        success: success ?? null,
        metadata: metadata,
        session_id: sessionId || null,
        browser_info: browserInfo,
      };

      const { error } = await supabase
        .from("user_interactions")
        .insert(interactionRecord);

      if (error) {
        console.error("[USER_INTERACTIONS] Error storing interaction:", error);
      } else {
        console.log(
          `[USER_INTERACTIONS] ✅ Stored ${interactionType} interaction`
        );
      }
    } catch (error) {
      console.error("[USER_INTERACTIONS] ❌ Error storing interaction:", error);
    }
  }

  // CONSOLIDATED AI-DRIVEN USER LEARNING SYSTEM
  // Everything now goes into user_learning with organized, consistent labels
  async analyzeAndStoreUserLearning(
    userInput: string,
    conversationContext: string = ""
  ): Promise<void> {
    if (!this.isInitialized || !this.model) {
      return;
    }

    try {
      console.log(
        "[USER_LEARNING] Analyzing user input for learnable information:",
        userInput.substring(0, 50) + "..."
      );

      // First, fetch existing learning categories to prevent duplicates
      const { supabase, CONSTANT_USER_ID } = await import("../supabaseClient");

      const { data: existingLearning } = await supabase
        .from("user_learning")
        .select("learning_type, learning_key, learning_value")
        .eq("user_id", CONSTANT_USER_ID)
        .order("created_at", { ascending: false })
        .limit(100);

      // Build a comprehensive map of existing categories and keys
      const existingCategories = new Set<string>();
      const existingKeys = new Map<string, Set<string>>(); // category -> keys

      if (existingLearning) {
        existingLearning.forEach((item) => {
          existingCategories.add(item.learning_type);
          if (!existingKeys.has(item.learning_type)) {
            existingKeys.set(item.learning_type, new Set());
          }
          existingKeys.get(item.learning_type)!.add(item.learning_key);
        });
      }

      const existingCategoriesList = Array.from(existingCategories);
      const existingStructure = Array.from(existingKeys.entries())
        .map(
          ([category, keys]) =>
            `${category}: [${Array.from(keys).slice(0, 5).join(", ")}${
              keys.size > 5 ? "..." : ""
            }]`
        )
        .join("; ");

      const learningPrompt = `You are analyzing user input for a personalized music production assistant. Your job is to detect ANY learnable information and store it in an organized, consistent way.

EXISTING LEARNING CATEGORIES: ${existingCategoriesList.join(", ") || "None yet"}
EXISTING STRUCTURE: ${existingStructure || "None yet"}

COMPREHENSIVE LABEL TAXONOMY - USE THESE CATEGORIES (or create new ones if truly needed):

CORE CATEGORIES (use only these 4 database-allowed types):
- behavior_pattern: user's consistent behaviors, habits, patterns in their actions
- preference_change: changes in user preferences over time, updates to existing preferences
- skill_level: expertise indicators, experience levels, learning progress, technical abilities
- workflow_habit: how user likes to work, creative processes, session habits, recurring workflows

ADDITIONAL CONTEXT SUBCATEGORIES (these become learning_key values):
- color_preferences: favorite colors, color associations, visual preferences
- music_genre_preferences: favorite genres, production styles, musical interests  
- communication_style: how user prefers to interact (formal/casual, brief/detailed, encouraging/direct)
- equipment_preferences: hardware, software, monitoring setup, tools
- ui_preferences: interface preferences, keyboard vs mouse, layout preferences  
- time_preferences: when user works best, session timing, scheduling
- naming_conventions: how user likes to name tracks, projects, files
- custom_phrase_mappings: when user says X, they mean Y
- automation_preferences: what user wants automated, shortcuts, templates
- collaboration_style: how user works with others, sharing preferences  
- learning_style: how user prefers to learn new things
- motivation_style: what encourages/motivates the user
- error_handling_preferences: how user wants errors handled, feedback style
- project_organization: how user organizes projects, file management
- creative_process: user's creative workflow, inspiration sources
- performance_preferences: live performance, recording preferences
- mixing_style: mixing preferences, balancing approaches
- sound_design_preferences: synthesis preferences, sound choices

USER MESSAGE: "${userInput}"
CONVERSATION CONTEXT: "${conversationContext}"

CRITICAL INSTRUCTIONS:
1. **REUSE EXISTING CATEGORIES** whenever possible - don't create new categories for things that fit existing ones
2. **CREATE NEW CATEGORIES** when information truly doesn't fit existing patterns - be creative with learning_key
3. **MAP TO CLOSEST TYPE** - use the 4 allowed learning_type values, but create specific learning_key for new categories
4. **BE CONSISTENT** with naming - use the established pattern 
5. **CHECK FOR UPDATES** - if this contradicts existing info, note it as an update
6. **BE COMPREHENSIVE** - capture ANY learnable information, even small preferences

CATEGORY MAPPING GUIDE:
- User preferences/likes/dislikes → behavior_pattern
- Changes in how they work over time → preference_change  
- Technical knowledge/expertise → skill_level
- Recurring work habits/processes → workflow_habit

If there is learnable information, respond with JSON:
{
  "hasLearnableInfo": true,
  "learningType": "exact_category_from_taxonomy_above",
  "learningKey": "specific_descriptive_key",
  "learningValue": "the_actual_preference_or_information", 
  "context": "when_this_was_mentioned",
  "confidenceScore": 0.8,
  "isUpdate": false
}

If there is NO learnable information, respond with:
{
  "hasLearnableInfo": false
}

EXAMPLES:
- "My favorite color is purple" → learningType: "behavior_pattern", learningKey: "color_preferences_favorite", learningValue: "purple"
- "I prefer short responses" → learningType: "behavior_pattern", learningKey: "communication_style_length", learningValue: "brief"  
- "I'm terrible at mixing" → learningType: "skill_level", learningKey: "mixing_expertise", learningValue: "beginner"
- "I always start with drums" → learningType: "workflow_habit", learningKey: "track_creation_order", learningValue: "drums_first"
- "When I say ready to rock, play the song" → learningType: "behavior_pattern", learningKey: "custom_phrase_ready_to_rock", learningValue: "play_song"
- "I hate using the mouse" → learningType: "behavior_pattern", learningKey: "ui_input_method_preference", learningValue: "keyboard_preferred"
- "Call my vocal track Lead Vox" → learningType: "behavior_pattern", learningKey: "naming_convention_main_vocal", learningValue: "Lead Vox"
- "I work better with encouragement" → learningType: "behavior_pattern", learningKey: "motivation_style_feedback", learningValue: "encouraging"
- "I like to compress everything heavily" → learningType: "behavior_pattern", learningKey: "audio_processing_style_compression", learningValue: "heavy_compression_preferred"
- "I never use reverb on drums" → learningType: "behavior_pattern", learningKey: "mixing_rule_drums_reverb", learningValue: "no_reverb_on_drums"

Be intelligent and capture everything useful for personalization!`;

      const result = await this.model.generateContent(learningPrompt);
      const response = result.response.text().trim();

      console.log(
        "[USER_LEARNING] AI analysis response:",
        response.substring(0, 100) + "..."
      );

      // Parse the JSON response - extract only the first complete JSON object
      const jsonMatch = response.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
      if (!jsonMatch) {
        console.log("[USER_LEARNING] No valid JSON found in AI response");
        return;
      }

      let learningData;
      try {
        learningData = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        // Try to extract JSON between ```json blocks if the first method fails
        const codeBlockMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
          try {
            learningData = JSON.parse(codeBlockMatch[1]);
          } catch (secondParseError) {
            console.log(
              "[USER_LEARNING] Failed to parse JSON from AI response:",
              parseError
            );
            return;
          }
        } else {
          console.log(
            "[USER_LEARNING] Failed to parse JSON from AI response:",
            parseError
          );
          return;
        }
      }

      if (!learningData.hasLearnableInfo) {
        console.log("[USER_LEARNING] No learnable information detected");
        return;
      }

      // Store directly in user_learning with organized structure
      const recordToInsert = {
        user_id: CONSTANT_USER_ID,
        learning_type: learningData.learningType,
        learning_key: learningData.learningKey,
        learning_value: learningData.learningValue,
        context:
          learningData.context || conversationContext || "user_conversation",
        confidence_score: learningData.confidenceScore || 0.7,
      };

      console.log(
        "[USER_LEARNING] Storing consolidated learning record:",
        recordToInsert
      );

      // Check if this is an update to existing information
      if (learningData.isUpdate) {
        // Update existing record
        const { error } = await supabase
          .from("user_learning")
          .update({
            learning_value: recordToInsert.learning_value,
            context: recordToInsert.context,
            confidence_score: recordToInsert.confidence_score,
            created_at: new Date().toISOString(), // Update timestamp
          })
          .eq("user_id", CONSTANT_USER_ID)
          .eq("learning_type", recordToInsert.learning_type)
          .eq("learning_key", recordToInsert.learning_key);

        if (error) {
          console.error("[USER_LEARNING] Error updating learning data:", error);
        } else {
          console.log(
            "[USER_LEARNING] ✅ Updated existing learning data:",
            recordToInsert
          );
        }
      } else {
        // Insert new record
        const { error } = await supabase
          .from("user_learning")
          .insert(recordToInsert);

        if (error) {
          console.error("[USER_LEARNING] Error storing learning data:", error);
        } else {
          console.log(
            "[USER_LEARNING] ✅ Stored new learning data:",
            recordToInsert
          );
        }
      }
    } catch (error) {
      console.error(
        "[USER_LEARNING] Error in consolidated learning analysis:",
        error
      );
    }
  }

  // Method to retrieve and format personalized instructions from consolidated learning data
  async getPersonalizedInstructions(): Promise<string> {
    try {
      const { supabase, CONSTANT_USER_ID } = await import("../supabaseClient");

      const { data: learningData } = await supabase
        .from("user_learning")
        .select("*")
        .eq("user_id", CONSTANT_USER_ID)
        .order("created_at", { ascending: false });

      if (!learningData || learningData.length === 0) {
        return "";
      }

      // Organize learning data by categories
      const organizedLearning = new Map<
        string,
        Array<{ key: string; value: string; context: string }>
      >();

      learningData.forEach((item) => {
        if (!organizedLearning.has(item.learning_type)) {
          organizedLearning.set(item.learning_type, []);
        }
        organizedLearning.get(item.learning_type)!.push({
          key: item.learning_key,
          value: item.learning_value,
          context: item.context,
        });
      });

      // Format for AI instructions
      const personalizedSections: string[] = [];

      organizedLearning.forEach((items, category) => {
        const categoryTitle = category.replace(/_/g, " ").toUpperCase();
        const itemsList = items
          .map((item) => `  - ${item.key}: ${item.value}`)
          .join("\n");
        personalizedSections.push(`${categoryTitle}:\n${itemsList}`);
      });

      const personalizedInstructions = `
**PERSONALIZED USER PROFILE:**
${personalizedSections.join("\n\n")}

**PERSONALIZATION INSTRUCTIONS:**
- Adapt your communication style based on the user's preferences above
- Use their preferred terminology and naming conventions
- Respect their workflow patterns and automation preferences  
- Consider their technical skill level when explaining concepts
- Apply their custom phrase mappings when they use familiar phrases
- Tailor responses to their motivation and learning style
- Reference their music genre and equipment preferences when relevant
`;

      console.log(
        "[USER_LEARNING] Retrieved personalized instructions based on",
        learningData.length,
        "learning records"
      );
      return personalizedInstructions;
    } catch (error) {
      console.error(
        "[USER_LEARNING] Error retrieving personalized instructions:",
        error
      );
      return "";
    }
  }

  // New method: Let AI create a command execution plan
  async createCommandPlan(
    userInput: string,
    currentState: {
      isPlaying: boolean;
      tracks: Track[];
      tempo: number;
      timeSignature: TimeSignature;
      isMetronomeEnabled: boolean;
      isCycleModeEnabled: boolean;
    },
    conversationHistory: Message[] = [],
    personalizedInstructions?: string
  ): Promise<AICommandPlan | null> {
    // --- KNOWLEDGE-INFORMED COMMAND PLANNING ---
    console.log(
      `[COMMAND_PLANNING] 🧠 Retrieving music production knowledge to inform command decisions...`
    );

    const relevantKnowledge = await this.retrieveRelevantKnowledge(
      userInput,
      3, // Fewer results for command planning to keep context focused
      "command_planning"
    );

    let knowledgeContext = "";
    if (relevantKnowledge.length > 0) {
      console.log(
        `[COMMAND_PLANNING] 📖 Applying ${relevantKnowledge.length} knowledge snippets to command planning`
      );
      knowledgeContext = `\n\nRELEVANT MUSIC PRODUCTION KNOWLEDGE:\n${relevantKnowledge.join(
        "\n\n"
      )}\n\nUse this knowledge to make more informed decisions about parameters, workflows, and techniques.`;
    }
    // ---
    if (!this.isInitialized || !this.model) {
      return null;
    }

    // Use concise mode for complex multi-track operations to prevent response truncation
    const isComplexMultiTrackOperation =
      currentState.tracks.length > 8 ||
      userInput.toLowerCase().includes("all") ||
      userInput.toLowerCase().includes("every") ||
      (currentState.tracks.length > 5 &&
        (userInput.toLowerCase().includes("group") ||
          userInput.toLowerCase().includes("sort") ||
          userInput.toLowerCase().includes("color") ||
          userInput.toLowerCase().includes("theme") ||
          userInput.toLowerCase().includes("rainbow")));

    const systemPrompt = `You are a music production assistant that creates execution plans for user commands.
${knowledgeContext}

CURRENT STATE:
- Playing: ${currentState.isPlaying}
- Tempo: ${currentState.tempo} BPM
- Time Signature: ${currentState.timeSignature.numerator}/${
      currentState.timeSignature.denominator
    }
- Metronome: ${currentState.isMetronomeEnabled ? "On" : "Off"}
- Loop Mode: ${currentState.isCycleModeEnabled ? "On" : "Off"}
- Tracks: ${currentState.tracks
      .map(
        (t, index) =>
          `[${index + 1}] "${t.name}" (${t.type}, vol: ${t.volume}%, pan: ${
            t.pan
          }, color: ${t.color}, ${t.isMuted ? "muted" : "unmuted"}, ${
            t.isSoloed ? "soloed" : "not soloed"
          })`
      )
      .join(", ")}

${
  personalizedInstructions ? `PERSONALIZATION: ${personalizedInstructions}` : ""
}

${
  isComplexMultiTrackOperation
    ? `CONCISE MODE: For multi-track operations, keep descriptions brief to avoid response truncation.

KEY COMMANDS FOR MULTI-TRACK OPERATIONS:
- moveTrackToPosition(trackName: string, position: number) - Move track to specific position (1-based)
- setTrackColor(trackName: string, color: string) - Available colors: teal, fuchsia, sky, emerald, amber, rose, indigo, lime
- sortTracks(sortBy: "name"|"type"|"color"|"creation", sortDirection: "asc"|"desc") - Sort all tracks
- muteTrack(trackName: string) - Mute/unmute track
- soloTrack(trackName: string, shouldSolo?: boolean) - Solo/unsolo track

🚨 CRITICAL: For "all tracks" commands, ensure you include ALL ${
        currentState.tracks.length
      } tracks, especially the bottom track "${
        currentState.tracks[currentState.tracks.length - 1]?.name || "N/A"
      }".

RESPONSE FORMAT: Return ultra-concise JSON to avoid truncation:
{
  "commands": [{"type": "setTrackColor", "parameters": {"trackName": "Track1", "color": "blue"}, "description": "Blue", "priority": 1}],
  "reasoning": "Colors",
  "expectedOutcome": "Done!"
}

⚠️ CRITICAL SPACE-SAVING RULES:
- descriptions: 1 word only ("Blue", "Set", "Done")
- reasoning: 1-2 words max ("Colors", "Setting")
- expectedOutcome: 1-2 words max ("Done!", "Applied!")
- NO extra spaces, NO verbose text
- EVERY character counts to prevent truncation`
    : `AVAILABLE COMMANDS - COMPLETE AND ACCURATE LIST:`
}
1. play() - Start playback
2. pause() - Stop playback
3. setTempo(bpm: number) - Change tempo (20-300 BPM)
4. toggleMetronome() - Toggle metronome on/off
5. toggleCountIn() - Toggle count-in for recording on/off (provides metronome countdown before recording starts)
6. setKeySignature(key: string) - Set key signature. Available keys: "C Major", "A Minor", "G Major", "E Minor", "D Major", "B Minor", "A Major", "F# Minor", "E Major", "C# Minor", "B Major", "G# Minor", "F Major", "D Minor", "Bb Major", "G Minor", "Eb Major", "C Minor", "Ab Major", "F Minor", "Db Major", "Bb Minor", "Gb Major", "Eb Minor"
7. setTimeSignature(numerator: number, denominator: number) - Set time signature (e.g., 4, 4 for 4/4 time, 3, 4 for 3/4 time, 6, 8 for 6/8 time)
8. addTrack(type: "audio" | "instrument", name?: string) - Add new track
9. duplicateTrack(trackName: string, newName?: string) - Duplicate existing track with optional new name
10. setTrackVolume(trackName: string, volume: number) - Set track volume (0-100). For relative changes like "turn up" or "more", calculate the new volume based on current volume. Typical increments: +10 for "turn up", +5 for "a bit more", +20 for "much louder"
11. setTrackPan(trackName: string, pan: number) - Set track pan (-100 to 100). For relative changes: "a little left/right" = ±15, "to the left/right" = ±33, "all the way left/right" or "hard left/right" = ±100. Calculate based on current pan position.
12. muteTrack(trackName: string) - Mute/unmute track
13. soloTrack(trackName: string, shouldSolo?: boolean) - Solo/unsolo track. For multiple tracks, use separate commands for each track with shouldSolo=true, and optionally unsoloAllTracks() first to clear existing solos.
13a. unsoloAllTracks() - Unsolo all currently soloed tracks  
14. renameTrack(currentName: string, newName: string) - Rename track
15. renameProject(newName: string) - Rename the current project
16. setTrackColor(trackName: string, color: string) - Set track color. AVAILABLE COLORS: teal, fuchsia, sky, emerald, amber, rose, indigo, lime. You can also use common color names like red, yellow, green, blue, purple which will be automatically mapped to the closest available color (red→rose, yellow→amber, green→emerald, blue→sky, purple→fuchsia). SMART THEMING CAPABILITY: Can create aesthetic themes like "rainbow", "earthy", "warm", "cool", "vibrant" using these available colors.
17. setLoopRange(startMeasure?: number, endMeasure?: number, startTimeSeconds?: number, endTimeSeconds?: number) - Set loop range AND automatically enable loop mode. Can use either measures OR time in seconds.
18. toggleLoop() - Toggle loop mode on/off (without changing range)
19. startLooping(startMeasure?: number, endMeasure?: number) - Enable loop mode AND start playback (optionally with range)
20. movePlayhead(position: "beginning" | number) - Move playhead (number = measure)
21. zoomIn(intensity?: "slight" | "moderate" | "maximum") - Zoom in on timeline
22. zoomOut(intensity?: "slight" | "moderate" | "maximum") - Zoom out on timeline  
23. zoomToFit() - Zoom to fit entire project
24. zoomToMeasures(startMeasure: number, endMeasure: number) - Zoom to fit specific measures
25. goToMeasure(measure: number) - Jump playhead to specific measure
26. goToBeginning() - Move playhead to start of project
27. toggleRecordArm(trackName: string) - Toggle record arm for a track
28. toggleInputMonitoring(trackName: string) - Toggle input monitoring for audio tracks
29. startRecording() - Start recording (requires armed tracks)
30. stopRecording() - Stop recording
31. undo() - Undo last action
32. redo() - Redo last undone action
33. selectTrack(trackName: string) - Select a specific track
34. deleteTrack(trackName: string) - Delete a track
35. deleteAllTracks() - Delete all tracks
36. deleteRangeTracks(startIndex: number, endIndex: number) - Delete tracks in a range (1-based indexing)
37. clearSelection() - Clear current track selection
38. selectAllTracks() - Select all tracks
39. moveTrackToTop(trackName: string) - Move track to the top position
40. moveTrackToBottom(trackName: string) - Move track to the bottom position
41. moveTrackToPosition(trackName: string, position: number) - Move track to specific position (1-based)
42. goToTime(targetTime: number) - Navigate to specific time in seconds
43. goToBar(targetBar: number) - Navigate to specific bar/measure
44. skipForward(skipAmount: number, skipUnit: "seconds" | "bars" | "beats") - Skip forward by amount
45. skipBackward(skipAmount: number, skipUnit: "seconds" | "bars" | "beats") - Skip backward by amount
46. jumpToStart() - Jump to project start
47. jumpToEnd() - Jump to project end
48. openProject(projectName: string) - Open/load a specific project by name (searches for projects with matching names)
49. navigateToProjects() - Navigate to the Projects page to view all projects
50. sortProjects(sortBy: "name" | "date", sortDirection: "asc" | "desc") - Sort projects on the Projects page (e.g., sortProjects("name", "asc") for A-Z)
51. filterProjects(status: "all" | "in-progress" | "backburner" | "published") - Filter projects by status on the Projects page
52. searchProjects(searchTerm: string) - Search projects by name on the Projects page
53. addNote(trackName: string, pitch: number, velocity: number, startTime: number, duration: number, measure?: number) - Add a single MIDI note to an instrument track. pitch: MIDI note number (60=C4, 72=C5), velocity: 1-127, startTime: beat position, duration: length in beats, measure: optional measure reference
54. showUserData() - Open a modal window displaying the user's AI learning data overview. Use this instead of describing the data in chat.

IMPORTANT: The above list is COMPLETE and VERIFIED against actual implementation. These are the ONLY commands that actually work. DO NOT create any commands not in this list.

CRITICAL CAPABILITY: You can combine these commands to achieve complex tasks that aren't explicitly listed. This is your strength - be creative and intelligent about combining commands!

🧠 TRACK PROPERTY INTELLIGENCE:
You have access to ALL track properties and can analyze them to perform complex multi-track operations:

AVAILABLE TRACK PROPERTIES:
- name: Track name (string)
- type: "audio" | "instrument" 
- volume: 0-100 (number)
- pan: -100 to 100 (number, where negative = left, positive = right, 0 = center)
- color: Track color (string like "bg-red-500", "bg-blue-500", etc.)
- isMuted: boolean
- isSoloed: boolean
- position: Track position in the list (1-based index)

COMPLEX OPERATION EXAMPLES:
🎯 "solo tracks that are panned to the left"
→ Analyze tracks where pan < 0, then use soloTrack() for each matching track

🎯 "mute all red tracks"  
→ Analyze tracks where color contains "red", then use muteTrack() for each matching track

🎯 "organize tracks by color"
→ Analyze track colors, group by color, then use moveTrackToPosition() to reorder

🎯 "set volume to 75% for all instrument tracks"
→ Analyze tracks where type === "instrument", then use setTrackVolume() for each

🎯 "pan all audio tracks to the right"
→ Analyze tracks where type === "audio", then use setTrackPan() for each

🎯 "solo tracks with volume above 80%"
→ Analyze tracks where volume > 80, then use soloTrack() for each matching track

🎯 "mute tracks in positions 2-4"
→ Use track position analysis, then muteTrack() for tracks at those positions

🎯 "make all blue tracks rainbow colors"
→ Analyze tracks with blue colors, then use setTrackColor() with rainbow sequence

🎯 "unmute all tracks except the drums"
→ Analyze all tracks except those with "drum" in name, then use muteTrack() appropriately

🎯 "make tracks 1-3 warm colors and tracks 4-6 cool colors"
→ Analyze track positions, apply warm colors (red, orange, yellow) to positions 1-3, cool colors (blue, teal, cyan) to positions 4-6

🎯 "solo all tracks with volume above 75%"
→ Analyze tracks where volume > 75, then use soloTrack() for each matching track

🎯 "create rainbow theme starting with track 2"
→ Skip track 1, apply rainbow colors (red, orange, yellow, green, blue, indigo, violet) starting from track 2

🎯 "make everything look like fire"
→ Apply fire-themed colors (rose, amber, lime) to ALL tracks - ensure every single track gets a fire color, including the last track

🎯 "organize by instrument type and color code them"
→ Group tracks by type, use moveTrackToPosition() to group them, then apply type-specific colors

🎯 "make vocal tracks green and instrument tracks blue"
→ Analyze track names for "vocal" patterns, apply green; analyze for instrument types, apply blue

🎯 "pan odd tracks left and even tracks right"
→ Analyze track positions, apply negative pan to odd positions, positive pan to even positions

PROPERTY-BASED FILTERING LOGIC:
- COLOR MATCHING: Use contains/includes logic for color matching (e.g., "red" matches "bg-red-500")
- PAN DIRECTION: left = pan < 0, right = pan > 0, center = pan === 0
- VOLUME RANGES: quiet = volume < 50, loud = volume > 80, etc.
- TYPE GROUPING: Separate operations for "audio" vs "instrument" tracks
- NAME PATTERNS: Use includes() for partial name matching (e.g., "vocal" matches "Lead Vocals")
- POSITION RANGES: Use 1-based indexing for track positions

INTELLIGENT ANALYSIS APPROACH:
1. IDENTIFY CRITERIA: Parse user request to understand what property/condition to filter by
2. ANALYZE CURRENT STATE: Examine all tracks and identify which ones match the criteria  
3. DETERMINE ACTIONS: Decide what command(s) to apply to the matching tracks
4. EXECUTE SEQUENCE: Create commands for each matching track in logical order
5. PROVIDE CONTEXT: Explain which tracks were affected and why

🚨 CRITICAL BOTTOM TRACK ISSUE PREVENTION 🚨
There is a KNOWN BUG where the last/bottom track in the project is often missed when applying commands to "all tracks" or when sorting/coloring tracks. This is the #1 most common error pattern.

MANDATORY BOTTOM TRACK VERIFICATION PROTOCOL:
1. ALWAYS count the total number of tracks first
2. When generating commands for "all tracks", "everything", or similar:
   - Generate exactly the same number of commands as there are tracks
   - SPECIFICALLY verify you have a command for the bottom track
   - Double-check your command list includes the very last track
3. NEVER assume the last track is handled - explicitly verify it
4. If you generate N-1 commands for "all N tracks", you have made the error
5. The bottom track is EQUALLY IMPORTANT as all other tracks

BOTTOM TRACK VERIFICATION EXAMPLES:
❌ WRONG: "color all 5 tracks" → generates 4 commands (missing bottom track)
✅ CORRECT: "color all 5 tracks" → generates 5 commands (includes bottom track)

❌ WRONG: sorting tracks but the bottom track stays in the wrong position
✅ CORRECT: sorting includes ALL tracks in the new order

SPECIFIC BOTTOM TRACK DEBUGGING:
- If user says "the bottom track is not cooperating" - this indicates the bottom track verification failed
- Always include the bottom track in multi-track operations
- When sorting, ensure the bottom track is properly repositioned
- When coloring all tracks, ensure the bottom track gets a color

VERIFICATION CHECKLIST FOR ALL-TRACK OPERATIONS:
□ Count total tracks
□ Generated same number of commands as tracks (not one less)
□ Specifically verified bottom track is included
□ Double-checked command list covers ALL track positions

This verification is MANDATORY for any operation affecting multiple tracks.

ADVANCED PATTERN RECOGNITION:
- POSITIONAL PATTERNS: "first 3 tracks", "last track", "tracks 2-5", "every other track", "odd/even tracks"
- CONDITIONAL PATTERNS: "tracks louder than X", "muted tracks", "soloed tracks", "left-panned tracks"
- NAME PATTERNS: "vocal tracks", "drum tracks", "tracks with 'lead' in the name", "numbered tracks"
- COLOR PATTERNS: "red tracks", "warm colored tracks", "tracks with similar colors"
- TYPE PATTERNS: "audio tracks", "instrument tracks", "software tracks"
- COMBINATION PATTERNS: "red audio tracks", "loud vocal tracks", "muted instrument tracks"

COMPLEX COMMAND SEQUENCING:
- BATCH OPERATIONS: Apply same action to multiple tracks based on criteria
- CONDITIONAL LOGIC: "If track is X, then do Y, otherwise do Z"
- SEQUENTIAL PROCESSING: Process tracks in specific order (by position, name, type, etc.)
- DEPENDENCY HANDLING: Some operations need to happen before others (e.g., unsolo all before soloing specific tracks)
- ERROR RESILIENCE: Continue processing even if individual commands fail

Examples of combining commands for complex tasks:
- TRACK ORGANIZATION: To organize tracks by instrument, type, color, or alphabetically, analyze the current tracks and use multiple moveTrackToPosition() commands to reorder them as needed
- PROPERTY-BASED BATCH OPERATIONS: To adjust multiple tracks based on their properties (volume, pan, color, type, etc.), analyze which tracks match the criteria and execute individual commands for each matching track
- CONDITIONAL OPERATIONS: To perform actions based on track states ("mute everything except vocals", "solo left-panned tracks"), use property analysis to determine which tracks to affect
- WORKFLOW AUTOMATION: To set up complex recording/mixing scenarios, combine multiple commands across different tracks based on their properties
- COMPLEX NAVIGATION: To create elaborate playback scenarios, combine navigation, loop, and playback commands
- AESTHETIC THEMING: To create visual themes based on track properties, analyze current colors and apply coordinated color schemes

THINK CREATIVELY: If a user asks for something that seems complex, break it down into the available basic commands. You have the intelligence to analyze the current state and determine the sequence of commands needed to achieve any reasonable goal within the scope of the available commands.

PROPERTY ANALYSIS EXAMPLES:
- "solo tracks that are panned to the left" → Find tracks where pan < 0, apply soloTrack() to each
- "organize by instrument type" → Group tracks by type, use moveTrackToPosition() to reorder  
- "mute all blue tracks" → Find tracks with blue colors, apply muteTrack() to each
- "set volume to 80% for tracks in positions 1-3" → Use position analysis, apply setTrackVolume() to each
- "make red tracks into a rainbow" → Find red tracks, apply setTrackColor() with rainbow sequence

PROJECT MANAGEMENT COMMANDS:
- sortProjects(sortBy: "name" | "date", sortDirection: "asc" | "desc") - Sort projects (works on Projects page or navigates there first)
- filterProjects(status: "all" | "in-progress" | "backburner" | "published") - Filter projects by status
- searchProjects(searchTerm: string) - Search projects by name
- openProject(projectName: string) - Open/load a specific project by name
- navigateToProjects() - Navigate to the Projects page

EXAMPLES:
- "sort projects by name" → sortProjects("name", "asc")
- "sort by date newest first" → sortProjects("date", "desc") 
- "show only published projects" → filterProjects("published")
- "search for vocals" → searchProjects("vocals")
- "open project demo" → openProject("demo")
- "go to projects" → navigateToProjects()

TRACK SORTING COMMANDS:
- sortTracks(sortBy: "name" | "type" | "creation" | "color", sortDirection: "asc" | "desc") - Sort tracks in the DAW

EXAMPLES:
- "sort tracks by name" → sortTracks("name", "asc")
- "sort tracks alphabetically" → sortTracks("name", "asc")
- "sort tracks by type" → sortTracks("type", "asc")
- "sort tracks by color" → sortTracks("color", "asc")
- "reverse track order" → sortTracks("creation", "desc")

CRITICAL: UNIMPLEMENTED FEATURES - The following features are NOT IMPLEMENTED and you MUST return null for any requests involving them:
- Audio Effects: compression, reverb, delay, chorus, distortion, EQ, filters, gates, limiters, saturators
- Audio Processing: normalize, pitch correction, time stretching, quantization
- Advanced Mixing: sidechain, automation, sends, returns, busses, groups
- MIDI Effects: arpeggiators, chord triggers, scale correction
- File Operations: import audio, export, bounce, render
- Collaboration: sharing, commenting, version control
- Performance Features: freeze tracks, bounce in place, render regions

If the user requests ANY of these features, you MUST return null. Do NOT create fake commands like "addCompressor", "addReverb", "eqTrack", "importAudio", "exportProject", etc. These will be handled by the fallback system with appropriate user-friendly messages.

IMPORTANT LOOP BEHAVIOR:
- When user says "start looping" (without range), use startLooping() - this enables loop mode and starts playback
- When user says "start looping measures X to Y", use startLooping(X, Y) - this sets range, enables loop, and starts playback
- When user says "loop measures X to Y" or "loop from 0:15 to 1:30" (without "start"), use setLoopRange() - this sets range and enables loop but doesn't start playback
- When user says "loop on/off" or "enable/disable loop", use toggleLoop()
- The setLoopRange command automatically enables loop mode if it's currently disabled

COUNT-IN BEHAVIOR:
- Count-in provides a metronome countdown before recording starts (currently set to 1 bar)
- When enabled, recording will start with a countdown to help musicians prepare
- Use toggleCountIn() for commands like "enable count-in", "turn on count-in", "disable count-in", "count-in off"
- Count-in only affects recording, not regular playback

NAVIGATION & ZOOM BEHAVIOR:
- Use zoomIn/zoomOut for general zoom commands ("zoom in", "zoom out")
- Use zoomToFit() for "zoom to fit", "fit project", "show entire project" - automatically scrolls to beginning
- Use zoomToMeasures(start, end) for "zoom to measures 1-8", "fit measures 5 to 10" - automatically scrolls to show the start measure
- Use goToMeasure(number) for "go to measure 5", "jump to measure 10" - automatically scrolls to show the measure at viewport start
- Use goToBeginning() for "go to start", "jump to beginning", "go to the top" - automatically scrolls to beginning
- Zoom intensity levels: "slight" (1.2x), "moderate" (1.5x), "maximum" (2.0x)
- All navigation commands automatically handle horizontal scrolling to ensure the target is visible
- Zoom calculations automatically account for sidebar width (340px when open) to optimize for available viewport space

RESPONSE STYLE - CRITICAL:
- ONLY use commands from the AVAILABLE COMMANDS list above - never create commands that don't exist
- If a user requests something not in the available commands, return null instead of creating fake commands
- For implemented commands: Write expectedOutcome as NATURAL, MUSICAL, ENTHUSIASTIC responses - NO technical language!
- GOOD Examples: "Groovy! Set the tempo to 120 BPM and got everything rocking! 🎵", "Sweet! Added those tracks and got the loop going from bars 2 to 6! 🎶", "Nice! Panned that track hard right and cranked it to 75% - sounds perfect! 🎧"
- BAD Examples: "12 commands executed", "Loop enabled from measures 2 to 6", "Volume changed to 75%", "Track muted"
- Use musical slang, enthusiasm, and emojis - make it sound like you're genuinely excited about the music
- Speak like an enthusiastic studio assistant who LOVES music, not like a technical system
- CRITICAL: If you cannot fulfill a request with available commands, return null - do NOT create a plan with fake commands
- NEVER create commands like "addReverb", "addCompressor", "eqTrack" etc. - these don't exist in the available list
- When in doubt about whether a command exists, return null rather than risk creating fake commands

CRITICAL PRONOUN RESOLUTION:
- When user says "it", "its", "the track", "that track", etc., they are referring to the most recently mentioned track in the conversation
- Look at the conversation history to identify which track was last mentioned or modified
- Examples of pronoun resolution:
  * User: "make test green" → AI: setTrackColor("test", "green")
  * User: "now make it lime" → AI: setTrackColor("test", "lime") [resolves "it" to "test"]
  * User: "turn its volume up" → AI: setTrackVolume("test", currentVolume+10) [resolves "its" to "test"]
  * User: "mute it" → AI: muteTrack("test") [resolves "it" to "test"]
- NEVER use pronouns in command parameters - always resolve to the actual track name
- If unclear what "it" refers to, look for the most recent track name mentioned in the conversation
- Track modifications (color changes, volume changes, renames) make that track the new "it" reference

PAN COMMAND EXAMPLES:
- "pan test a little left" → setTrackPan("test", currentPan-15)
- "pan it to the right" → setTrackPan("lastMentionedTrack", currentPan+33) 
- "pan vocals all the way left" → setTrackPan("vocals", -100)
- "center the drums" → setTrackPan("drums", 0)
- "hard right on the guitar" → setTrackPan("guitar", 100)

IMPORTANT: When duplicating a track with additional modifications (like renaming or changing color), create a single duplicateTrack command with the newName parameter, then follow with separate commands for the modifications. This ensures proper sequencing.

CURRENT CONVERSATION CONTEXT:
Recent messages: ${conversationHistory
      .slice(-5)
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n")}

🎯 INTELLIGENT COMMAND DETECTION:
Use your intelligence to understand when the user wants you to execute an action vs just chat.

KEY PRINCIPLES:
1. If the conversation was about doing something to the DAW (adding tracks, changing colors, setting tempo, etc.) and the user gives any form of agreement, confirmation, or delegation - CREATE COMMANDS.

2. Look at conversation context - if you just proposed an action and the user responds positively or delegates the decision to you, execute it.

3. Any direct instruction to modify DAW state = CREATE COMMANDS.

4. Use natural language understanding - don't rely on exact phrase matching.

DO NOT fake command execution - if you detect a command intent, CREATE the actual JSON command plan.

CONTEXT ANALYSIS FOR PRONOUN RESOLUTION:
${this.analyzeConversationContext(conversationHistory, currentState.tracks)}

Respond with a JSON object containing:
{
  "commands": [
    {
      "type": "commandName",
      "parameters": { "param1": "value1" },
      "description": "Human readable description",
      "priority": 1
    }
  ],
  "reasoning": "Explanation of why these commands were chosen",
  "expectedOutcome": "What the user should expect to happen"
}

CRITICAL JSON REQUIREMENTS:
- ALWAYS generate COMPLETE, VALID JSON - never truncate or leave incomplete
- For complex multi-track operations, include ALL necessary commands in the array
- Each command must have proper closing brackets and commas
- End the JSON with proper closing braces
- If generating many commands, prioritize completeness over brevity
- NEVER stop mid-command or mid-JSON structure

🚨 CRITICAL: CONVERSATION vs COMMAND DETECTION 🚨

You MUST return null (no commands) for these types of input:

❌ CONVERSATIONAL INPUTS (return null):
- "I love [artist name]" or "I'm a fan of [artist]"
- "This music makes me feel [emotion]"
- "[Artist] is amazing" or "[Song] is my favorite"
- "How are you?" or general chitchat
- Questions about music history, theory, or artists
- Sharing opinions about genres, albums, or songs
- Expressing feelings about music ("floating", "dreamy", "energetic")
- "Tell me about [artist/genre]"
- "What do you think about [music topic]?"
- Asking for music recommendations
- Discussing music production techniques without asking to implement them
- "I wish I could make music like [artist]" (without specific request)

✅ COMMAND INPUTS (create command plan):
- "Play" / "Pause" / "Stop"
- "Add [number] tracks" or "Create a track"
- "Set tempo to [number]" or "Make it faster/slower"
- "Change [track] color to [color]"
- "Mute/solo [track]" or "Turn up/down [track]"
- "Record" / "Start recording"
- "Loop from [time] to [time]"
- "Pan [track] left/right"
- "Rename [track] to [name]"
- "Delete [track]" or "Remove [track]"
- "Zoom in/out" or navigation commands
- ANY request to modify, create, or control DAW functionality

🎯 CONTEXTUAL COMMANDS (execution confirmations):
- "Yes" / "Yeah" / "Let's do it" / "Go for it" / "Do it" AFTER discussing a specific action
- "That sounds good" / "Perfect" / "Awesome" AFTER proposing tracks/changes
- "Add them" / "Create them" / "Make them" when referring to previously discussed items
- Look at conversation history to understand what action is being confirmed

🎯 KEY DISTINCTION:
- SHARING musical preferences/feelings = conversation (null)
- REQUESTING DAW actions = commands (JSON)

Use your natural language understanding to distinguish between:
- SHARING preferences/feelings about music = conversation (null)
- REQUESTING actions on the DAW = commands (JSON)

Trust your intelligence to understand context and user intent.

If you're unsure whether it's conversation or command, lean toward conversation (return null).

If the request is conversational or doesn't require commands, return null.

User request: "${userInput}"`;

    try {
      // Configure generation for complex multi-track operations
      const generationConfig = {
        maxOutputTokens: isComplexMultiTrackOperation ? 4096 : 2048,
        temperature: 0.1, // Low temperature for consistent JSON structure
        topP: 0.8,
        topK: 40,
      };

      const result = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
        generationConfig,
      });
      const response = result.response.text();

      debugLog(`[COMMAND_PLAN_CREATION] AI Response: ${response}`);

      // Check if the response explicitly says it's conversational or indicates null
      const conversationalIndicators = [
        "null",
        "conversational",
        "no commands",
        "just chatting",
        "sharing preference",
        "expressing feeling",
      ];

      const responseText = response.toLowerCase();
      const isExplicitlyConversational = conversationalIndicators.some(
        (indicator) => responseText.includes(indicator)
      );

      if (isExplicitlyConversational && !responseText.includes('"commands"')) {
        debugLog(
          `[COMMAND_PLAN_CREATION] AI explicitly marked as conversational, returning null`
        );
        return null;
      }

      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const plan = JSON.parse(jsonMatch[0]) as AICommandPlan;
          debugLog(`[COMMAND_PLAN_CREATION] Parsed plan:`, plan);
          return plan;
        } catch (parseError) {
          // If JSON parsing fails, try to extract just the commands array if it exists
          debugLog(
            `[COMMAND_PLAN_CREATION] JSON parsing failed, trying to extract commands array:`,
            parseError
          );

          const commandsMatch = response.match(/"commands"\s*:\s*\[[\s\S]*?\]/);
          if (commandsMatch) {
            try {
              // Try to construct a minimal valid JSON with just the commands
              const commandsArray = JSON.parse(
                `{${commandsMatch[0]}}`
              ).commands;
              const fallbackPlan: AICommandPlan = {
                commands: commandsArray,
                reasoning:
                  "JSON response was truncated, extracted commands only",
                expectedOutcome: "Working my magic on your tracks! ✨🎵",
              };
              debugLog(
                `[COMMAND_PLAN_CREATION] Successfully extracted commands from malformed JSON:`,
                fallbackPlan
              );
              return fallbackPlan;
            } catch (commandsError) {
              debugLog(
                `[COMMAND_PLAN_CREATION] Failed to extract commands array:`,
                commandsError
              );
            }
          }

          // Enhanced fallback: try to recover from truncated reasoning field
          const truncatedReasoningMatch = response.match(
            /("reasoning"\s*:\s*"[^"]*)([\s\S]*)$/
          );
          if (truncatedReasoningMatch) {
            try {
              // Try to reconstruct the JSON by closing the truncated reasoning and adding missing fields
              const beforeReasoning = response.substring(
                0,
                response.indexOf('"reasoning"')
              );
              const reconstructedJson =
                beforeReasoning +
                '"reasoning": "Command execution", "expectedOutcome": "Colors applied!" }';

              const reconstructedPlan = JSON.parse(
                reconstructedJson
              ) as AICommandPlan;
              debugLog(
                `[COMMAND_PLAN_CREATION] Reconstructed from truncated reasoning:`,
                reconstructedPlan
              );
              return reconstructedPlan;
            } catch (reconstructError) {
              debugLog(
                `[COMMAND_PLAN_CREATION] Failed to reconstruct from truncated reasoning:`,
                reconstructError
              );
            }
          }

          // Enhanced final fallback: look for individual commands with better pattern matching
          const commandRegex =
            /"type"\s*:\s*"([^"]+)"[\s\S]*?"parameters"\s*:\s*\{[^}]*\}/g;

          // Also try to extract incomplete commands that might be cut off
          const incompleteCommandRegex =
            /"type"\s*:\s*"([^"]+)"[\s\S]*?"parameters"\s*:\s*\{[^}]*$/g;
          const recoveredCommands = [];
          let match;

          // First, try to extract complete commands
          while ((match = commandRegex.exec(response)) !== null) {
            try {
              const commandObj = JSON.parse(`{${match[0]}}`);
              const commandType = commandObj.type;
              const parameters = commandObj.parameters;

              // Generate appropriate description based on command type
              let description = `Execute ${commandType}`;
              if (
                commandType === "setTrackColor" &&
                parameters.trackName &&
                parameters.color
              ) {
                description = `Set ${parameters.trackName} to ${parameters.color}`;
              } else if (
                commandType === "setTrackVolume" &&
                parameters.trackName &&
                parameters.volume !== undefined
              ) {
                description = `Set ${parameters.trackName} volume to ${parameters.volume}%`;
              } else if (
                commandType === "setTrackPan" &&
                parameters.trackName &&
                parameters.pan !== undefined
              ) {
                description = `Pan ${parameters.trackName} to ${parameters.pan}`;
              } else if (commandType === "muteTrack" && parameters.trackName) {
                description = `Mute/unmute ${parameters.trackName}`;
              } else if (commandType === "soloTrack" && parameters.trackName) {
                description = `Solo/unsolo ${parameters.trackName}`;
              } else if (
                commandType === "renameTrack" &&
                parameters.currentName &&
                parameters.newName
              ) {
                description = `Rename ${parameters.currentName} to ${parameters.newName}`;
              } else if (commandType === "addTrack" && parameters.type) {
                description = `Add ${parameters.type} track${
                  parameters.name ? ` "${parameters.name}"` : ""
                }`;
              } else if (commandType === "sortTracks" && parameters.sortBy) {
                description = `Sort tracks by ${parameters.sortBy}`;
              }

              recoveredCommands.push({
                type: commandType,
                parameters: parameters,
                description: description,
                priority: recoveredCommands.length + 1,
              });
            } catch (e) {
              debugLog(
                `[COMMAND_PLAN_CREATION] Failed to parse individual command:`,
                e
              );
            }
          }

          // If no complete commands found, try to extract incomplete commands at the end
          if (recoveredCommands.length === 0) {
            incompleteCommandRegex.lastIndex = 0; // Reset regex
            while ((match = incompleteCommandRegex.exec(response)) !== null) {
              try {
                const commandType = match[1];

                // Try to extract common parameters for incomplete commands
                const paramMatch = match[0].match(
                  /"parameters"\s*:\s*\{([^}]*)/
                );
                if (paramMatch) {
                  const paramString = paramMatch[1];

                  // Try to extract trackName and color for setTrackColor commands
                  if (commandType === "setTrackColor") {
                    const trackNameMatch = paramString.match(
                      /"trackName"\s*:\s*"([^"]+)"/
                    );
                    const colorMatch = paramString.match(
                      /"color"\s*:\s*"([^"]+)"/
                    );

                    if (trackNameMatch && colorMatch) {
                      recoveredCommands.push({
                        type: commandType,
                        parameters: {
                          trackName: trackNameMatch[1],
                          color: colorMatch[1],
                        },
                        description: `Set ${trackNameMatch[1]} to ${colorMatch[1]}`,
                        priority: recoveredCommands.length + 1,
                      });
                    } else if (trackNameMatch) {
                      // Default color if missing
                      recoveredCommands.push({
                        type: commandType,
                        parameters: {
                          trackName: trackNameMatch[1],
                          color: "rose",
                        },
                        description: `Set ${trackNameMatch[1]} to rose`,
                        priority: recoveredCommands.length + 1,
                      });
                    }
                  }
                }
              } catch (e) {
                debugLog(
                  `[COMMAND_PLAN_CREATION] Failed to parse incomplete command:`,
                  e
                );
              }
            }
          }

          if (recoveredCommands.length > 0) {
            // Determine appropriate expected outcome based on command types
            let expectedOutcome = "Bringing your musical vision to life! 🎵✨";
            const commandTypes = recoveredCommands.map((c) => c.type);

            if (commandTypes.every((t) => t === "setTrackColor")) {
              expectedOutcome =
                "Painting your tracks with beautiful colors! 🌈🎨";
            } else if (
              commandTypes.includes("setTrackColor") &&
              commandTypes.length > 1
            ) {
              expectedOutcome =
                "Styling your tracks with colors and sonic magic! ✨🎵";
            } else if (
              commandTypes.includes("setTrackVolume") ||
              commandTypes.includes("setTrackPan")
            ) {
              expectedOutcome =
                "Fine-tuning your mix to sonic perfection! 🎛️🔊";
            } else if (commandTypes.includes("addTrack")) {
              expectedOutcome = "Expanding your musical canvas! 🎹🎼";
            } else if (commandTypes.includes("sortTracks")) {
              expectedOutcome =
                "Organizing your tracks for the perfect flow! 📋🎶";
            } else if (
              commandTypes.includes("muteTrack") ||
              commandTypes.includes("soloTrack")
            ) {
              expectedOutcome = "Sculpting your mix with precision! 🎚️🎭";
            } else if (
              commandTypes.includes("play") ||
              commandTypes.includes("pause")
            ) {
              expectedOutcome = "Taking control of your playback! ▶️⏸️";
            }

            const recoveryPlan: AICommandPlan = {
              commands: recoveredCommands,
              reasoning: `Recovered ${recoveredCommands.length} commands from malformed JSON response`,
              expectedOutcome: expectedOutcome,
            };
            debugLog(
              `[COMMAND_PLAN_CREATION] 🔧 JSON RECOVERY SUCCESS: Recovered ${recoveredCommands.length} commands from truncated response:`,
              recoveryPlan
            );
            return recoveryPlan;
          }
        }
      }

      debugLog(
        `[COMMAND_PLAN_CREATION] No JSON found in response, returning null`
      );

      // Store unrecognized request in Supabase for AI learning
      this.storeUnrecognizedRequest(
        userInput,
        "No valid command plan could be created",
        "AI could not parse or understand the request"
      ).catch((error) => {
        console.error(
          "[COMMAND_PLAN_CREATION] Failed to store unrecognized request:",
          error
        );
      });

      return null;
    } catch (error) {
      console.error("Error creating command plan:", error);
      debugLog(`[COMMAND_PLAN_CREATION] Error:`, error);

      // Store failed command plan creation in Supabase for AI learning
      this.storeUnrecognizedRequest(
        userInput,
        `Error creating command plan: ${error}`,
        "Command plan creation failed with exception"
      ).catch((storageError) => {
        console.error(
          "[COMMAND_PLAN_CREATION] Failed to store error in Supabase:",
          storageError
        );
      });

      return null;
    }
  }

  // New method: Execute AI-planned commands
  async executeCommandPlan(
    plan: AICommandPlan,
    dispatch: any,
    currentState: any,
    originalUserInput?: string
  ): Promise<AICommandResult> {
    // Performance optimization: skip state verification delays
    const executedCommands: string[] = [];
    const failedCommands: string[] = [];

    // Handle null commands
    if (!plan.commands || plan.commands.length === 0) {
      return {
        success: false,
        message: plan.expectedOutcome || "No commands to execute.",
        executedCommands: [],
        failedCommands: [],
      };
    }

    // BOTTOM TRACK VERIFICATION: Check for potential bottom track issues
    const currentTracks = store.getState().project.present.tracks;
    const trackColorCommands = plan.commands.filter(
      (cmd) => cmd.type === "setTrackColor"
    );

    if (trackColorCommands.length > 0 && originalUserInput) {
      const isAllTracksCommand =
        /\b(all|every|everything)\b.*\b(track|color)/i.test(originalUserInput);
      if (
        isAllTracksCommand &&
        trackColorCommands.length < currentTracks.length
      ) {
        debugLog(
          `[BOTTOM_TRACK_WARNING] Potential bottom track issue detected:`,
          {
            totalTracks: currentTracks.length,
            colorCommands: trackColorCommands.length,
            userInput: originalUserInput,
            missingTracks: currentTracks.length - trackColorCommands.length,
          }
        );

        // Add warning to failed commands for debugging
        failedCommands.push(
          `Warning: Only ${trackColorCommands.length} color commands for ${currentTracks.length} tracks - bottom track may be missing`
        );
      }
    }

    // Capture initial state for undo functionality
    const initialState = JSON.parse(JSON.stringify(store.getState()));
    const planId =
      plan.id ||
      `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Don't create snapshots for undo operations to prevent infinite loops
    const isUndoOperation = plan.id?.startsWith("undo-");
    const shouldCreateSnapshot = !isUndoOperation;

    debugLog(
      `[COMMAND_PLAN] Executing plan with ${plan.commands.length} commands:`,
      plan.commands.map((c) => `${c.type}(${JSON.stringify(c.parameters)})`)
    );

    // Sort commands by priority
    const sortedCommands = [...plan.commands].sort(
      (a, b) => a.priority - b.priority
    );

    for (const command of sortedCommands) {
      try {
        let success = false;
        let message = "";
        let commandImplemented = true;

        switch (command.type) {
          case "play":
            try {
              // Get fresh state to check current playing status
              const freshState = store.getState();
              if (!freshState.sonification.isPlaying) {
                dispatch(setPlaying(true));
                success = true;
                message = "Started playback";
              } else {
                message = "Already playing";
                success = true; // This is still considered successful
              }
            } catch (error) {
              message = "Error starting playback";
            }
            break;

          case "pause":
            try {
              const freshState = store.getState();
              if (freshState.sonification.isPlaying) {
                dispatch(setPlaying(false));
                success = true;
                message = "Paused playback";
              } else {
                message = "Already paused";
                success = true; // This is still considered successful
              }
            } catch (error) {
              message = "Error pausing playback";
            }
            break;

          case "setTempo":
            try {
              const tempo = Math.max(20, Math.min(300, command.parameters.bpm));
              const oldTempo = store.getState().project.present.tempo;
              dispatch(setTempo(tempo));
              // Assume success and verify immediately
              success = true;
              message = `Set tempo to ${tempo} BPM`;
            } catch (error) {
              message = `Error setting tempo: ${error}`;
            }
            break;

          case "toggleMetronome":
            try {
              const oldState = store.getState().sonification.isMetronomeEnabled;
              dispatch(toggleMetronome());
              // Assume success immediately
              success = true;
              message = `${!oldState ? "Enabled" : "Disabled"} metronome`;
            } catch (error) {
              message = `Error toggling metronome: ${error}`;
            }
            break;

          case "toggleCountIn":
            try {
              const oldState =
                store.getState().sonification.isCountInEnabledForRecording;
              dispatch(toggleCountInForRecording());
              // Assume success immediately
              success = true;
              message = `${
                !oldState ? "Enabled" : "Disabled"
              } count-in for recording`;
            } catch (error) {
              message = `Error toggling count-in: ${error}`;
            }
            break;

          case "addTrack":
            try {
              const trackType =
                command.parameters.type === "instrument"
                  ? TrackType.SOFTWARE_INSTRUMENT
                  : TrackType.AUDIO;
              const oldTrackCount =
                store.getState().project.present.tracks.length;
              const newTrackId = crypto.randomUUID();

              dispatch(
                addTrack({
                  type: trackType,
                  name: command.parameters.name,
                  id: newTrackId,
                })
              );

              // Assume success immediately
              success = true;
              message = `Added ${command.parameters.type} track${
                command.parameters.name ? ` "${command.parameters.name}"` : ""
              }`;
            } catch (error) {
              message = `Error adding track: ${error}`;
            }
            break;

          case "addNote":
            try {
              const {
                trackId,
                trackName,
                pitch,
                velocity,
                startTime,
                duration,
                measure,
              } = command.parameters;

              // Find the target track
              let freshTracks = store.getState().project.present.tracks;
              let targetTrack = freshTracks.find(
                (t: Track) => t.id === trackId
              );

              // If track doesn't exist, create a new instrument track
              if (!targetTrack) {
                console.log(`Creating new instrument track: ${trackName}`);
                const newTrackId = nanoid();

                // Create new instrument track
                dispatch(
                  addTrack({
                    type: TrackType.SOFTWARE_INSTRUMENT,
                    name: trackName,
                    id: newTrackId,
                  })
                );

                // Wait for the track to be created and get fresh state
                await new Promise((resolve) => setTimeout(resolve, 100));
                freshTracks = store.getState().project.present.tracks;
                targetTrack = freshTracks.find(
                  (t: Track) => t.id === newTrackId
                );

                if (!targetTrack) {
                  message = `Failed to create track "${trackName}"`;
                  break;
                }
              }

              if (targetTrack.type !== TrackType.SOFTWARE_INSTRUMENT) {
                message = `Track "${trackName}" is not a software instrument track`;
                break;
              }

              // Find or create a MIDI region at the target time
              let targetRegion = targetTrack.regions.find(
                (region: MidiRegion) => {
                  // Check if the note's start time falls within this region
                  const regionEnd =
                    region.startTime + (region.audioDuration || 4); // Default to 4 beats if no duration
                  return startTime >= region.startTime && startTime < regionEnd;
                }
              );

              if (!targetRegion) {
                // Create a new MIDI region starting at the measure
                const regionStartTime = Math.floor(startTime / 4) * 4; // Start at beginning of measure
                const newRegion: Omit<MidiRegion, "id" | "trackId"> = {
                  name: `Region ${measure || Math.floor(startTime / 4) + 1}`,
                  startTime: regionStartTime,
                  notes: [],
                  color: targetTrack.color,
                  audioDuration: 4, // Default to 1 measure
                };

                dispatch(
                  addMidiRegionAction({
                    trackId: targetTrack.id,
                    region: newRegion,
                  })
                );

                // Wait for region to be created and find it
                await new Promise((resolve) => setTimeout(resolve, 50));
                const updatedTracks = store.getState().project.present.tracks;
                const updatedTrack = updatedTracks.find(
                  (t: Track) => t.id === targetTrack.id
                );
                targetRegion = updatedTrack?.regions[
                  updatedTrack.regions.length - 1
                ] as MidiRegion;
              }

              if (targetRegion) {
                // Calculate note start time relative to the region
                const relativeStartTime = startTime - targetRegion.startTime;

                // Create the note
                const newNote: Omit<MidiNote, "id"> = {
                  pitch,
                  velocity,
                  startTime: relativeStartTime,
                  duration,
                };

                dispatch(
                  addNoteToRegion({
                    regionId: targetRegion.id,
                    note: newNote,
                  })
                );

                success = true;
                const noteName = this.midiNoteToName(pitch);
                const measureText = measure
                  ? ` in measure ${measure}`
                  : ` at beat ${startTime}`;
                message = `Added ${noteName} note to "${trackName}"${measureText}`;
              } else {
                message = `Failed to create region for note in track "${trackName}"`;
              }
            } catch (error) {
              message = `Error adding note: ${error}`;
            }
            break;

          case "duplicateTrack":
            try {
              const freshTracks = store.getState().project.present.tracks;
              const sourceTrack = freshTracks.find((t: Track) =>
                t.name
                  .toLowerCase()
                  .includes(command.parameters.trackName.toLowerCase())
              );

              if (sourceTrack) {
                const oldTrackCount = freshTracks.length;
                const newTrackId = crypto.randomUUID();
                const newTrackName =
                  command.parameters.newName || `${sourceTrack.name} copy`;

                dispatch(
                  addTrack({
                    type: sourceTrack.type,
                    name: newTrackName,
                    id: newTrackId,
                    instrumentId:
                      sourceTrack.type === TrackType.SOFTWARE_INSTRUMENT
                        ? (sourceTrack as SoftwareInstrumentTrack).instrumentId
                        : undefined,
                  })
                );

                // Assume success and apply settings in background
                const trackCreated = true;
                if (trackCreated) {
                  // Apply preserved settings - but don't wait for completion to report success
                  // The track creation itself is what we're verifying
                  setTimeout(() => {
                    try {
                      dispatch(
                        updateTrack({
                          id: newTrackId,
                          changes: {
                            volume: sourceTrack.volume,
                            pan: sourceTrack.pan,
                            color: sourceTrack.color,
                            height: sourceTrack.height,
                            isMuted: sourceTrack.isMuted,
                            inserts: sourceTrack.inserts
                              ? [...sourceTrack.inserts]
                              : undefined,
                          },
                        })
                      );

                      // Add regions if any
                      if (sourceTrack.regions.length > 0) {
                        sourceTrack.regions.forEach((region: MidiRegion) => {
                          const duplicatedRegion: MidiRegion = {
                            ...region,
                            id: crypto.randomUUID(),
                            trackId: newTrackId,
                            notes: region.notes.map((note: any) => ({
                              ...note,
                              id: crypto.randomUUID(),
                            })),
                          };
                          dispatch(
                            addMidiRegionAction({
                              trackId: newTrackId,
                              region: duplicatedRegion,
                            })
                          );
                        });
                      }
                    } catch (settingsError) {
                      console.error(
                        "Error applying duplicated track settings:",
                        settingsError
                      );
                    }
                  }, 100);

                  success = true;
                  message = `Duplicated "${sourceTrack.name}" as "${newTrackName}"`;
                } else {
                  message = "Failed to create duplicate track";
                }
              } else {
                message = `Track "${command.parameters.trackName}" not found`;
              }
            } catch (error) {
              message = `Error duplicating track: ${error}`;
            }
            break;

          case "setTrackColor":
            try {
              const freshTracks = store.getState().project.present.tracks;
              debugLog(
                `[COLOR_DEBUG] Looking for track "${command.parameters.trackName}" in ${freshTracks.length} tracks`
              );
              debugLog(
                `[COLOR_DEBUG] Available tracks: ${freshTracks
                  .map((t) => `"${t.name}"`)
                  .join(", ")}`
              );

              // Find track with exact match first, then fallback to partial match
              const searchName = command.parameters.trackName.toLowerCase();
              let colorTrack = freshTracks.find(
                (t: Track) => t.name.toLowerCase() === searchName
              );

              if (!colorTrack) {
                colorTrack = freshTracks.find((t: Track) =>
                  t.name.toLowerCase().includes(searchName)
                );
              }

              if (colorTrack) {
                debugLog(
                  `[COLOR_DEBUG] Found track "${colorTrack.name}" with current color: ${colorTrack.color}`
                );
                const normalizedColor = normalizeColor(
                  command.parameters.color
                );
                debugLog(
                  `[COLOR_DEBUG] Normalized color "${command.parameters.color}" to: ${normalizedColor}`
                );

                if (normalizedColor) {
                  const oldColor = colorTrack.color;
                  debugLog(
                    `[COLOR_DEBUG] Dispatching updateTrack with color change: ${oldColor} -> ${normalizedColor}`
                  );

                  dispatch(
                    updateTrack({
                      id: colorTrack.id,
                      changes: { color: normalizedColor },
                    })
                  );

                  // Verify color was changed with multiple attempts
                  let attempts = 0;
                  const maxAttempts = 3;
                  let colorChanged = false;

                  while (attempts < maxAttempts && !colorChanged) {
                    await new Promise((resolve) =>
                      setTimeout(resolve, 50 + attempts * 25)
                    );
                    const updatedTrack = store
                      .getState()
                      .project.present.tracks.find(
                        (t) => t.id === colorTrack.id
                      );

                    debugLog(
                      `[COLOR_DEBUG] Attempt ${
                        attempts + 1
                      }: Track color is now "${
                        updatedTrack?.color
                      }", expected "${normalizedColor}"`
                    );

                    if (
                      updatedTrack &&
                      updatedTrack.color === normalizedColor
                    ) {
                      colorChanged = true;
                      success = true;
                      message = `Set "${colorTrack.name}" color to ${command.parameters.color}`;
                      debugLog(`[COLOR_DEBUG] SUCCESS: Color change verified`);
                    }
                    attempts++;
                  }

                  if (!colorChanged) {
                    const finalTrack = store
                      .getState()
                      .project.present.tracks.find(
                        (t) => t.id === colorTrack.id
                      );
                    message = `Failed to set color for "${colorTrack.name}" - final color: ${finalTrack?.color}, expected: ${normalizedColor}`;
                    debugLog(
                      `[COLOR_DEBUG] FAILED: Color change not verified after ${maxAttempts} attempts`
                    );
                  }
                } else {
                  message = `Invalid color: ${command.parameters.color}`;
                  debugLog(
                    `[COLOR_DEBUG] ERROR: Color normalization failed for "${command.parameters.color}"`
                  );
                }
              } else {
                message = `Track "${command.parameters.trackName}" not found`;
                debugLog(`[COLOR_DEBUG] ERROR: Track not found`);
              }
            } catch (error) {
              message = `Error setting track color: ${error}`;
              debugLog(`[COLOR_DEBUG] EXCEPTION: ${error}`);
            }
            break;

          case "setTrackVolume":
            try {
              const freshTracks = store.getState().project.present.tracks;
              debugLog(
                `[VOLUME_DEBUG] Looking for track "${command.parameters.trackName}" in ${freshTracks.length} tracks`
              );
              debugLog(
                `[VOLUME_DEBUG] Available tracks: ${freshTracks
                  .map((t) => `"${t.name}"`)
                  .join(", ")}`
              );

              // Find track with exact match first, then fallback to partial match
              const searchName = command.parameters.trackName.toLowerCase();
              let track = freshTracks.find(
                (t: Track) => t.name.toLowerCase() === searchName
              );

              if (!track) {
                track = freshTracks.find((t: Track) =>
                  t.name.toLowerCase().includes(searchName)
                );
              }

              if (track) {
                debugLog(
                  `[VOLUME_DEBUG] Found track "${track.name}" with current volume: ${track.volume}%`
                );
                const volume = Math.max(
                  0,
                  Math.min(100, command.parameters.volume)
                );
                debugLog(
                  `[VOLUME_DEBUG] Setting volume from ${track.volume}% to ${volume}%`
                );

                dispatch(updateTrack({ id: track.id, changes: { volume } }));

                // Verify volume was set with multiple attempts
                let attempts = 0;
                const maxAttempts = 3;
                let volumeChanged = false;

                while (attempts < maxAttempts && !volumeChanged) {
                  await new Promise((resolve) =>
                    setTimeout(resolve, 50 + attempts * 25)
                  );
                  const updatedTrack = store
                    .getState()
                    .project.present.tracks.find((t) => t.id === track.id);

                  debugLog(
                    `[VOLUME_DEBUG] Attempt ${
                      attempts + 1
                    }: Track volume is now ${
                      updatedTrack?.volume
                    }%, expected ${volume}%`
                  );

                  if (updatedTrack && updatedTrack.volume === volume) {
                    volumeChanged = true;
                    success = true;
                    const muteNote = updatedTrack.isMuted
                      ? ` (Note: track is currently muted)`
                      : "";
                    message = `Set "${track.name}" volume to ${volume}%${muteNote}`;
                    debugLog(`[VOLUME_DEBUG] SUCCESS: Volume change verified`);
                  }
                  attempts++;
                }

                if (!volumeChanged) {
                  const finalTrack = store
                    .getState()
                    .project.present.tracks.find((t) => t.id === track.id);
                  message = `Failed to set volume for "${track.name}" - final volume: ${finalTrack?.volume}%, expected: ${volume}%`;
                  debugLog(
                    `[VOLUME_DEBUG] FAILED: Volume change not verified after ${maxAttempts} attempts`
                  );
                }
              } else {
                message = `Track "${command.parameters.trackName}" not found`;
                debugLog(`[VOLUME_DEBUG] ERROR: Track not found`);
              }
            } catch (error) {
              message = `Error setting track volume: ${error}`;
              debugLog(`[VOLUME_DEBUG] EXCEPTION: ${error}`);
            }
            break;

          case "setTrackPan":
            try {
              const freshTracks = store.getState().project.present.tracks;
              debugLog(
                `[PAN_DEBUG] Looking for track "${command.parameters.trackName}" in ${freshTracks.length} tracks`
              );
              debugLog(
                `[PAN_DEBUG] Available tracks: ${freshTracks
                  .map((t) => `"${t.name}"`)
                  .join(", ")}`
              );

              // Find track with exact match first, then fallback to partial match
              const searchName = command.parameters.trackName.toLowerCase();
              let panTrack = freshTracks.find(
                (t: Track) => t.name.toLowerCase() === searchName
              );

              if (!panTrack) {
                panTrack = freshTracks.find((t: Track) =>
                  t.name.toLowerCase().includes(searchName)
                );
              }

              if (panTrack) {
                debugLog(
                  `[PAN_DEBUG] Found track "${panTrack.name}" with current pan: ${panTrack.pan}`
                );
                const pan = Math.max(
                  -100,
                  Math.min(100, command.parameters.pan)
                );
                debugLog(
                  `[PAN_DEBUG] Setting pan from ${panTrack.pan} to ${pan}`
                );

                dispatch(updateTrack({ id: panTrack.id, changes: { pan } }));

                // Verify pan was set with multiple attempts
                let attempts = 0;
                const maxAttempts = 3;
                let panChanged = false;

                while (attempts < maxAttempts && !panChanged) {
                  await new Promise((resolve) =>
                    setTimeout(resolve, 50 + attempts * 25)
                  );
                  const updatedTrack = store
                    .getState()
                    .project.present.tracks.find((t) => t.id === panTrack.id);

                  debugLog(
                    `[PAN_DEBUG] Attempt ${attempts + 1}: Track pan is now ${
                      updatedTrack?.pan
                    }, expected ${pan}`
                  );

                  if (updatedTrack && updatedTrack.pan === pan) {
                    panChanged = true;
                    success = true;

                    // Create descriptive pan message
                    let panDescription = "";
                    if (pan === 0) {
                      panDescription = "center";
                    } else if (pan > 0) {
                      panDescription = `${pan} (right)`;
                    } else {
                      panDescription = `${pan} (left)`;
                    }

                    message = `Set "${panTrack.name}" pan to ${panDescription}`;
                    debugLog(`[PAN_DEBUG] SUCCESS: Pan change verified`);
                  }
                  attempts++;
                }

                if (!panChanged) {
                  const finalTrack = store
                    .getState()
                    .project.present.tracks.find((t) => t.id === panTrack.id);
                  message = `Failed to set pan for "${panTrack.name}" - final pan: ${finalTrack?.pan}, expected: ${pan}`;
                  debugLog(
                    `[PAN_DEBUG] FAILED: Pan change not verified after ${maxAttempts} attempts`
                  );
                }
              } else {
                message = `Track "${command.parameters.trackName}" not found`;
                debugLog(`[PAN_DEBUG] ERROR: Track not found`);
              }
            } catch (error) {
              message = `Error setting track pan: ${error}`;
              debugLog(`[PAN_DEBUG] EXCEPTION: ${error}`);
            }
            break;

          case "muteTrack":
            try {
              const freshTracks = store.getState().project.present.tracks;
              // Find track with exact match first, then fallback to partial match
              const searchName = command.parameters.trackName.toLowerCase();
              let muteTrack = freshTracks.find(
                (t: Track) => t.name.toLowerCase() === searchName
              );

              if (!muteTrack) {
                muteTrack = freshTracks.find((t: Track) =>
                  t.name.toLowerCase().includes(searchName)
                );
              }

              if (muteTrack) {
                const oldMuteState = muteTrack.isMuted;
                dispatch(toggleTrackMute(muteTrack.id));

                // Verify mute state changed
                await new Promise((resolve) => setTimeout(resolve, 50));
                const updatedTrack = store
                  .getState()
                  .project.present.tracks.find((t) => t.id === muteTrack.id);

                if (updatedTrack && updatedTrack.isMuted !== oldMuteState) {
                  success = true;
                  message = `${updatedTrack.isMuted ? "Muted" : "Unmuted"} "${
                    muteTrack.name
                  }"`;
                } else {
                  message = `Failed to toggle mute for "${muteTrack.name}"`;
                }
              } else {
                message = `Track "${command.parameters.trackName}" not found`;
              }
            } catch (error) {
              message = `Error toggling track mute: ${error}`;
            }
            break;

          case "soloTrack":
            try {
              const freshTracks = store.getState().project.present.tracks;
              const track = freshTracks.find((t: Track) =>
                t.name
                  .toLowerCase()
                  .includes(command.parameters.trackName.toLowerCase())
              );

              if (track) {
                const shouldSolo = command.parameters.shouldSolo !== false; // Default to true

                // Use the new soloTrack action that doesn't unsolo others
                dispatch(soloTrack({ trackId: track.id, shouldSolo }));

                // Verify the track solo state changed
                await new Promise((resolve) => setTimeout(resolve, 50));
                const updatedTrack = store
                  .getState()
                  .project.present.tracks.find((t) => t.id === track.id);

                if (updatedTrack) {
                  success = true;
                  message = updatedTrack.isSoloed
                    ? `Soloed track "${track.name}"`
                    : `Unsoloed track "${track.name}"`;
                } else {
                  message = `Failed to update solo state for track "${track.name}"`;
                }
              } else {
                message = `Track "${command.parameters.trackName}" not found`;
              }
            } catch (error) {
              message = `Error updating track solo: ${error}`;
            }
            break;

          case "unsoloAllTracks":
            try {
              dispatch(unsoloAllTracks());
              success = true;
              message = "Unsoloed all tracks";
            } catch (error) {
              message = `Error unsoloing all tracks: ${error}`;
            }
            break;

          case "renameProject":
            try {
              const oldName = store.getState().project.present.name;
              dispatch(setProjectName(command.parameters.newName));

              // Verify the project was renamed
              await new Promise((resolve) => setTimeout(resolve, 50));
              const newName = store.getState().project.present.name;

              if (newName === command.parameters.newName) {
                success = true;
                message = `Renamed project to "${command.parameters.newName}"`;
              } else {
                message = `Failed to rename project to "${command.parameters.newName}"`;
              }
            } catch (error) {
              message = `Error renaming project: ${error}`;
            }
            break;

          case "renameTrack":
            try {
              const freshTracks = store.getState().project.present.tracks;
              const renameTrack = freshTracks.find((t: Track) =>
                t.name
                  .toLowerCase()
                  .includes(command.parameters.currentName.toLowerCase())
              );

              if (renameTrack) {
                dispatch(
                  updateTrack({
                    id: renameTrack.id,
                    changes: { name: command.parameters.newName },
                  })
                );

                // Verify name was changed
                await new Promise((resolve) => setTimeout(resolve, 50));
                const updatedTrack = store
                  .getState()
                  .project.present.tracks.find((t) => t.id === renameTrack.id);

                if (
                  updatedTrack &&
                  updatedTrack.name === command.parameters.newName
                ) {
                  success = true;
                  message = `Renamed "${command.parameters.currentName}" to "${command.parameters.newName}"`;
                } else {
                  message = `Failed to rename track "${command.parameters.currentName}"`;
                }
              } else {
                message = `Track "${command.parameters.currentName}" not found`;
              }
            } catch (error) {
              message = `Error renaming track: ${error}`;
            }
            break;

          case "toggleLoop":
            try {
              const oldLoopState =
                store.getState().project.present.isCycleModeEnabled;
              console.log(
                `[LOOP_DEBUG] Toggling loop mode from ${oldLoopState}`
              );

              dispatch(toggleProjectCycleMode());

              // Verify loop state changed with multiple attempts
              let verificationAttempts = 0;
              let newLoopState = oldLoopState;

              while (verificationAttempts < 3) {
                await new Promise((resolve) => setTimeout(resolve, 50));
                newLoopState =
                  store.getState().project.present.isCycleModeEnabled;

                console.log(
                  `[LOOP_DEBUG] Toggle verification attempt ${
                    verificationAttempts + 1
                  }: ${oldLoopState} -> ${newLoopState}`
                );

                if (newLoopState !== oldLoopState) {
                  success = true;
                  message = `${
                    newLoopState ? "Enabled" : "Disabled"
                  } loop mode`;
                  break;
                }

                verificationAttempts++;
              }

              if (!success) {
                message = `Failed to toggle loop mode (stuck at ${newLoopState})`;
                console.log(
                  `[LOOP_DEBUG] Toggle failed after ${verificationAttempts} attempts`
                );
              }
            } catch (error) {
              console.error(`[LOOP_DEBUG] Error in toggleLoop:`, error);
              message = `Error toggling loop: ${error}`;
            }
            break;

          case "setLoopRange":
            try {
              let startBeat: number;
              let endBeat: number;

              // Handle time-based or measure-based parameters
              if (
                command.parameters.startTimeSeconds !== undefined &&
                command.parameters.endTimeSeconds !== undefined
              ) {
                // Time-based loop
                const currentTempo = currentState.tempo || 120;
                const beatsPerSecond = currentTempo / 60;
                startBeat =
                  command.parameters.startTimeSeconds * beatsPerSecond;
                endBeat = command.parameters.endTimeSeconds * beatsPerSecond;
              } else if (
                command.parameters.startMeasure !== undefined &&
                command.parameters.endMeasure !== undefined
              ) {
                // Measure-based loop
                const beatsPerMeasure =
                  currentState.timeSignature.numerator || 4;
                startBeat =
                  (command.parameters.startMeasure - 1) * beatsPerMeasure;
                endBeat = command.parameters.endMeasure * beatsPerMeasure;
              } else {
                throw new Error(
                  "Invalid parameters: must provide either startMeasure/endMeasure or startTimeSeconds/endTimeSeconds"
                );
              }

              // Get fresh loop state before making changes
              const initialState = store.getState().project.present;
              const wasLoopEnabled = initialState.isCycleModeEnabled;
              const initialStartBeat = initialState.cycleStart;
              const initialEndBeat = initialState.cycleEnd;

              const rangeDescription =
                command.parameters.startTimeSeconds !== undefined
                  ? `time ${command.parameters.startTimeSeconds}s-${command.parameters.endTimeSeconds}s`
                  : `measures ${command.parameters.startMeasure}-${command.parameters.endMeasure}`;

              console.log(
                `[LOOP_DEBUG] Setting loop range: ${rangeDescription} (beats ${startBeat}-${endBeat})`
              );
              console.log(
                `[LOOP_DEBUG] Initial state: loop=${wasLoopEnabled}, range=${initialStartBeat}-${initialEndBeat}`
              );

              // Step 1: Set the loop range
              dispatch(setCycleRange({ start: startBeat, end: endBeat }));

              // Wait for range to be set
              await new Promise((resolve) => setTimeout(resolve, 50));

              // Step 2: Enable loop mode if it wasn't already enabled
              const stateAfterRange = store.getState().project.present;
              if (!stateAfterRange.isCycleModeEnabled) {
                console.log(`[LOOP_DEBUG] Enabling loop mode...`);
                dispatch(toggleProjectCycleMode(true));
                await new Promise((resolve) => setTimeout(resolve, 50));
              }

              // Step 3: Verify everything worked with multiple checks
              let verificationAttempts = 0;
              let finalState = store.getState().project.present;

              // Give it up to 3 attempts with delays to ensure state has settled
              while (verificationAttempts < 3) {
                finalState = store.getState().project.present;
                const actualStartBeat = finalState.cycleStart;
                const actualEndBeat = finalState.cycleEnd;
                const isLoopEnabled = finalState.isCycleModeEnabled;

                const rangeSetCorrectly =
                  Math.abs(actualStartBeat - startBeat) < 0.01 &&
                  Math.abs(actualEndBeat - endBeat) < 0.01;

                console.log(
                  `[LOOP_DEBUG] Verification attempt ${
                    verificationAttempts + 1
                  }: loop=${isLoopEnabled}, range=${actualStartBeat}-${actualEndBeat}, rangeCorrect=${rangeSetCorrectly}`
                );

                if (rangeSetCorrectly && isLoopEnabled) {
                  success = true;
                  message = `Set loop range: ${rangeDescription} and enabled loop mode`;
                  break;
                }

                verificationAttempts++;
                if (verificationAttempts < 3) {
                  await new Promise((resolve) => setTimeout(resolve, 50));
                }
              }

              // If we got here without success, provide detailed failure info
              if (!success) {
                const actualStartBeat = finalState.cycleStart;
                const actualEndBeat = finalState.cycleEnd;
                const isLoopEnabled = finalState.isCycleModeEnabled;
                const rangeSetCorrectly =
                  Math.abs(actualStartBeat - startBeat) < 0.01 &&
                  Math.abs(actualEndBeat - endBeat) < 0.01;

                if (rangeSetCorrectly && !isLoopEnabled) {
                  message = `Set loop range to measures ${command.parameters.startMeasure}-${command.parameters.endMeasure} but failed to enable loop mode`;
                } else if (!rangeSetCorrectly && isLoopEnabled) {
                  message = `Enabled loop mode but failed to set range correctly (expected ${startBeat}-${endBeat}, got ${actualStartBeat}-${actualEndBeat})`;
                } else if (!rangeSetCorrectly && !isLoopEnabled) {
                  message = `Failed to set loop range and enable loop mode (expected ${startBeat}-${endBeat}, got ${actualStartBeat}-${actualEndBeat}, loop still ${
                    isLoopEnabled ? "on" : "off"
                  })`;
                } else {
                  message = `Unexpected state after loop range operation`;
                }

                console.log(`[LOOP_DEBUG] Final failure state: ${message}`);
              }
            } catch (error) {
              console.error(`[LOOP_DEBUG] Error in setLoopRange:`, error);
              message = `Error setting loop range: ${error}`;
            }
            break;

          case "startLooping":
            try {
              // Get fresh state before making changes
              const initialState = store.getState().project.present;
              const wasLoopEnabled = initialState.isCycleModeEnabled;
              const wasPlaying = store.getState().sonification.isPlaying;

              debugLog(
                `[LOOP_DEBUG] Starting loop mode - wasLoopEnabled: ${wasLoopEnabled}, wasPlaying: ${wasPlaying}`
              );

              // If range parameters provided, set the loop range first
              if (
                command.parameters.startMeasure &&
                command.parameters.endMeasure
              ) {
                const beatsPerMeasure =
                  currentState.timeSignature.numerator || 4;
                const startBeat =
                  (command.parameters.startMeasure - 1) * beatsPerMeasure;
                const endBeat = command.parameters.endMeasure * beatsPerMeasure;

                debugLog(
                  `[LOOP_DEBUG] Setting loop range: measures ${command.parameters.startMeasure}-${command.parameters.endMeasure} (beats ${startBeat}-${endBeat})`
                );
                dispatch(setCycleRange({ start: startBeat, end: endBeat }));
                await new Promise((resolve) => setTimeout(resolve, 50));
              }

              // Enable loop mode if not already enabled
              if (!wasLoopEnabled) {
                debugLog(`[LOOP_DEBUG] Enabling loop mode...`);
                dispatch(toggleProjectCycleMode(true));
                await new Promise((resolve) => setTimeout(resolve, 50));
              }

              // Start playback if not already playing
              if (!wasPlaying) {
                debugLog(`[LOOP_DEBUG] Starting playback...`);
                dispatch(setPlaying(true));
                await new Promise((resolve) => setTimeout(resolve, 50));
              }

              // Verify everything worked with multiple attempts
              let verificationAttempts = 0;
              let finalState = store.getState().project.present;
              let finalPlayingState = store.getState().sonification.isPlaying;

              while (verificationAttempts < 3) {
                finalState = store.getState().project.present;
                finalPlayingState = store.getState().sonification.isPlaying;

                const isLoopEnabled = finalState.isCycleModeEnabled;
                const isPlaying = finalPlayingState;

                debugLog(
                  `[LOOP_DEBUG] StartLooping verification attempt ${
                    verificationAttempts + 1
                  }: loop=${isLoopEnabled}, playing=${isPlaying}`
                );

                // Check if range was set correctly (if specified)
                let rangeSetCorrectly = true;
                if (
                  command.parameters.startMeasure &&
                  command.parameters.endMeasure
                ) {
                  const beatsPerMeasure =
                    currentState.timeSignature.numerator || 4;
                  const expectedStartBeat =
                    (command.parameters.startMeasure - 1) * beatsPerMeasure;
                  const expectedEndBeat =
                    command.parameters.endMeasure * beatsPerMeasure;
                  const actualStartBeat = finalState.cycleStart;
                  const actualEndBeat = finalState.cycleEnd;

                  rangeSetCorrectly =
                    Math.abs(actualStartBeat - expectedStartBeat) < 0.01 &&
                    Math.abs(actualEndBeat - expectedEndBeat) < 0.01;
                }

                if (isLoopEnabled && isPlaying && rangeSetCorrectly) {
                  success = true;
                  if (
                    command.parameters.startMeasure &&
                    command.parameters.endMeasure
                  ) {
                    message = `Started looping measures ${command.parameters.startMeasure}-${command.parameters.endMeasure}`;
                  } else {
                    message = "Started looping playback";
                  }
                  break;
                }

                verificationAttempts++;
                if (verificationAttempts < 3) {
                  await new Promise((resolve) => setTimeout(resolve, 50));
                }
              }

              // If we got here without success, provide detailed failure info
              if (!success) {
                const isLoopEnabled = finalState.isCycleModeEnabled;
                const isPlaying = finalPlayingState;

                let rangeSetCorrectly = true;
                let rangeMessage = "";
                if (
                  command.parameters.startMeasure &&
                  command.parameters.endMeasure
                ) {
                  const beatsPerMeasure =
                    currentState.timeSignature.numerator || 4;
                  const expectedStartBeat =
                    (command.parameters.startMeasure - 1) * beatsPerMeasure;
                  const expectedEndBeat =
                    command.parameters.endMeasure * beatsPerMeasure;
                  const actualStartBeat = finalState.cycleStart;
                  const actualEndBeat = finalState.cycleEnd;

                  rangeSetCorrectly =
                    Math.abs(actualStartBeat - expectedStartBeat) < 0.01 &&
                    Math.abs(actualEndBeat - expectedEndBeat) < 0.01;

                  if (!rangeSetCorrectly) {
                    rangeMessage = `, range incorrect (expected ${expectedStartBeat}-${expectedEndBeat}, got ${actualStartBeat}-${actualEndBeat})`;
                  }
                }

                if (!isLoopEnabled && !isPlaying) {
                  message = `Failed to enable loop mode and start playback${rangeMessage}`;
                } else if (!isLoopEnabled && isPlaying) {
                  message = `Started playback but failed to enable loop mode${rangeMessage}`;
                } else if (isLoopEnabled && !isPlaying) {
                  message = `Enabled loop mode but failed to start playback${rangeMessage}`;
                } else {
                  message = `Loop and playback enabled but other issues${rangeMessage}`;
                }

                debugLog(`[LOOP_DEBUG] StartLooping failed: ${message}`);
              }
            } catch (error) {
              console.error(`[LOOP_DEBUG] Error in startLooping:`, error);
              message = `Error starting looped playback: ${error}`;
            }
            break;

          case "movePlayhead":
            try {
              let targetBeat = 0;
              let targetDescription = "";

              if (command.parameters.position === "beginning") {
                targetBeat = 0;
                targetDescription = "beginning";
              } else if (typeof command.parameters.position === "number") {
                const beatsPerMeasure =
                  currentState.timeSignature.numerator || 4;
                targetBeat =
                  (command.parameters.position - 1) * beatsPerMeasure;
                targetDescription = `measure ${command.parameters.position}`;
              }

              dispatch(setPlayheadPosition(targetBeat));

              // Verify playhead was moved
              await new Promise((resolve) => setTimeout(resolve, 50));
              const newPlayheadPosition =
                store.getState().sonification.playheadPosition;

              if (Math.abs(newPlayheadPosition - targetBeat) < 0.01) {
                success = true;
                message = `Moved playhead to ${targetDescription}`;
              } else {
                message = `Failed to move playhead to ${targetDescription}`;
              }
            } catch (error) {
              message = `Error moving playhead: ${error}`;
            }
            break;

          case "setKeySignature":
            try {
              const newKey = command.parameters.key;
              const currentKey = store.getState().project.present.keySignature;

              debugLog(
                `[KEY_SIGNATURE_DEBUG] Setting key signature from "${currentKey}" to "${newKey}"`
              );

              dispatch(setKeySignature(newKey));

              // Verify key signature was set
              await new Promise((resolve) => setTimeout(resolve, 50));
              const updatedKey = store.getState().project.present.keySignature;

              if (updatedKey === newKey) {
                success = true;
                message = `Set key signature to ${newKey}`;
              } else {
                message = `Failed to set key signature to ${newKey}`;
              }
            } catch (error) {
              message = `Error setting key signature: ${error}`;
            }
            break;

          case "setTimeSignature":
            try {
              const numerator = command.parameters.numerator;
              const denominator = command.parameters.denominator;
              const currentTimeSignature =
                store.getState().project.present.timeSignature;

              debugLog(
                `[TIME_SIGNATURE_DEBUG] Setting time signature from ${currentTimeSignature.numerator}/${currentTimeSignature.denominator} to ${numerator}/${denominator}`
              );

              dispatch(setTimeSignature({ numerator, denominator }));

              // Verify time signature was set
              await new Promise((resolve) => setTimeout(resolve, 50));
              const updatedTimeSignature =
                store.getState().project.present.timeSignature;

              if (
                updatedTimeSignature.numerator === numerator &&
                updatedTimeSignature.denominator === denominator
              ) {
                success = true;
                message = `Set time signature to ${numerator}/${denominator}`;
              } else {
                message = `Failed to set time signature to ${numerator}/${denominator}`;
              }
            } catch (error) {
              message = `Error setting time signature: ${error}`;
            }
            break;

          case "zoomIn":
          case "zoomOut":
            try {
              const currentPixelsPerBeat =
                store.getState().ui.pianoRollSettings.pixelsPerBeat;
              let zoomFactor = 1.5; // Default zoom factor

              // Adjust zoom factor based on intensity
              if (command.parameters.intensity === "slight") {
                zoomFactor = 1.2;
              } else if (command.parameters.intensity === "moderate") {
                zoomFactor = 1.5;
              } else if (command.parameters.intensity === "maximum") {
                zoomFactor = 2.0;
              }

              const newPixelsPerBeat =
                command.type === "zoomIn"
                  ? Math.min(
                      MAX_PIXELS_PER_BEAT,
                      currentPixelsPerBeat * zoomFactor
                    )
                  : Math.max(
                      MIN_PIXELS_PER_BEAT,
                      currentPixelsPerBeat / zoomFactor
                    );

              dispatch(setPianoRollPixelsPerBeat(newPixelsPerBeat));

              // Verify zoom changed
              await new Promise((resolve) => setTimeout(resolve, 50));
              const updatedPixelsPerBeat =
                store.getState().ui.pianoRollSettings.pixelsPerBeat;

              if (Math.abs(updatedPixelsPerBeat - newPixelsPerBeat) < 0.01) {
                success = true;
                const intensityText = command.parameters.intensity
                  ? ` ${command.parameters.intensity}`
                  : "";
                message = `Zoomed ${
                  command.type === "zoomIn" ? "in" : "out"
                }${intensityText}`;
              } else {
                message = `Cannot zoom ${
                  command.type === "zoomIn" ? "in" : "out"
                } further - already at ${
                  command.type === "zoomIn" ? "maximum" : "minimum"
                } zoom`;
              }
            } catch (error) {
              message = `Error zooming: ${error}`;
            }
            break;

          case "zoomToFit":
            try {
              const beatsPerMeasure = currentState.timeSignature.numerator || 4;
              const totalProjectBeats =
                TOTAL_PROJECT_MEASURES * beatsPerMeasure;

              // Calculate available viewport width, accounting for sidebar
              const arrangeArea = document.querySelector(
                ".arrange-lanes-horizontal-scroll"
              );
              const baseViewportWidth = arrangeArea?.clientWidth || 800;

              // Account for sidebar width when it's open
              const sidebarWidth = currentState.isAiSidebarOpen ? 340 : 0;
              const effectiveViewportWidth = baseViewportWidth - sidebarWidth;

              debugLog(
                `[ZOOM_TO_FIT] Sidebar ${
                  currentState.isAiSidebarOpen ? "open" : "closed"
                }, effective width: ${effectiveViewportWidth}px`
              );

              if (totalProjectBeats > 0 && effectiveViewportWidth > 0) {
                const newPixelsPerBeat = Math.max(
                  MIN_PIXELS_PER_BEAT,
                  Math.min(
                    MAX_PIXELS_PER_BEAT,
                    effectiveViewportWidth / totalProjectBeats
                  )
                );

                dispatch(setPianoRollPixelsPerBeat(newPixelsPerBeat));
                dispatch(setPlayheadPosition(0)); // Move to beginning

                // Wait for zoom to apply, then scroll to beginning
                await new Promise((resolve) => setTimeout(resolve, 100));

                if (arrangeArea) {
                  (arrangeArea as HTMLElement).scrollLeft = 0;
                  debugLog(`[ZOOM_TO_FIT] Scrolled to beginning`);
                }

                success = true;
                message =
                  "Zoomed to fit entire project and scrolled to beginning";
              } else {
                message = "Cannot zoom to fit - project is empty";
              }
            } catch (error) {
              message = `Error zooming to fit: ${error}`;
            }
            break;

          case "zoomToMeasures":
            try {
              const beatsPerMeasure = currentState.timeSignature.numerator || 4;
              const startMeasure = command.parameters.startMeasure;
              const endMeasure = command.parameters.endMeasure;

              if (startMeasure > 0 && endMeasure >= startMeasure) {
                const beatsToFit =
                  (endMeasure - startMeasure + 1) * beatsPerMeasure;

                // Calculate available viewport width, accounting for sidebar
                const arrangeArea = document.querySelector(
                  ".arrange-lanes-horizontal-scroll"
                );
                const baseViewportWidth = arrangeArea?.clientWidth || 800;

                // Account for sidebar width when it's open
                const sidebarWidth = currentState.isAiSidebarOpen ? 340 : 0;
                const effectiveViewportWidth = baseViewportWidth - sidebarWidth;

                debugLog(
                  `[ZOOM_TO_MEASURES] Sidebar ${
                    currentState.isAiSidebarOpen ? "open" : "closed"
                  }, effective width: ${effectiveViewportWidth}px`
                );

                if (beatsToFit > 0 && effectiveViewportWidth > 0) {
                  const newPixelsPerBeat = Math.max(
                    MIN_PIXELS_PER_BEAT,
                    Math.min(
                      MAX_PIXELS_PER_BEAT,
                      effectiveViewportWidth / beatsToFit
                    )
                  );

                  dispatch(setPianoRollPixelsPerBeat(newPixelsPerBeat));

                  // Move playhead to start of the range
                  const startBeat = (startMeasure - 1) * beatsPerMeasure;
                  dispatch(setPlayheadPosition(startBeat));

                  // Apply scroll immediately after zoom
                  await new Promise((resolve) => setTimeout(resolve, 10));

                  if (arrangeArea) {
                    const scrollLeft = startBeat * newPixelsPerBeat;
                    (arrangeArea as HTMLElement).scrollLeft = scrollLeft;
                    debugLog(
                      `[ZOOM_TO_MEASURES] Scrolled to position ${scrollLeft} (beat ${startBeat})`
                    );
                  }

                  success = true;
                  message = `Zoomed to fit measures ${startMeasure}-${endMeasure} and scrolled to view`;
                } else {
                  message = "Invalid measure range for zoom";
                }
              } else {
                message =
                  "Invalid measure range - start must be positive and end must be >= start";
              }
            } catch (error) {
              message = `Error zooming to measures: ${error}`;
            }
            break;

          case "goToMeasure":
            try {
              const beatsPerMeasure = currentState.timeSignature.numerator || 4;
              const targetMeasure = command.parameters.measure;

              if (
                targetMeasure > 0 &&
                targetMeasure <= TOTAL_PROJECT_MEASURES
              ) {
                const targetBeat = (targetMeasure - 1) * beatsPerMeasure;
                dispatch(setPlayheadPosition(targetBeat));

                // Scroll to show the target measure at the beginning of viewport
                const arrangeArea = document.querySelector(
                  ".arrange-lanes-horizontal-scroll"
                );
                if (arrangeArea) {
                  const currentPixelsPerBeat =
                    store.getState().ui.pianoRollSettings.pixelsPerBeat;
                  const scrollLeft = targetBeat * currentPixelsPerBeat;
                  (arrangeArea as HTMLElement).scrollLeft = scrollLeft;
                  debugLog(
                    `[GO_TO_MEASURE] Scrolled to position ${scrollLeft} (beat ${targetBeat})`
                  );
                }

                success = true;
                message = `Moved to measure ${targetMeasure} and scrolled to view`;
              } else {
                message = `Invalid measure number - must be between 1 and ${TOTAL_PROJECT_MEASURES}`;
              }
            } catch (error) {
              message = `Error going to measure: ${error}`;
            }
            break;

          case "goToBeginning":
            try {
              dispatch(setPlayheadPosition(0));

              // Scroll to the beginning of the timeline
              const arrangeArea = document.querySelector(
                ".arrange-lanes-horizontal-scroll"
              );
              if (arrangeArea) {
                (arrangeArea as HTMLElement).scrollLeft = 0;
                debugLog(`[GO_TO_BEGINNING] Scrolled to beginning`);
              }

              success = true;
              message = "Moved to beginning and scrolled to view";
            } catch (error) {
              message = `Error going to beginning: ${error}`;
            }
            break;

          case "toggleRecordArm":
            try {
              const freshTracks = store.getState().project.present.tracks;
              const targetTrack = freshTracks.find((t: Track) =>
                t.name
                  .toLowerCase()
                  .includes(command.parameters.trackName.toLowerCase())
              );

              if (
                targetTrack &&
                (targetTrack.type === TrackType.AUDIO ||
                  targetTrack.type === TrackType.SOFTWARE_INSTRUMENT)
              ) {
                const oldArmState =
                  targetTrack.type === TrackType.AUDIO
                    ? (targetTrack as AudioTrack).isRecordArmed
                    : (targetTrack as SoftwareInstrumentTrack).isRecordArmed;

                dispatch(toggleTrackRecordArm(targetTrack.id));

                success = true;
                message = `${!oldArmState ? "Armed" : "Disarmed"} track "${
                  targetTrack.name
                }" for recording`;
              } else {
                message = `Track "${command.parameters.trackName}" not found or not recordable`;
              }
            } catch (error) {
              message = `Error toggling record arm: ${error}`;
            }
            break;

          case "toggleInputMonitoring":
            try {
              const freshTracks = store.getState().project.present.tracks;
              const targetTrack = freshTracks.find((t: Track) =>
                t.name
                  .toLowerCase()
                  .includes(command.parameters.trackName.toLowerCase())
              ) as AudioTrack;

              if (targetTrack && targetTrack.type === TrackType.AUDIO) {
                const oldMonitoringState = targetTrack.isInputMonitoringEnabled;

                dispatch(toggleTrackInputMonitoring(targetTrack.id));

                // Verify the input monitoring state changed
                await new Promise((resolve) => setTimeout(resolve, 50));
                const updatedTracks = store.getState().project.present.tracks;
                const updatedTrack = updatedTracks.find(
                  (t) => t.id === targetTrack.id
                ) as AudioTrack;

                if (updatedTrack) {
                  const newMonitoringState =
                    updatedTrack.isInputMonitoringEnabled;

                  if (newMonitoringState !== oldMonitoringState) {
                    success = true;
                    message = `${
                      newMonitoringState ? "Enabled" : "Disabled"
                    } input monitoring for track "${targetTrack.name}"`;
                  } else {
                    message = `Failed to toggle input monitoring for track "${targetTrack.name}"`;
                  }
                } else {
                  message = `Track "${targetTrack.name}" not found after update`;
                }
              } else {
                message = `Track "${command.parameters.trackName}" not found or not an audio track`;
              }
            } catch (error) {
              message = `Error toggling input monitoring: ${error}`;
            }
            break;

          case "startRecording":
            try {
              // Check if any tracks are armed for recording
              const freshTracks = store.getState().project.present.tracks;
              const armedAudioTracks = freshTracks.filter((t: Track) => {
                if (t.type === TrackType.AUDIO) {
                  return (t as AudioTrack).isRecordArmed;
                }
                return false;
              });

              if (armedAudioTracks.length === 0) {
                message =
                  "No audio tracks are armed for recording. Please arm an audio track first.";
                break;
              }

              const currentPlayheadPosition =
                store.getState().sonification.playheadPosition;
              const timeSignature =
                store.getState().project.present.timeSignature;
              const armedAudioTrackId = armedAudioTracks[0].id; // Use first armed audio track

              dispatch(
                startRecording({
                  beat: currentPlayheadPosition,
                  armedAudioTrackId,
                  timeSignatureNumerator: timeSignature.numerator,
                })
              );

              // Verify recording started (might take longer due to count-in)
              await new Promise((resolve) => setTimeout(resolve, 200));
              const recordingState = store.getState().sonification.isRecording;
              const countInRemaining =
                store.getState().sonification.countInBeatsRemaining;

              if (recordingState || countInRemaining > 0) {
                success = true;
                if (countInRemaining > 0) {
                  message = `Starting recording with count-in on ${armedAudioTracks.length} armed track(s)`;
                } else {
                  message = `Started recording on ${armedAudioTracks.length} armed track(s)`;
                }
              } else {
                message = "Failed to start recording";
              }
            } catch (error) {
              message = `Error starting recording: ${error}`;
            }
            break;

          case "stopRecording":
            try {
              const wasRecording = store.getState().sonification.isRecording;

              if (!wasRecording) {
                message = "Not currently recording";
                success = true; // This is still considered successful
                break;
              }

              dispatch(stopRecording());

              // Verify recording stopped
              await new Promise((resolve) => setTimeout(resolve, 100));
              const recordingState = store.getState().sonification.isRecording;

              if (!recordingState) {
                success = true;
                message = "Stopped recording";
              } else {
                message = "Failed to stop recording";
              }
            } catch (error) {
              message = `Error stopping recording: ${error}`;
            }
            break;

          case "undo":
            try {
              // Try command plan undo first
              const undoResult = await this.undoLastCommandPlan(dispatch);
              if (undoResult.success) {
                success = true;
                message = undoResult.message;
              } else {
                // Fallback to regular Redux undo if no command plan available
                dispatch(undoHistoryAction());
                await new Promise((resolve) => setTimeout(resolve, 50));
                success = true;
                message = "Undid last action";
              }
            } catch (error) {
              message = `Error undoing action: ${error}`;
            }
            break;

          case "redo":
            try {
              // For now, redo still uses the regular Redux system
              // TODO: Implement command plan redo functionality
              dispatch(redoHistoryAction());
              await new Promise((resolve) => setTimeout(resolve, 50));
              success = true;
              message = "Redid last undone action";
            } catch (error) {
              message = `Error redoing action: ${error}`;
            }
            break;

          case "selectTrack":
            try {
              const freshTracks = store.getState().project.present.tracks;
              const targetTrack = freshTracks.find((t: Track) =>
                t.name
                  .toLowerCase()
                  .includes(command.parameters.trackName.toLowerCase())
              );

              if (targetTrack) {
                dispatch(selectTrack({ trackId: targetTrack.id }));
                success = true;
                message = `Selected track "${targetTrack.name}"`;
              } else {
                message = `Track "${command.parameters.trackName}" not found`;
              }
            } catch (error) {
              message = `Error selecting track: ${error}`;
            }
            break;

          case "deleteTrack":
            try {
              const freshTracks = store.getState().project.present.tracks;
              const targetTrack = freshTracks.find((t: Track) =>
                t.name
                  .toLowerCase()
                  .includes(command.parameters.trackName.toLowerCase())
              );

              if (targetTrack) {
                const trackName = targetTrack.name;
                dispatch(removeTrack(targetTrack.id));
                success = true;
                message = `Deleted track "${trackName}"`;
              } else {
                message = `Track "${command.parameters.trackName}" not found`;
              }
            } catch (error) {
              message = `Error deleting track: ${error}`;
            }
            break;

          case "deleteAllTracks":
            try {
              const freshTracks = store.getState().project.present.tracks;
              if (freshTracks.length === 0) {
                success = true;
                message = "No tracks to delete";
              } else {
                const trackCount = freshTracks.length;
                const trackNames = freshTracks.map((t: Track) => t.name);

                // Delete all tracks in reverse order to avoid state race conditions
                // Create a copy of track IDs to avoid mutation during iteration
                const trackIds = [...freshTracks.map((t: Track) => t.id)];
                trackIds.reverse().forEach((trackId) => {
                  dispatch(removeTrack(trackId));
                });

                success = true;
                message = `Deleted all ${trackCount} tracks: ${trackNames.join(
                  ", "
                )}`;
              }
            } catch (error) {
              message = `Error deleting all tracks: ${error}`;
            }
            break;

          case "deleteRangeTracks":
            try {
              const startIndex = command.parameters.startIndex || 1;
              const endIndex = command.parameters.endIndex || 1;
              const freshTracks = store.getState().project.present.tracks;

              if (
                startIndex < 1 ||
                endIndex < 1 ||
                startIndex > freshTracks.length ||
                endIndex > freshTracks.length ||
                startIndex > endIndex
              ) {
                message = `Invalid range: tracks ${startIndex}-${endIndex}. Valid range is 1-${freshTracks.length}`;
                break;
              }

              // Convert to 0-based indexing
              const startIdx = startIndex - 1;
              const endIdx = endIndex - 1;

              // Get tracks to delete (in the specified range)
              const tracksToDelete = freshTracks.slice(startIdx, endIdx + 1);
              const trackNames = tracksToDelete.map((t) => t.name);

              // Delete tracks in reverse order to avoid index shifting issues
              for (let i = tracksToDelete.length - 1; i >= 0; i--) {
                dispatch(removeTrack(tracksToDelete[i].id));
              }

              success = true;
              message = `Deleted tracks ${startIndex}-${endIndex}: ${trackNames.join(
                ", "
              )}`;
            } catch (error) {
              message = `Error deleting track range: ${error}`;
            }
            break;

          case "restoreTrack":
            try {
              const trackData = command.parameters.trackData as Track;
              if (trackData) {
                // Restore the track with its original data
                dispatch(
                  addTrack({
                    type: trackData.type,
                    name: trackData.name,
                    id: trackData.id,
                    instrumentId:
                      trackData.type === TrackType.SOFTWARE_INSTRUMENT
                        ? (trackData as SoftwareInstrumentTrack).instrumentId
                        : undefined,
                  })
                );

                // Restore all the track properties
                setTimeout(() => {
                  dispatch(
                    updateTrack({
                      id: trackData.id,
                      changes: {
                        volume: trackData.volume,
                        pan: trackData.pan,
                        color: trackData.color,
                        height: trackData.height,
                        isMuted: trackData.isMuted,
                        isSoloed: trackData.isSoloed,
                        isRecordArmed: trackData.isRecordArmed,
                        // Add other properties as needed
                      },
                    })
                  );

                  // Restore regions if any
                  if (trackData.regions && trackData.regions.length > 0) {
                    trackData.regions.forEach((region: any) => {
                      if (region.type === "midi") {
                        dispatch(
                          addMidiRegionAction({
                            trackId: trackData.id,
                            region: region as MidiRegion,
                          })
                        );
                      }
                      // Add support for audio regions if needed
                    });
                  }
                }, 50);

                success = true;
                message = `Restored track "${trackData.name}"`;
              } else {
                message = "No track data provided for restoration";
              }
            } catch (error) {
              message = `Error restoring track: ${error}`;
            }
            break;

          case "restoreMultipleTracks":
            try {
              const tracksData = command.parameters.tracksData as Track[];
              if (tracksData && tracksData.length > 0) {
                let restoredCount = 0;
                const trackNames: string[] = [];

                // Restore each track
                for (const trackData of tracksData) {
                  try {
                    // Restore the track with its original data
                    dispatch(
                      addTrack({
                        type: trackData.type,
                        name: trackData.name,
                        id: trackData.id,
                        instrumentId:
                          trackData.type === TrackType.SOFTWARE_INSTRUMENT
                            ? (trackData as SoftwareInstrumentTrack)
                                .instrumentId
                            : undefined,
                      })
                    );

                    trackNames.push(trackData.name);
                    restoredCount++;
                  } catch (trackError) {
                    console.error(
                      `Error restoring track ${trackData.name}:`,
                      trackError
                    );
                  }
                }

                // Restore all track properties in a batch after a short delay
                setTimeout(() => {
                  tracksData.forEach((trackData) => {
                    try {
                      dispatch(
                        updateTrack({
                          id: trackData.id,
                          changes: {
                            volume: trackData.volume,
                            pan: trackData.pan,
                            color: trackData.color,
                            height: trackData.height,
                            isMuted: trackData.isMuted,
                            isSoloed: trackData.isSoloed,
                            isRecordArmed: trackData.isRecordArmed,
                          },
                        })
                      );

                      // Restore regions if any
                      if (trackData.regions && trackData.regions.length > 0) {
                        trackData.regions.forEach((region: any) => {
                          if (region.type === "midi") {
                            dispatch(
                              addMidiRegionAction({
                                trackId: trackData.id,
                                region: region as MidiRegion,
                              })
                            );
                          }
                        });
                      }
                    } catch (updateError) {
                      console.error(
                        `Error updating restored track ${trackData.name}:`,
                        updateError
                      );
                    }
                  });
                }, 50);

                success = restoredCount > 0;
                message =
                  restoredCount === tracksData.length
                    ? `Restored ${restoredCount} track(s): ${trackNames.join(
                        ", "
                      )}`
                    : `Restored ${restoredCount} of ${tracksData.length} track(s)`;
              } else {
                message = "No track data provided for restoration";
              }
            } catch (error) {
              message = `Error restoring tracks: ${error}`;
            }
            break;

          case "restoreMultipleTracksWithPositions":
            try {
              const tracksData = command.parameters.tracksData as (Track & {
                originalPosition: number;
              })[];
              if (tracksData && tracksData.length > 0) {
                let restoredCount = 0;
                const trackNames: string[] = [];

                // Sort tracks by original position to restore in correct order
                const sortedTracks = tracksData.sort(
                  (a, b) => a.originalPosition - b.originalPosition
                );

                // First, restore all tracks (they'll be added to the end)
                for (const trackData of sortedTracks) {
                  try {
                    // Restore the track with its original data
                    dispatch(
                      addTrack({
                        type: trackData.type,
                        name: trackData.name,
                        id: trackData.id,
                        instrumentId:
                          trackData.type === TrackType.SOFTWARE_INSTRUMENT
                            ? (trackData as SoftwareInstrumentTrack)
                                .instrumentId
                            : undefined,
                      })
                    );

                    trackNames.push(trackData.name);
                    restoredCount++;
                  } catch (trackError) {
                    console.error(
                      `Error restoring track ${trackData.name}:`,
                      trackError
                    );
                  }
                }

                // Wait for tracks to be added
                await new Promise((resolve) => setTimeout(resolve, 100));

                // Now reorder tracks to their original positions
                const currentTracks = store.getState().project.present.tracks;

                // Move each track to its correct position
                for (const trackData of sortedTracks) {
                  const currentIndex = currentTracks.findIndex(
                    (t) => t.id === trackData.id
                  );
                  const targetIndex = trackData.originalPosition;

                  if (
                    currentIndex !== -1 &&
                    targetIndex !== currentIndex &&
                    targetIndex < currentTracks.length
                  ) {
                    // Find the track that should be at the target position
                    const targetTrack = currentTracks[targetIndex];
                    if (targetTrack) {
                      dispatch(
                        reorderTracks({
                          draggedTrackId: trackData.id,
                          targetTrackId: targetTrack.id,
                          dropBeforeTarget: true,
                        })
                      );

                      // Update current tracks state for next iteration
                      const updatedTracks =
                        store.getState().project.present.tracks;
                      currentTracks.splice(
                        0,
                        currentTracks.length,
                        ...updatedTracks
                      );
                    }
                  }
                }

                // Restore all track properties in a batch after positioning
                setTimeout(() => {
                  tracksData.forEach((trackData) => {
                    try {
                      dispatch(
                        updateTrack({
                          id: trackData.id,
                          changes: {
                            volume: trackData.volume,
                            pan: trackData.pan,
                            color: trackData.color,
                            height: trackData.height,
                            isMuted: trackData.isMuted,
                            isSoloed: trackData.isSoloed,
                            isRecordArmed: trackData.isRecordArmed,
                          },
                        })
                      );

                      // Restore regions if any
                      if (trackData.regions && trackData.regions.length > 0) {
                        trackData.regions.forEach((region: any) => {
                          if (region.type === "midi") {
                            dispatch(
                              addMidiRegionAction({
                                trackId: trackData.id,
                                region: region as MidiRegion,
                              })
                            );
                          }
                        });
                      }
                    } catch (updateError) {
                      console.error(
                        `Error updating restored track ${trackData.name}:`,
                        updateError
                      );
                    }
                  });
                }, 150);

                success = restoredCount > 0;
                message =
                  restoredCount === tracksData.length
                    ? `Restored ${restoredCount} track(s) to original positions: ${trackNames.join(
                        ", "
                      )}`
                    : `Restored ${restoredCount} of ${tracksData.length} track(s)`;
              } else {
                message = "No track data provided for restoration";
              }
            } catch (error) {
              message = `Error restoring tracks with positions: ${error}`;
            }
            break;

          case "moveTrackToTop":
            try {
              const trackName = command.parameters.trackName;
              const freshTracks = store.getState().project.present.tracks;
              const targetTrack = freshTracks.find((t: Track) =>
                t.name.toLowerCase().includes(trackName.toLowerCase())
              );

              if (targetTrack && freshTracks.length > 1) {
                const currentIndex = freshTracks.findIndex(
                  (t) => t.id === targetTrack.id
                );
                if (currentIndex > 0) {
                  // Move to top (position 0)
                  const topTrack = freshTracks[0];
                  dispatch(
                    reorderTracks({
                      draggedTrackId: targetTrack.id,
                      targetTrackId: topTrack.id,
                      dropBeforeTarget: true,
                    })
                  );
                  success = true;
                  message = `Moved "${targetTrack.name}" to the top`;
                } else {
                  success = true;
                  message = `"${targetTrack.name}" is already at the top`;
                }
              } else if (!targetTrack) {
                message = `Track "${trackName}" not found`;
              } else {
                success = true;
                message = `"${targetTrack.name}" is the only track`;
              }
            } catch (error) {
              message = `Error moving track to top: ${error}`;
            }
            break;

          case "moveTrackToBottom":
            try {
              const trackName = command.parameters.trackName;
              const freshTracks = store.getState().project.present.tracks;
              const targetTrack = freshTracks.find((t: Track) =>
                t.name.toLowerCase().includes(trackName.toLowerCase())
              );

              if (targetTrack && freshTracks.length > 1) {
                const currentIndex = freshTracks.findIndex(
                  (t) => t.id === targetTrack.id
                );
                const lastIndex = freshTracks.length - 1;
                if (currentIndex < lastIndex) {
                  // Move to bottom (last position)
                  const bottomTrack = freshTracks[lastIndex];
                  dispatch(
                    reorderTracks({
                      draggedTrackId: targetTrack.id,
                      targetTrackId: bottomTrack.id,
                      dropBeforeTarget: false,
                    })
                  );
                  success = true;
                  message = `Moved "${targetTrack.name}" to the bottom`;
                } else {
                  success = true;
                  message = `"${targetTrack.name}" is already at the bottom`;
                }
              } else if (!targetTrack) {
                message = `Track "${trackName}" not found`;
              } else {
                success = true;
                message = `"${targetTrack.name}" is the only track`;
              }
            } catch (error) {
              message = `Error moving track to bottom: ${error}`;
            }
            break;

          case "moveTrackToPosition":
            try {
              const trackName = command.parameters.trackName;
              const targetPosition = command.parameters.targetPosition || 1;
              const freshTracks = store.getState().project.present.tracks;
              const targetTrack = freshTracks.find((t: Track) =>
                t.name.toLowerCase().includes(trackName.toLowerCase())
              );

              if (
                targetTrack &&
                targetPosition > 0 &&
                targetPosition <= freshTracks.length
              ) {
                const currentIndex = freshTracks.findIndex(
                  (t) => t.id === targetTrack.id
                );
                const targetIndex = targetPosition - 1; // Convert to 0-based index

                if (currentIndex !== targetIndex) {
                  const destinationTrack = freshTracks[targetIndex];
                  const dropBefore = currentIndex > targetIndex;

                  dispatch(
                    reorderTracks({
                      draggedTrackId: targetTrack.id,
                      targetTrackId: destinationTrack.id,
                      dropBeforeTarget: dropBefore,
                    })
                  );
                  success = true;
                  message = `Moved "${targetTrack.name}" to position ${targetPosition}`;
                } else {
                  success = true;
                  message = `"${targetTrack.name}" is already at position ${targetPosition}`;
                }
              } else if (!targetTrack) {
                message = `Track "${trackName}" not found`;
              } else {
                message = `Invalid position ${targetPosition}. Valid range is 1-${freshTracks.length}`;
              }
            } catch (error) {
              message = `Error moving track to position: ${error}`;
            }
            break;

          case "clearSelection":
            try {
              dispatch(selectTracksAndRegions({ trackIds: [], regionIds: [] }));
              success = true;
              message = "Cleared track selection";
            } catch (error) {
              message = `Error clearing selection: ${error}`;
            }
            break;

          case "selectAllTracks":
            try {
              const freshTracks = store.getState().project.present.tracks;
              const allTrackIds = freshTracks.map((track) => track.id);
              dispatch(
                selectTracksAndRegions({ trackIds: allTrackIds, regionIds: [] })
              );
              success = true;
              message = `Selected all ${freshTracks.length} tracks`;
            } catch (error) {
              message = `Error selecting all tracks: ${error}`;
            }
            break;

          case "goToTime":
            try {
              const targetTime = command.parameters.targetTime || 0;
              const beatsPerSecond =
                (((currentState.tempo || 120) / 60) *
                  (currentState.timeSignature.numerator || 4)) /
                4;
              const targetBeat = targetTime * beatsPerSecond;

              dispatch(setPlayheadPosition(targetBeat));

              // Verify playhead was moved
              await new Promise((resolve) => setTimeout(resolve, 50));
              const newPlayheadPosition =
                store.getState().sonification.playheadPosition;

              if (Math.abs(newPlayheadPosition - targetBeat) < 0.1) {
                success = true;
                message = `Moved playhead to ${targetTime} seconds`;
              } else {
                message = `Failed to move playhead to ${targetTime} seconds`;
              }
            } catch (error) {
              message = `Error moving to time: ${error}`;
            }
            break;

          case "goToBar":
            try {
              const targetBar = command.parameters.targetBar || 1;
              const beatsPerMeasure = currentState.timeSignature.numerator || 4;
              const targetBeat = (targetBar - 1) * beatsPerMeasure;

              dispatch(setPlayheadPosition(targetBeat));

              // Verify playhead was moved
              await new Promise((resolve) => setTimeout(resolve, 50));
              const newPlayheadPosition =
                store.getState().sonification.playheadPosition;

              if (Math.abs(newPlayheadPosition - targetBeat) < 0.1) {
                success = true;
                message = `Moved playhead to bar ${targetBar}`;
              } else {
                message = `Failed to move playhead to bar ${targetBar}`;
              }
            } catch (error) {
              message = `Error moving to bar: ${error}`;
            }
            break;

          case "skipForward":
          case "skipBackward":
            try {
              const currentPlayheadPosition =
                store.getState().sonification.playheadPosition;
              const skipAmount = command.parameters.skipAmount || 1;
              const skipUnit = command.parameters.skipUnit || "seconds";

              let skipBeats = 0;
              if (skipUnit === "seconds") {
                const beatsPerSecond =
                  (((currentState.tempo || 120) / 60) *
                    (currentState.timeSignature.numerator || 4)) /
                  4;
                skipBeats = skipAmount * beatsPerSecond;
              } else if (skipUnit === "bars") {
                const beatsPerMeasure =
                  currentState.timeSignature.numerator || 4;
                skipBeats = skipAmount * beatsPerMeasure;
              } else if (skipUnit === "beats") {
                skipBeats = skipAmount;
              }

              const direction = command.type === "skipForward" ? 1 : -1;
              const targetBeat = Math.max(
                0,
                currentPlayheadPosition + skipBeats * direction
              );

              dispatch(setPlayheadPosition(targetBeat));

              // Verify playhead was moved
              await new Promise((resolve) => setTimeout(resolve, 50));
              const newPlayheadPosition =
                store.getState().sonification.playheadPosition;

              if (Math.abs(newPlayheadPosition - targetBeat) < 0.1) {
                success = true;
                message = `Skipped ${
                  command.type === "skipForward" ? "forward" : "backward"
                } ${skipAmount} ${skipUnit}`;
              } else {
                message = `Failed to skip ${
                  command.type === "skipForward" ? "forward" : "backward"
                }`;
              }
            } catch (error) {
              message = `Error skipping: ${error}`;
            }
            break;

          case "jumpToStart":
            try {
              dispatch(setPlayheadPosition(0));

              // Verify playhead was moved
              await new Promise((resolve) => setTimeout(resolve, 50));
              const newPlayheadPosition =
                store.getState().sonification.playheadPosition;

              if (newPlayheadPosition < 0.1) {
                success = true;
                message = "Jumped to project start";
              } else {
                message = "Failed to jump to project start";
              }
            } catch (error) {
              message = `Error jumping to start: ${error}`;
            }
            break;

          case "jumpToEnd":
            try {
              const maxProjectBeats =
                TOTAL_PROJECT_MEASURES *
                (currentState.timeSignature.numerator || 4);
              const targetBeat = Math.max(0, maxProjectBeats - 0.1);

              dispatch(setPlayheadPosition(targetBeat));

              // Verify playhead was moved
              await new Promise((resolve) => setTimeout(resolve, 50));
              const newPlayheadPosition =
                store.getState().sonification.playheadPosition;

              if (Math.abs(newPlayheadPosition - targetBeat) < 0.1) {
                success = true;
                message = "Jumped to project end";
              } else {
                message = "Failed to jump to project end";
              }
            } catch (error) {
              message = `Error jumping to end: ${error}`;
            }
            break;

          case "sortTracks":
            try {
              const { reorderTracks } = await import("../store");
              // clone the tracks array so we can safely work with a mutable copy
              let currentTracks = [...store.getState().project.present.tracks];

              if (currentTracks.length <= 1) {
                success = true;
                message = "No tracks to sort (need at least 2 tracks)";
                break;
              }

              const sortBy = command.parameters.sortBy || "name";
              const sortDirection = command.parameters.sortDirection || "asc";
              const customSortLogic = command.parameters.customSortLogic;

              // Create a copy of tracks with their original indices
              const tracksWithIndex = currentTracks.map((track, index) => ({
                ...track,
                originalIndex: index,
              }));

              // Sort the tracks based on the criteria
              tracksWithIndex.sort((a, b) => {
                let comparison = 0;

                if (customSortLogic) {
                  // Use custom sort logic provided by AI analysis
                  switch (customSortLogic) {
                    case "regionCount":
                      comparison = a.regions.length - b.regions.length;
                      break;
                    case "totalRegionDuration":
                      const getDuration = (track: Track) =>
                        track.regions.reduce(
                          (total, region) =>
                            total +
                            (region.audioDuration ||
                              (region.notes.length > 0
                                ? Math.max(
                                    ...region.notes.map(
                                      (n) => n.startTime + n.duration
                                    )
                                  )
                                : 0)),
                          0
                        );
                      comparison = getDuration(a) - getDuration(b);
                      break;
                    case "complexity":
                      // Sort by number of notes in MIDI regions
                      const getComplexity = (track: Track) =>
                        track.regions.reduce(
                          (total, region) => total + region.notes.length,
                          0
                        );
                      comparison = getComplexity(a) - getComplexity(b);
                      break;
                    case "activity":
                      // Sort by how many unique beat positions have notes
                      const getActivity = (track: Track) => {
                        const uniqueBeats = new Set();
                        track.regions.forEach((region) => {
                          region.notes.forEach((note) => {
                            uniqueBeats.add(Math.floor(note.startTime));
                          });
                        });
                        return uniqueBeats.size;
                      };
                      comparison = getActivity(a) - getActivity(b);
                      break;
                    default:
                      // For any other property, try to access it directly
                      const aValue = (a as any)[customSortLogic];
                      const bValue = (b as any)[customSortLogic];
                      if (aValue !== undefined && bValue !== undefined) {
                        comparison =
                          typeof aValue === "string"
                            ? aValue.localeCompare(bValue)
                            : aValue - bValue;
                      }
                  }
                } else {
                  // Use standard sorting criteria
                  switch (sortBy) {
                    case "name":
                      comparison = a.name.localeCompare(b.name, undefined, {
                        numeric: true,
                        sensitivity: "base",
                      });
                      break;
                    case "type":
                      const typeOrder = {
                        [TrackType.AUDIO]: 0,
                        [TrackType.SOFTWARE_INSTRUMENT]: 1,
                      };
                      comparison =
                        (typeOrder[a.type] || 0) - (typeOrder[b.type] || 0);
                      break;
                    case "color":
                      comparison = a.color.localeCompare(b.color);
                      break;
                    case "volume":
                      comparison = a.volume - b.volume;
                      break;
                    case "creation":
                    default:
                      comparison = a.originalIndex - b.originalIndex;
                      break;
                  }
                }

                // Secondary sort by name if primary comparison is equal
                if (comparison === 0 && sortBy !== "name") {
                  comparison = a.name.localeCompare(b.name);
                }

                return sortDirection === "desc" ? -comparison : comparison;
              });

              // Apply the reordering by moving tracks one by one
              for (let i = 0; i < tracksWithIndex.length; i++) {
                const track = tracksWithIndex[i];
                const currentIndex = currentTracks.findIndex(
                  (t) => t.id === track.id
                );

                if (currentIndex !== i) {
                  // Move this track to position i
                  const targetTrack = currentTracks[i];
                  if (targetTrack && targetTrack.id !== track.id) {
                    dispatch(
                      reorderTracks({
                        draggedTrackId: track.id,
                        targetTrackId: targetTrack.id,
                        dropBeforeTarget: true,
                      })
                    );

                    // Refresh the local snapshot after the store updates
                    const updatedTracks = [
                      ...store.getState().project.present.tracks,
                    ];
                    currentTracks = updatedTracks;
                  }
                }
              }

              const getSortLabel = () => {
                if (customSortLogic) {
                  switch (customSortLogic) {
                    case "regionCount":
                      return "number of regions";
                    case "totalRegionDuration":
                      return "total duration";
                    case "complexity":
                      return "complexity (note count)";
                    case "activity":
                      return "activity (unique beats)";
                    default:
                      return customSortLogic
                        .replace(/([A-Z])/g, " $1")
                        .toLowerCase();
                  }
                }
                return sortBy === "name"
                  ? "name"
                  : sortBy === "type"
                  ? "track type"
                  : sortBy === "color"
                  ? "color"
                  : sortBy === "volume"
                  ? "volume"
                  : "creation order";
              };

              const directionLabel =
                sortDirection === "desc" ? "descending" : "ascending";

              success = true;
              message = `Sorted ${
                currentTracks.length
              } tracks by ${getSortLabel()} (${directionLabel})`;
            } catch (error) {
              message = `Error sorting tracks: ${error}`;
            }
            break;

          case "sortProjects":
            try {
              // Import the project page controls
              const { sortProjectsBy, getProjectPageControls } = await import(
                "../utils/projectPageControls"
              );
              const { setCurrentAppView } = await import("../store");

              const sortBy = command.parameters.sortBy || "date";
              const sortDirection = command.parameters.sortDirection || "desc";
              const sortLabel =
                sortBy === "name"
                  ? sortDirection === "asc"
                    ? "Name (A-Z)"
                    : "Name (Z-A)"
                  : sortDirection === "asc"
                  ? "Last Modified (Oldest)"
                  : "Last Modified (Newest)";

              const controls = getProjectPageControls();
              if (controls) {
                // If we're on the projects page, apply the sort directly
                const applied = sortProjectsBy(
                  sortBy as any,
                  sortDirection as any
                );
                if (applied) {
                  message = `Projects sorted by ${sortLabel}.`;
                  success = true;
                } else {
                  message = `To sort projects by ${sortLabel}, please go to the Projects page first.`;
                  success = false;
                }
              } else {
                // Navigate to projects page first, then show instructions
                message = `Navigating to Projects page to sort by ${sortLabel}. Use the "Sort" dropdown to change sorting options.`;
                dispatch(setCurrentAppView("projects"));
                success = true;
              }
            } catch (error) {
              message = `Project management features are available on the Projects page. Please navigate to the Projects page to sort projects.`;
              success = false;
            }
            break;

          case "filterProjects":
            try {
              // Import the project page controls
              const { filterProjectsByStatus, getProjectPageControls } =
                await import("../utils/projectPageControls");
              const { setCurrentAppView } = await import("../store");

              const status = command.parameters.status || "all";
              const statusLabel =
                status === "in-progress"
                  ? "In Progress"
                  : status === "backburner"
                  ? "Backburner"
                  : status === "published"
                  ? "Published"
                  : "All Statuses";

              const controls = getProjectPageControls();
              if (controls) {
                // If we're on the projects page, apply the filter directly
                const applied = filterProjectsByStatus(status as any);
                if (applied) {
                  message = `Projects filtered to show ${statusLabel} projects.`;
                  success = true;
                } else {
                  message = `To filter projects by ${statusLabel} status, please go to the Projects page first.`;
                  success = false;
                }
              } else {
                // Navigate to projects page first, then show instructions
                message = `Navigating to Projects page to filter by ${statusLabel} status. Use the "Status" dropdown to change filter options.`;
                dispatch(setCurrentAppView("projects"));
                success = true;
              }
            } catch (error) {
              message = `Project management features are available on the Projects page. Please navigate to the Projects page to filter projects.`;
              success = false;
            }
            break;

          case "searchProjects":
            try {
              // Import the project page controls
              const { searchProjects, getProjectPageControls } = await import(
                "../utils/projectPageControls"
              );
              const { setCurrentAppView } = await import("../store");

              const searchTerm = command.parameters.searchTerm || "";

              const controls = getProjectPageControls();
              if (controls && searchTerm) {
                // If we're on the projects page, apply the search directly
                const applied = searchProjects(searchTerm);
                if (applied) {
                  message = `Searching projects for "${searchTerm}".`;
                  success = true;
                } else {
                  message = `To search for projects containing "${searchTerm}", please go to the Projects page first.`;
                  success = false;
                }
              } else if (searchTerm) {
                // Navigate to projects page first, then show instructions
                message = `Navigating to Projects page to search for "${searchTerm}". Use the search bar to find projects by name.`;
                dispatch(setCurrentAppView("projects"));
                success = true;
              } else {
                message = `To search for projects, please specify a search term. For example: "search for my song"`;
                success = false;
              }
            } catch (error) {
              message = `Project management features are available on the Projects page. Please navigate to the Projects page to search projects.`;
              success = false;
            }
            break;

          case "openProject":
            try {
              // Import the necessary functions and types at the top of the function
              const {
                fetchProjectsFromSupabase,
                fetchProjectDetailsFromSupabase,
              } = await import("../supabaseClient");
              const { setCurrentAppView, loadFullProjectState } = await import(
                "../store"
              );

              const projectName = command.parameters.projectName;
              if (!projectName) {
                message = "Project name is required to open a project.";
                success = false;
                break;
              }

              // First, fetch all projects to find the one with matching name
              const { data: projects, error: fetchError } =
                await fetchProjectsFromSupabase();
              if (fetchError) {
                message = `Couldn't load projects list: ${fetchError.message}`;
                success = false;
                break;
              }

              // Find project by name (case-insensitive)
              const targetProject = projects?.find(
                (p) =>
                  p.name.toLowerCase().includes(projectName.toLowerCase()) ||
                  projectName.toLowerCase().includes(p.name.toLowerCase())
              );

              if (!targetProject) {
                const availableProjects =
                  projects?.map((p) => p.name).join(", ") || "none";
                message = `Couldn't find a project matching "${projectName}". Available projects: ${availableProjects}`;
                success = false;
                break;
              }

              // Load the project details
              const { data: projectData, error: loadError } =
                await fetchProjectDetailsFromSupabase(targetProject.id);
              if (loadError || !projectData) {
                message = `Error loading project "${targetProject.name}": ${
                  loadError?.message || "Project not found."
                }`;
                success = false;
                break;
              }

              // Load the project and navigate to DAW
              dispatch(loadFullProjectState(projectData));
              dispatch(setCurrentAppView("daw"));

              message = `Successfully opened project "${targetProject.name}"!`;
              success = true;
            } catch (error) {
              console.error("Error opening project:", error);
              message = `Couldn't open the project. ${error}`;
              success = false;
            }
            break;

          case "navigateToProjects":
            try {
              const { setCurrentAppView } = await import("../store");
              dispatch(setCurrentAppView("projects"));
              message = "Navigated to the Projects page!";
              success = true;
            } catch (error) {
              console.error("Error navigating to projects:", error);
              message = `Couldn't navigate to the Projects page. ${error}`;
              success = false;
            }
            break;

          case "showUserData":
            try {
              console.log(
                `[USER_DATA_MODAL] 🎯 Executing showUserData command - opening modal...`
              );
              const { toggleUserDataModal } = await import("../store");
              dispatch(toggleUserDataModal(true));
              console.log(
                `[USER_DATA_MODAL] ✅ Modal toggle dispatched successfully!`
              );
              message = "Opening your AI learning data overview!";
              success = true;
            } catch (error) {
              console.error("Error showing user data:", error);
              message = `Couldn't open your data overview. ${error}`;
              success = false;
            }
            break;

          default:
            commandImplemented = false;
            message = this.getMusicallyFriendlyMessage(
              command.type,
              command.description
            );
            this.failedCommandTracker.addFailedCommand(
              originalUserInput || "Unknown input",
              command.type,
              "Command not implemented",
              `Attempted command: ${JSON.stringify(command)}`
            );
            break;
        }

        if (success && commandImplemented) {
          executedCommands.push(`${command.description}: ${message}`);
        } else {
          failedCommands.push(`${command.description}: ${message}`);

          // Track failed commands for analysis
          if (!commandImplemented) {
            this.failedCommandTracker.addFailedCommand(
              originalUserInput || "Unknown input",
              command.type,
              message,
              `Parameters: ${JSON.stringify(command.parameters)}`
            );
          }
        }

        // Small delay between commands for better UX
        if (sortedCommands.indexOf(command) < sortedCommands.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`Error executing command ${command.type}:`, error);

        // Create user-friendly error messages based on command type
        let userFriendlyError = "Something went wrong with this action";

        if (command.type.includes("Track") || command.type.includes("track")) {
          userFriendlyError = "Couldn't modify the track";
        } else if (
          command.type.includes("Volume") ||
          command.type.includes("volume")
        ) {
          userFriendlyError = "Couldn't adjust the volume";
        } else if (
          command.type.includes("Pan") ||
          command.type.includes("pan")
        ) {
          userFriendlyError = "Couldn't adjust the panning";
        } else if (
          command.type.includes("Loop") ||
          command.type.includes("loop")
        ) {
          userFriendlyError = "Couldn't set up the loop";
        } else if (
          command.type.includes("Tempo") ||
          command.type.includes("tempo")
        ) {
          userFriendlyError = "Couldn't change the tempo";
        } else if (
          command.type.includes("play") ||
          command.type.includes("Play")
        ) {
          userFriendlyError = "Couldn't start playback";
        } else if (
          command.type.includes("pause") ||
          command.type.includes("Pause")
        ) {
          userFriendlyError = "Couldn't pause playback";
        }

        const errorMessage = `${command.description}: ${userFriendlyError}`;
        failedCommands.push(errorMessage);

        // Track execution errors
        this.failedCommandTracker.addFailedCommand(
          originalUserInput || "Unknown input",
          command.type,
          `Execution error: ${error}`,
          `Parameters: ${JSON.stringify(command.parameters)}`
        );
      }
    }

    const success = executedCommands.length > 0;

    // Log execution details to console
    if (success) {
      console.log(
        `[AI_EXECUTION] Successfully executed ${executedCommands.length} command(s):`
      );
      executedCommands.forEach((cmd, i) => console.log(`  ${i + 1}. ${cmd}`));
      if (failedCommands.length > 0) {
        console.log(
          `[AI_EXECUTION] ${failedCommands.length} command(s) failed:`
        );
        failedCommands.forEach((cmd, i) => console.log(`  ${i + 1}. ${cmd}`));
      }
    } else {
      console.log("[AI_EXECUTION] No commands were executed successfully");
      if (failedCommands.length > 0) {
        console.log("[AI_EXECUTION] Failed commands:");
        failedCommands.forEach((cmd, i) => console.log(`  ${i + 1}. ${cmd}`));
      }
    }

    // Clean user-facing message - be honest about what actually happened
    let message: string;
    if (success && failedCommands.length === 0 && executedCommands.length > 0) {
      // All commands succeeded AND at least one command was actually executed
      let aiMessage = plan.expectedOutcome;

      // If the AI message is too generic, make it more musical and friendly
      if (
        aiMessage.includes("Executing the commands as planned") ||
        aiMessage.includes("executing the commands") ||
        aiMessage.includes("commands executed") ||
        aiMessage.length < 20
      ) {
        // Generate a more musical message based on what was actually executed
        const commandTypes = plan.commands?.map((c) => c.type) || [];
        const uniqueTypes = [...new Set(commandTypes)];

        if (uniqueTypes.includes("setTrackColor")) {
          aiMessage = "Your tracks are looking absolutely stunning! 🌈✨";
        } else if (
          uniqueTypes.includes("setTrackVolume") ||
          uniqueTypes.includes("setTrackPan")
        ) {
          aiMessage = "Perfect! Your mix is sounding just right! 🎛️🎵";
        } else if (
          uniqueTypes.includes("play") ||
          uniqueTypes.includes("pause")
        ) {
          aiMessage = "Playback control at your command! ▶️🎶";
        } else if (uniqueTypes.includes("addTrack")) {
          aiMessage = "New track added to your musical masterpiece! 🎹✨";
        } else if (uniqueTypes.includes("sortTracks")) {
          aiMessage =
            "Tracks organized beautifully! Everything's in perfect order! 📋🎵";
        } else if (
          uniqueTypes.includes("muteTrack") ||
          uniqueTypes.includes("soloTrack")
        ) {
          aiMessage = "Track routing perfected! Your mix is dialed in! 🎚️🎭";
        } else if (uniqueTypes.includes("setTempo")) {
          aiMessage = "Tempo locked in! Feel that groove! 🥁⚡";
        } else if (uniqueTypes.includes("toggleMetronome")) {
          aiMessage = "Metronome ready to keep you in perfect time! 🎯🎵";
        } else {
          aiMessage = "Done! Your musical vision is coming to life! 🎵✨";
        }
      }

      message = aiMessage;
    } else if (success && failedCommands.length > 0) {
      // Some commands succeeded, some failed - be specific about what failed
      const succeededCount = executedCommands.length;
      const failedCount = failedCommands.length;

      // Extract the specific things that couldn't be done
      const failedItems = failedCommands.map((cmd) => {
        // Extract the user-friendly part of the failure message
        if (cmd.includes(": ")) {
          const actionPart = cmd.split(": ")[0] || "";
          const errorPart = cmd.split(": ")[1] || cmd;

          // If the error part is generic, try to make it more specific using the action
          if (
            errorPart.includes("being crafted") ||
            errorPart.includes("coming soon") ||
            errorPart.includes("fine-tuned")
          ) {
            // It's an unimplemented feature - use a more specific description
            if (actionPart.toLowerCase().includes("reverb")) {
              return "add reverb effects";
            } else if (actionPart.toLowerCase().includes("compress")) {
              return "add compression";
            } else if (actionPart.toLowerCase().includes("eq")) {
              return "adjust EQ";
            } else if (actionPart.toLowerCase().includes("delay")) {
              return "add delay effects";
            } else if (actionPart.toLowerCase().includes("export")) {
              return "export the project";
            } else if (actionPart.toLowerCase().includes("import")) {
              return "import audio files";
            } else if (
              actionPart.toLowerCase().includes("color") ||
              actionPart.toLowerCase().includes("colour")
            ) {
              return "change track color (try: red, orange, yellow, green, blue, indigo, violet, purple, pink, teal, amber, lime, emerald, rose, fuchsia, sky)";
            } else {
              return actionPart.toLowerCase();
            }
          }

          return errorPart;
        }
        return cmd;
      });

      if (succeededCount > 1) {
        message = `Almost there! Got ${succeededCount} things done, but couldn't do: ${failedItems.join(
          ", "
        )}. Those features are still being crafted! 🎵`;
      } else {
        message = `Got one thing done! But couldn't do: ${failedItems.join(
          ", "
        )}. Those features are coming soon! ✨`;
      }
    } else if (failedCommands.length > 0 && executedCommands.length === 0) {
      // All commands failed - be specific about what couldn't be done
      const failedItems = failedCommands.map((cmd) => {
        // Extract the user-friendly part of the failure message
        if (cmd.includes(": ")) {
          const actionPart = cmd.split(": ")[0] || "";
          const errorPart = cmd.split(": ")[1] || cmd;

          // If the error part is generic, try to make it more specific using the action
          if (
            errorPart.includes("being crafted") ||
            errorPart.includes("coming soon") ||
            errorPart.includes("fine-tuned")
          ) {
            // It's an unimplemented feature - use a more specific description
            if (actionPart.toLowerCase().includes("reverb")) {
              return "add reverb effects";
            } else if (actionPart.toLowerCase().includes("compress")) {
              return "add compression";
            } else if (actionPart.toLowerCase().includes("eq")) {
              return "adjust EQ";
            } else if (actionPart.toLowerCase().includes("delay")) {
              return "add delay effects";
            } else if (actionPart.toLowerCase().includes("export")) {
              return "export the project";
            } else if (actionPart.toLowerCase().includes("import")) {
              return "import audio files";
            } else if (
              actionPart.toLowerCase().includes("color") ||
              actionPart.toLowerCase().includes("colour")
            ) {
              return "change track color (try: red, orange, yellow, green, blue, indigo, violet, purple, pink, teal, amber, lime, emerald, rose, fuchsia, sky)";
            } else {
              return actionPart.toLowerCase();
            }
          }

          return errorPart;
        }
        return cmd;
      });

      if (failedItems.length === 1) {
        message = `Couldn't do: ${failedItems[0]}`;
      } else {
        message = `Couldn't do: ${failedItems.join(
          ", "
        )}. Those features are being crafted with musical precision! 🎵`;
      }
    } else {
      // No commands succeeded
      message = "Hmm, nothing happened this time. Try a different approach! 🎶";
    }

    // Create command plan snapshot for undo functionality (only if commands were executed)
    if (shouldCreateSnapshot && success && executedCommands.length > 0) {
      try {
        const finalState = JSON.parse(JSON.stringify(store.getState()));
        const reverseCommands = this.generateReverseCommands(
          plan.commands,
          initialState,
          finalState
        );

        const snapshot: AICommandPlanSnapshot = {
          planId,
          originalPlan: plan,
          initialState,
          finalState,
          reverseCommands,
        };

        this.addCommandPlanSnapshot(snapshot);

        debugLog(
          `[COMMAND_PLAN] Created snapshot for plan ${planId} with ${reverseCommands.length} reverse commands`
        );
      } catch (error) {
        console.warn("Failed to create command plan snapshot:", error);
      }
    }

    return {
      success,
      message,
      executedCommands,
      failedCommands,
    };
  }
}
const musicAiService = new MusicAiService();

export const useAiAssistant = () => {
  const dispatch = useAppDispatch();
  const { isPlaying, isMetronomeEnabled, playheadPosition } = useAppSelector(
    (state) => state.sonification
  );
  const tracks = useAppSelector((state) => state.project.present.tracks);
  const tempo = useAppSelector((state) => state.project.present.tempo);
  const { isCycleModeEnabled, timeSignature } = useAppSelector(
    (state) => state.project.present
  );
  const currentPixelsPerBeatFromStore = useAppSelector(
    (state) => state.ui.pianoRollSettings.pixelsPerBeat
  );
  const keySignature = useAppSelector(
    (state) => state.project.present.keySignature
  );
  const isAiSidebarOpen = useAppSelector((state) => state.ui.isAiSidebarOpen);

  // User preferences integration
  const { learnFromInteraction, getPersonalizedInstructions } =
    useUserPreferences();

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "system",
      content:
        "🎵 Welcome to MuseRoom AI Assistant! I'm here to help you make the perfect vision you have a reality.\n\nTry asking me what all I can do! 🎶",
      timestamp: Date.now(),
    },
  ]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const lastProcessedUserInputRef = useRef<string | null>(null);
  const hasAddedAssistantResponseRef = useRef<boolean>(false);
  const lastCommandTypeRef = useRef<CommandType | null>(null);

  const initializeService = useCallback(() => {
    const VITE_GOOGLE_AI_API_KEY = import.meta.env.VITE_GOOGLE_AI_API_KEY;
    try {
      if (VITE_GOOGLE_AI_API_KEY) {
        const success = musicAiService.initialize(VITE_GOOGLE_AI_API_KEY);
        setIsInitialized(success);
        if (success) setErrorMessage(null);
        else {
          const status = musicAiService.getStatus();
          setErrorMessage(status.error || "Failed to initialize AI service");
        }
      } else {
        setErrorMessage("No API key configured. AI features are limited.");
        setIsInitialized(false);
      }
    } catch (error: any) {
      setErrorMessage(
        error?.message || "Unknown error initializing AI service"
      );
      setIsInitialized(false);
    }
  }, []);

  useEffect(() => {
    initializeService();
  }, [initializeService]);

  const addMessage = useCallback(
    (role: Message["role"], content: string): Message => {
      const newMessage: Message = { role, content, timestamp: Date.now() };
      setMessages((prev) => [...prev, newMessage]);
      return newMessage;
    },
    []
  );

  const executeCommand = useCallback(
    async (
      commandType: CommandType,
      paramDetailsFromRecognition?: RecognizedCommandDetails
    ): Promise<CommandRecognitionResult> => {
      const paramDetails =
        paramDetailsFromRecognition ||
        musicAiService.getRecognizedCommandDetails();

      console.log(
        `[AI_HOOK] Executing command: ${commandType}`,
        paramDetails || ""
      );
      const maxProjectBeats =
        TOTAL_PROJECT_MEASURES * (timeSignature.numerator || 4);
      const playingNow = store.getState().sonification.isPlaying;

      const scrollTriggerPlayheadPosition = (
        initialJumpPosition: number,
        finalTargetPosition: number,
        startPlayback: boolean = false,
        commandContext: string = "Unknown"
      ) => {
        const upperBoundary =
          maxProjectBeats > 0.001 ? maxProjectBeats - 0.001 : 0;
        const clampedInitial = Math.max(
          0,
          Math.min(initialJumpPosition, upperBoundary)
        );
        const clampedFinal = Math.max(
          0,
          Math.min(finalTargetPosition, upperBoundary)
        );
        console.log(
          `[AI_HOOK] [Scroll-Trigger-${commandContext}] 1. Dispatching initial playhead jump to ${clampedInitial.toFixed(
            3
          )} beats (final target: ${clampedFinal.toFixed(3)})`
        );
        dispatch(setPlayheadPosition(clampedInitial));
        setTimeout(() => {
          console.log(
            `[AI_HOOK] [Scroll-Trigger-${commandContext}] 2. Dispatching final playhead position to ${clampedFinal.toFixed(
              3
            )} beats`
          );
          dispatch(setPlayheadPosition(clampedFinal));
          if (startPlayback) {
            console.log(
              `[AI_HOOK] [Scroll-Trigger-${commandContext}] 3. Starting playback.`
            );
            dispatch(setPlaying(true));
          }
        }, 10);
      };

      // Handle specific commands
      if (commandType === "add_track") {
        const trackDetails = (paramDetails || {}) as AddTrackCommand;
        const { trackType = TrackType.AUDIO, trackName } = trackDetails;

        const newTrackId = crypto.randomUUID();

        /* ---------- 1.  Make sure the new track is fully hidden before it mounts ---------- */
        const styleEl = document.createElement("style");
        styleEl.id = `tmp-hide-${newTrackId}`;
        styleEl.textContent = `[data-track-id="${newTrackId}"] { opacity: 0 !important; }`;
        document.head.appendChild(styleEl);

        /* ---------- 1a.  Hide the bottom border of the last existing track so we don't see a stray line ---------- */
        const existingTrackEls = Array.from(
          document.querySelectorAll("[data-track-id]")
        ) as HTMLElement[];
        const previousLastTrackEls = existingTrackEls
          .filter((el) => !el.dataset.trackId?.includes(newTrackId))
          .sort((a, b) =>
            a.getBoundingClientRect().top > b.getBoundingClientRect().top
              ? 1
              : -1
          );
        const lastOldTrackEls = previousLastTrackEls.slice(-2); // usually one lane + one list row
        const oldBorderColors: Map<HTMLElement, string> = new Map();
        lastOldTrackEls.forEach((el) => {
          const current = getComputedStyle(el).borderBottomColor;
          oldBorderColors.set(el, current);
          el.style.borderBottomColor = "transparent";
        });

        /* ---------- 2.  Also hide the dashed drop-zone guideline so it doesn't appear early ---------- */
        const dropZoneEl = document.querySelector(
          "[data-drop-stem-zone]"
        ) as HTMLElement | null;
        let originalDropZoneBorderColor: string | null = null;
        if (dropZoneEl) {
          originalDropZoneBorderColor =
            getComputedStyle(dropZoneEl).borderTopColor;
          dropZoneEl.style.borderTopColor = "transparent";
        }

        /* ---------- 3.  Dispatch the add-track action IMMEDIATELY for fast execution ---------- */
        dispatch(
          addTrack({ type: trackType, name: trackName, id: newTrackId })
        );

        /* ---------- 4.  Run animations in parallel without blocking the return ---------- */
        setTimeout(async () => {
          try {
            // Wait a frame for DOM to update
            await new Promise((res) => requestAnimationFrame(res));

            const trackEls = Array.from(
              document.querySelectorAll(`[data-track-id="${newTrackId}"]`)
            ) as HTMLElement[];

            // Prepare fade-in transition on each element
            trackEls.forEach((el) => {
              el.style.transition = "opacity 150ms ease-out";
            });

            // Lightning animation (run in parallel, don't await)
            const startEl = document.querySelector(
              ".ai-sidebar-container.circle-mode"
            ) as HTMLElement | null;
            const endEl = trackEls[0] || null;
            if (startEl && endEl) {
              import("../utils/lightningEffect").then(
                ({ triggerLightning }) => {
                  triggerLightning(startEl, endEl, "#00eaff", 450);
                }
              );
            }

            // Kick off fade-in and clean up helper style
            requestAnimationFrame(() => {
              trackEls.forEach((el) => {
                el.style.opacity = "1";
              });
              // Remove temp style so normal styling resumes
              styleEl.remove();
              // Restore drop-zone border after the fade-in completes
              if (dropZoneEl && originalDropZoneBorderColor) {
                setTimeout(() => {
                  dropZoneEl.style.borderTopColor =
                    originalDropZoneBorderColor!;
                }, 160); // slightly longer than transition
              }
              // Restore old bottom border colors
              oldBorderColors.forEach((color, el) => {
                el.style.borderBottomColor = color;
              });
            });
          } catch {
            // ignore visual errors and clean up
            styleEl.remove();
          }
        }, 0);

        return {
          type: commandType,
          confidence: 0.95,
          executed: true,
          details: {
            message: `I've added a new ${
              trackType === TrackType.SOFTWARE_INSTRUMENT
                ? "instrument"
                : "audio"
            } track${trackName ? ` named \"${trackName}\"` : ""}.`,
            newTrackType: trackType,
            newTrackName: trackName,
          },
        };
      }

      if (commandType === "tempo_change" && paramDetails) {
        const tempoDetails = paramDetails as TempoChangeCommand;
        const { currentTempo, targetTempo, isDefaultAmountApplied, action } =
          tempoDetails;
        const finalTempo = Math.max(20, Math.min(300, targetTempo));
        let message: string;
        const executedChange = finalTempo !== currentTempo;
        if (!executedChange && action !== "set")
          message = `Tempo is already at ${currentTempo} BPM. No change made.`;
        else if (isDefaultAmountApplied) {
          const changeAmount = Math.abs(finalTempo - currentTempo);
          if (finalTempo > currentTempo)
            message = `Tempo increased by ${changeAmount} BPM to ${finalTempo} BPM.`;
          else if (finalTempo < currentTempo)
            message = `Tempo decreased by ${changeAmount} BPM to ${finalTempo} BPM.`;
          else message = `Tempo is already ${finalTempo} BPM.`;
        } else {
          if (finalTempo !== currentTempo)
            message = `Tempo changed to ${finalTempo} BPM. (was ${currentTempo} BPM)`;
          else message = `Tempo is already ${finalTempo} BPM.`;
        }
        // Add friendly follow-up when tempo actually changed
        if (executedChange) {
          message += " Anything else I can help with?";

          // Apply tempo change IMMEDIATELY for fast execution
          dispatch(setTempo(finalTempo));

          // Run lightning effect in parallel without blocking
          setTimeout(async () => {
            try {
              const startEl = document.querySelector(
                ".ai-sidebar-container.circle-mode"
              ) as HTMLElement | null;
              // Wait two frames so layout settles
              await new Promise((res) =>
                requestAnimationFrame(() => requestAnimationFrame(res))
              );
              const tempoInput = document.getElementById(
                "transportTempoInput"
              ) as HTMLElement | null;
              const endEl = tempoInput?.closest("div") ?? tempoInput;
              if (startEl && endEl) {
                const { triggerLightning } = await import(
                  "../utils/lightningEffect"
                );
                triggerLightning(startEl, endEl, "#00eaff", 450); // Don't await
              }
            } catch {
              // swallow visual errors so functionality still works
            }
          }, 0);
        }
        return {
          type: commandType,
          confidence: 0.95,
          executed: executedChange,
          details: {
            oldValue: currentTempo,
            newValue: finalTempo,
            message,
            tempo: finalTempo,
          },
        };
      }

      if (commandType === "key_signature_change" && paramDetails) {
        const ksDetails = paramDetails as KeySignatureChangeCommand;
        const newKey = ksDetails.newKey?.trim();
        const currentKeySig = keySignature;
        let executed = false;
        let message: string;
        if (!newKey) {
          message = "I couldn't determine the requested key signature.";
        } else if (newKey === currentKeySig) {
          message = `Key signature is already ${newKey}.`;
        } else {
          // Apply key signature change IMMEDIATELY
          dispatch(setKeySignature(newKey));
          executed = true;

          // Run lightning effect in parallel without blocking
          setTimeout(async () => {
            try {
              const startEl = document.querySelector(
                ".ai-sidebar-container.circle-mode"
              ) as HTMLElement | null;
              // Wait two frames for layout
              await new Promise((res) =>
                requestAnimationFrame(() => requestAnimationFrame(res))
              );
              const endEl = document.getElementById(
                "transportKeySigButton"
              ) as HTMLElement | null;
              if (startEl && endEl) {
                const { triggerLightning } = await import(
                  "../utils/lightningEffect"
                );
                triggerLightning(startEl, endEl, "#00eaff", 450); // Don't await
              }
            } catch {}
          }, 0);
          const readableKey = newKey
            .replace(/([A-G])b/g, "$1-flat")
            .replace(/([A-G])#/g, "$1-sharp")
            .replace(/b minor/i, " flat minor")
            .replace(/b major/i, " flat major")
            .replace(/# minor/i, " sharp minor")
            .replace(/# major/i, " sharp major");
          message = `Key signature changed to ${readableKey}. Anything else?`;
        }
        return {
          type: commandType,
          confidence: 0.95,
          executed,
          details: {
            message,
            oldName: currentKeySig,
            newName: newKey,
            targetEntity: "project",
          },
        };
      }

      if (commandType === "time_signature_change" && paramDetails) {
        const tsDetails = paramDetails as TimeSignatureChangeCommand;
        const { newNumerator, newDenominator } = tsDetails;
        const currentNum = timeSignature.numerator;
        const currentDen = timeSignature.denominator;
        let executed = false;
        let message = "";
        if (!newNumerator || !newDenominator) {
          message = "I couldn't determine the requested time signature.";
        } else if (
          newNumerator === currentNum &&
          newDenominator === currentDen
        ) {
          message = `Time signature is already ${currentNum}/${currentDen}.`;
        } else {
          try {
            const startEl = document.querySelector(
              ".ai-sidebar-container.circle-mode"
            ) as HTMLElement | null;
            await new Promise((res) =>
              requestAnimationFrame(() => requestAnimationFrame(res))
            );
            const endEl = document.getElementById(
              "transportTimeSigNumeratorInput"
            ) as HTMLElement | null;
            const { triggerLightning } = await import(
              "../utils/lightningEffect"
            );
            if (startEl && endEl) {
              await triggerLightning(startEl, endEl, "#00eaff", 450);
            }
          } catch {}

          dispatch(
            setTimeSignature({
              numerator: newNumerator,
              denominator: newDenominator,
            })
          );
          executed = true;
          message = `Time signature changed to ${newNumerator}/${newDenominator}. Need anything else?`;
        }
        return {
          type: commandType,
          confidence: 0.95,
          executed,
          details: {
            message,
          },
        };
      }

      if (commandType === "metronome_toggle" && paramDetails) {
        const { intent } = paramDetails as MetronomeToggleDetails;
        const currentIsEnabled = isMetronomeEnabled;
        let message = "";
        let executed = false;
        let finalMetronomeState = currentIsEnabled;
        const strikeMetronome = async () => {
          try {
            const startEl = document.querySelector(
              ".ai-sidebar-container.circle-mode"
            ) as HTMLElement | null;
            await new Promise((res) =>
              requestAnimationFrame(() => requestAnimationFrame(res))
            );
            const endEl = document.getElementById("metronomeToggleButton");
            if (startEl && endEl) {
              const { triggerLightning } = await import(
                "../utils/lightningEffect"
              );
              await triggerLightning(startEl, endEl, "#00eaff", 450);
            }
          } catch {
            /* ignore */
          }
        };

        if (intent === "on") {
          if (!currentIsEnabled) {
            await strikeMetronome();
            dispatch(toggleMetronome());
            executed = true;
            finalMetronomeState = true;
            message = "I've enabled the metronome.";
          } else message = "Metronome is already on.";
        } else if (intent === "off") {
          if (currentIsEnabled) {
            await strikeMetronome();
            dispatch(toggleMetronome());
            executed = true;
            finalMetronomeState = false;
            message = "I've disabled the metronome.";
          } else message = "Metronome is already off.";
        } else {
          // Default to toggle
          await strikeMetronome();
          dispatch(toggleMetronome());
          executed = true;
          finalMetronomeState = !currentIsEnabled;
          message = `I've ${
            finalMetronomeState ? "enabled" : "disabled"
          } the metronome.`;
        }
        return {
          type: commandType,
          confidence: 0.95,
          executed,
          details: { message, metronomeEnabled: finalMetronomeState },
        };
      }

      if (commandType === "loop_toggle" && paramDetails) {
        const { intent } = paramDetails as LoopToggleCommand;
        const currentLoopEnabled = isCycleModeEnabled;
        let message = "";
        let executed = false;
        let finalLoopState = currentLoopEnabled;
        if (intent === "on") {
          if (!currentLoopEnabled) {
            dispatch(toggleProjectCycleMode(true));
            executed = true;
            finalLoopState = true;
            message = "Looping enabled.";
          } else message = "Looping is already on.";
        } else if (intent === "off") {
          if (currentLoopEnabled) {
            dispatch(toggleProjectCycleMode(false));
            executed = true;
            finalLoopState = false;
            message = "Looping disabled.";
          } else message = "Looping is already off.";
        } else {
          dispatch(toggleProjectCycleMode());
          executed = true;
          finalLoopState = !currentLoopEnabled;
          message = `Looping ${finalLoopState ? "enabled" : "disabled"}.`;
        }
        return {
          type: commandType,
          confidence: 0.95,
          executed,
          details: { message, loopEnabled: finalLoopState },
        };
      }

      if (commandType === "start_looping" && paramDetails) {
        const startLoopDetails = paramDetails as {
          shouldPlay: boolean;
          message?: string;
        };
        let message = "";
        let executed = false;

        // Enable loop if not already enabled
        if (!isCycleModeEnabled) {
          dispatch(toggleProjectCycleMode(true));
        }

        // Start playback if requested
        if (startLoopDetails.shouldPlay && !playingNow) {
          try {
            const startEl = document.querySelector(
              ".ai-sidebar-container.circle-mode"
            ) as HTMLElement | null;
            const endEl = document.querySelector(
              'button[title="Pause"], button[title="Play"]'
            ) as HTMLElement | null;
            const { triggerLightning } = await import(
              "../utils/lightningEffect"
            );
            if (startEl && endEl)
              await triggerLightning(startEl, endEl, "#00eaff", 450);
          } catch {
            /* ignore visual-effect errors */
          }
          dispatch(setPlaying(true));
        }

        executed = true;
        message =
          startLoopDetails.message || "Loop enabled and playback started.";

        return {
          type: commandType,
          confidence: 0.95,
          executed,
          details: {
            message,
            loopEnabled: true,
          },
        };
      }

      if (commandType === "loop_range" && paramDetails) {
        const rangeDetails = paramDetails as LoopRangeCommand;
        const timeSigNumerator = timeSignature.numerator || 4;
        let startBeat: number;
        let endBeat: number;
        let message = "";
        let executed = false;

        if (
          rangeDetails.isTimeBased &&
          rangeDetails.startTimeSeconds !== undefined &&
          rangeDetails.endTimeSeconds !== undefined
        ) {
          // Time-based loop: convert seconds to beats
          // Assuming 120 BPM default tempo for beat calculation if tempo not available
          const currentTempo = tempo || 120;
          const beatsPerSecond = currentTempo / 60;
          startBeat = rangeDetails.startTimeSeconds * beatsPerSecond;
          endBeat = rangeDetails.endTimeSeconds * beatsPerSecond;

          if (
            startBeat >= endBeat ||
            startBeat < 0 ||
            endBeat > maxProjectBeats
          ) {
            const startTimeFormatted = `${Math.floor(
              rangeDetails.startTimeSeconds / 60
            )}:${(rangeDetails.startTimeSeconds % 60)
              .toString()
              .padStart(2, "0")}`;
            const endTimeFormatted = `${Math.floor(
              rangeDetails.endTimeSeconds / 60
            )}:${(rangeDetails.endTimeSeconds % 60)
              .toString()
              .padStart(2, "0")}`;
            message = `Invalid time range: ${startTimeFormatted}-${endTimeFormatted}. Please provide a valid time range within the project.`;
          } else {
            dispatch(setCycleRange({ start: startBeat, end: endBeat }));
            if (!isCycleModeEnabled) dispatch(toggleProjectCycleMode(true));
            executed = true;
            const startTimeFormatted = `${Math.floor(
              rangeDetails.startTimeSeconds / 60
            )}:${(rangeDetails.startTimeSeconds % 60)
              .toString()
              .padStart(2, "0")}`;
            const endTimeFormatted = `${Math.floor(
              rangeDetails.endTimeSeconds / 60
            )}:${(rangeDetails.endTimeSeconds % 60)
              .toString()
              .padStart(2, "0")}`;
            message = `Loop set from ${startTimeFormatted} to ${endTimeFormatted}.`;
            if (!isCycleModeEnabled && executed)
              message = `Loop enabled and set from ${startTimeFormatted} to ${endTimeFormatted}.`;
          }
        } else if (
          rangeDetails.startMeasure !== undefined &&
          rangeDetails.endMeasure !== undefined
        ) {
          // Measure-based loop (original logic)
          startBeat = (rangeDetails.startMeasure - 1) * timeSigNumerator;
          endBeat = rangeDetails.endMeasure * timeSigNumerator;

          if (
            startBeat >= endBeat ||
            startBeat < 0 ||
            endBeat > maxProjectBeats
          )
            message = `Invalid measure range: ${rangeDetails.startMeasure}-${rangeDetails.endMeasure}. Please provide valid measures within the project limit (1-${TOTAL_PROJECT_MEASURES}).`;
          else {
            dispatch(setCycleRange({ start: startBeat, end: endBeat }));
            if (!isCycleModeEnabled) dispatch(toggleProjectCycleMode(true));
            executed = true;
            message = `Loop set from measure ${rangeDetails.startMeasure} to ${rangeDetails.endMeasure}.`;
            if (!isCycleModeEnabled && executed)
              message = `Loop enabled and set from measure ${rangeDetails.startMeasure} to ${rangeDetails.endMeasure}.`;
          }
        } else {
          message =
            "Invalid loop range. Please specify either time range (e.g., 0:15-1:30) or measure range (e.g., measures 1-4).";
        }

        return {
          type: commandType,
          confidence: 0.95,
          executed,
          details: {
            message,
            loopEnabled: executed ? true : isCycleModeEnabled,
            loopStartMeasure: rangeDetails.startMeasure,
            loopEndMeasure: rangeDetails.endMeasure,
          },
        };
      }

      if (commandType === "mute_track" && paramDetails) {
        const muteDetails = paramDetails as MuteActionDetails;
        const trackToMute = tracks.find((t) => t.id === muteDetails.trackId);
        if (!trackToMute)
          return {
            type: commandType,
            confidence: 0.9,
            executed: false,
            details: { message: `Track "${muteDetails.trackName}" not found.` },
          };
        let message = "";
        let executed = false;
        const currentMuteState = trackToMute.isMuted;
        let finalMuteState = currentMuteState;
        if (muteDetails.intent === "mute") {
          if (!currentMuteState) {
            dispatch(toggleTrackMute(muteDetails.trackId));
            executed = true;
            finalMuteState = true;
            message = `Muted "${muteDetails.trackName}".`;
          } else message = `"${muteDetails.trackName}" is already muted.`;
        } else if (muteDetails.intent === "unmute") {
          if (currentMuteState) {
            dispatch(toggleTrackMute(muteDetails.trackId));
            executed = true;
            finalMuteState = false;
            message = `Unmuted "${muteDetails.trackName}".`;
          } else message = `"${muteDetails.trackName}" is already unmuted.`;
        } else {
          dispatch(toggleTrackMute(muteDetails.trackId));
          executed = true;
          finalMuteState = !currentMuteState;
          message = `"${muteDetails.trackName}" ${
            finalMuteState ? "muted" : "unmuted"
          }.`;
        }
        return {
          type: commandType,
          confidence: 0.95,
          executed,
          details: {
            message,
            trackName: muteDetails.trackName,
            muteState: finalMuteState,
          },
        };
      }

      if (commandType === "solo_track" && paramDetails) {
        const soloDetails = paramDetails as SoloActionDetails;
        const trackToSolo = tracks.find((t) => t.id === soloDetails.trackId);
        if (!trackToSolo)
          return {
            type: commandType,
            confidence: 0.9,
            executed: false,
            details: { message: `Track "${soloDetails.trackName}" not found.` },
          };
        let message = "";
        let executed = false;
        const currentSoloState = trackToSolo.isSoloed;
        let finalSoloState = currentSoloState;
        if (soloDetails.intent === "solo") {
          if (!currentSoloState) {
            dispatch(toggleTrackSolo(soloDetails.trackId));
            executed = true;
            finalSoloState = true;
            message = `Soloed "${soloDetails.trackName}".`;
          } else message = `"${soloDetails.trackName}" is already soloed.`;
        } else if (soloDetails.intent === "unsolo") {
          if (currentSoloState) {
            dispatch(toggleTrackSolo(soloDetails.trackId));
            executed = true;
            finalSoloState = false;
            message = `Unsoloed "${soloDetails.trackName}".`;
          } else
            message = `"${soloDetails.trackName}" is not currently soloed.`;
        } else {
          dispatch(toggleTrackSolo(soloDetails.trackId));
          executed = true;
          const stateAfterToggle = store
            .getState()
            .project.present.tracks.find((t) => t.id === soloDetails.trackId);
          finalSoloState = stateAfterToggle
            ? stateAfterToggle.isSoloed
            : !currentSoloState;
          message = `"${soloDetails.trackName}" ${
            finalSoloState ? "soloed" : "unsoloed"
          }.`;
        }
        return {
          type: commandType,
          confidence: 0.95,
          executed,
          details: {
            message,
            trackName: soloDetails.trackName,
            soloState: finalSoloState,
          },
        };
      }

      if (commandType === "zoom" && paramDetails) {
        const zoomDetails = paramDetails as ZoomCommand;
        const currentPixelsPerBeat = currentPixelsPerBeatFromStore;
        let newPixelsPerBeat = currentPixelsPerBeat;
        let message = "";
        let executed = false;
        const totalProjectBeats = maxProjectBeats;
        switch (zoomDetails.action) {
          case "in":
          case "out":
            let scaleFactor = 1.5;
            if (zoomDetails.intensity === "slight") scaleFactor = 1.2;
            else if (zoomDetails.intensity === "maximum") scaleFactor = 2.5;
            newPixelsPerBeat =
              zoomDetails.action === "in"
                ? currentPixelsPerBeat * scaleFactor
                : currentPixelsPerBeat / scaleFactor;
            break;
          case "fit_measures":
            if (zoomDetails.startMeasure && zoomDetails.endMeasure) {
              const timeSigNum = timeSignature.numerator || 4;
              const startBeatGlobal =
                (zoomDetails.startMeasure - 1) * timeSigNum;
              const endBeatGlobal = zoomDetails.endMeasure * timeSigNum;
              const beatsToFit = endBeatGlobal - startBeatGlobal;
              if (beatsToFit > 0) {
                const arrangeAreaWidth =
                  document.querySelector(".arrange-lanes-horizontal-scroll")
                    ?.clientWidth ?? ESTIMATED_VIEWPORT_WIDTH_FOR_ZOOM_CALC;
                newPixelsPerBeat =
                  arrangeAreaWidth / ZOOM_FIT_PADDING_FACTOR / beatsToFit;
                scrollTriggerPlayheadPosition(
                  startBeatGlobal + beatsToFit / 2,
                  startBeatGlobal,
                  false,
                  "ZoomFitMeasures"
                );
              }
            }
            break;
          case "fit_project":
            if (totalProjectBeats > 0) {
              const arrangeAreaWidth =
                document.querySelector(".arrange-lanes-horizontal-scroll")
                  ?.clientWidth ?? ESTIMATED_VIEWPORT_WIDTH_FOR_ZOOM_CALC;
              newPixelsPerBeat = arrangeAreaWidth / totalProjectBeats;
              scrollTriggerPlayheadPosition(
                totalProjectBeats > 0 ? SCROLL_TRIGGER_NUDGE_BEATS : 0,
                0,
                false,
                "ZoomFitProject"
              );
            }
            break;
          case "set_level":
            if (typeof zoomDetails.targetPixelsPerBeat === "number")
              newPixelsPerBeat = zoomDetails.targetPixelsPerBeat;
            break;
        }
        newPixelsPerBeat = Math.max(
          MIN_PIXELS_PER_BEAT,
          Math.min(MAX_PIXELS_PER_BEAT, newPixelsPerBeat)
        );
        const zoomLevelActuallyChanged =
          Math.abs(newPixelsPerBeat - currentPixelsPerBeat) > 0.01;
        if (zoomLevelActuallyChanged)
          dispatch(setPianoRollPixelsPerBeat(newPixelsPerBeat));

        if (zoomDetails.action === "fit_measures") {
          executed = true;
          if (zoomDetails.startMeasure && zoomDetails.endMeasure) {
            const beatsToFit =
              zoomDetails.endMeasure * (timeSignature.numerator || 4) -
              (zoomDetails.startMeasure - 1) * (timeSignature.numerator || 4);
            const plural =
              zoomDetails.startMeasure === zoomDetails.endMeasure
                ? "measure"
                : "measures";
            const rangeStr = `${plural} ${zoomDetails.startMeasure}${
              zoomDetails.startMeasure !== zoomDetails.endMeasure
                ? `-${zoomDetails.endMeasure}`
                : ""
            }`;
            if (beatsToFit > 0) {
              message = zoomLevelActuallyChanged
                ? `Zoomed to fit ${rangeStr}, centered view, and positioned playhead at ${
                    plural === "measure"
                      ? "measure"
                      : "the beginning of measure"
                  } ${zoomDetails.startMeasure}.`
                : `View centered for ${rangeStr} and playhead positioned. (Zoom level already optimal).`;
            } else {
              message = `Cannot fit zero or negative measure range for ${rangeStr}. Playhead not moved.`;
              executed = zoomLevelActuallyChanged;
            }
          } else {
            message = "Please specify start and end measures to fit.";
            executed = zoomLevelActuallyChanged;
          }
        } else if (zoomDetails.action === "fit_project") {
          executed = true;
          if (zoomLevelActuallyChanged) {
            message =
              "Zoomed to fit the entire project and moved playhead to the beginning.";
          } else {
            message =
              totalProjectBeats > 0
                ? "View set to entire project and playhead moved to beginning. (Zoom level already optimal)."
                : "Project is empty. Playhead at beginning. (Zoom level already optimal).";
          }
        } else if (
          zoomDetails.action === "in" ||
          zoomDetails.action === "out"
        ) {
          if (zoomLevelActuallyChanged) {
            message = `Zoomed ${zoomDetails.action}${
              zoomDetails.intensity ? ` ${zoomDetails.intensity}` : ""
            }.`;
            executed = true;
          } else {
            message = `Cannot zoom ${zoomDetails.action} further. Already at ${
              zoomDetails.action === "in" ? "maximum" : "minimum"
            } zoom.`;
            executed = false;
          }
        } else if (zoomDetails.action === "set_level") {
          if (typeof zoomDetails.targetPixelsPerBeat === "number") {
            if (zoomLevelActuallyChanged) {
              message = "Zoom level set.";
              executed = true;
            } else {
              message = "Zoom level is already at the target value.";
              executed = false;
            }
          } else {
            message = "Please specify a zoom level to set.";
            executed = false;
          }
        }
        return {
          type: commandType,
          confidence: 0.95,
          executed,
          details: {
            message,
            zoomAction: zoomDetails.action,
            zoomIntensity: zoomDetails.intensity,
            newPixelsPerBeat: zoomLevelActuallyChanged
              ? newPixelsPerBeat
              : currentPixelsPerBeat,
          },
        };
      }

      if (commandType === "playhead_position" && paramDetails) {
        const details = paramDetails as PlayheadPositionCommand;
        let targetGlobalBeats = 0;
        let message = "";
        const beatsPerMeasure = timeSignature.numerator || 4;
        const currentGlobalBeats = playheadPosition;
        let executedSuccessfully = false;
        switch (details.positionType) {
          case "beginning":
            targetGlobalBeats = 0;
            message = details.shouldPlay
              ? "Playing from the beginning."
              : "Moved playhead to the beginning.";
            executedSuccessfully = true;
            break;
          case "measure":
            if (details.targetMeasure !== undefined) {
              targetGlobalBeats = (details.targetMeasure - 1) * beatsPerMeasure;
              targetGlobalBeats = Math.max(0, targetGlobalBeats);
              const displayMeasure =
                details.targetMeasure % 1 === 0
                  ? details.targetMeasure.toString()
                  : details.targetMeasure.toFixed(1);
              message = details.shouldPlay
                ? `Playing from measure ${displayMeasure}.`
                : `Moved playhead to measure ${displayMeasure}.`;
              executedSuccessfully = true;
            } else {
              message = "Could not determine target measure.";
              targetGlobalBeats = currentGlobalBeats;
            }
            break;
          case "absolute_beat":
            if (details.targetAbsoluteBeat !== undefined) {
              targetGlobalBeats = details.targetAbsoluteBeat;
              message = details.shouldPlay
                ? `Playing from beat ${details.targetAbsoluteBeat}.`
                : `Moved playhead to beat ${details.targetAbsoluteBeat}.`;
              executedSuccessfully = true;
            } else {
              message = "Could not determine target beat.";
              targetGlobalBeats = currentGlobalBeats;
            }
            break;
          case "relative_measure":
            if (
              details.relativeAmount !== undefined &&
              details.isForward !== undefined
            ) {
              const currentMeasureNum =
                Math.floor(currentGlobalBeats / beatsPerMeasure) + 1;
              let targetMeasureNum =
                currentMeasureNum +
                (details.isForward
                  ? details.relativeAmount
                  : -details.relativeAmount);
              targetMeasureNum = Math.max(
                1,
                Math.min(TOTAL_PROJECT_MEASURES, targetMeasureNum)
              );
              targetGlobalBeats = (targetMeasureNum - 1) * beatsPerMeasure;
              message = `Moved playhead ${
                details.isForward ? "forward" : "back"
              } ${details.relativeAmount} measure${
                details.relativeAmount > 1 ? "s" : ""
              } to measure ${targetMeasureNum}.`;
              if (details.shouldPlay)
                message = `Playing from ${
                  details.isForward ? "next" : "previous"
                } ${details.relativeAmount} measure${
                  details.relativeAmount > 1 ? "s" : ""
                } (measure ${targetMeasureNum}).`;
              executedSuccessfully = true;
            } else {
              message = "Could not determine relative measure movement.";
              targetGlobalBeats = currentGlobalBeats;
            }
            break;
          default:
            message = "Unknown playhead position type.";
            targetGlobalBeats = currentGlobalBeats;
            break;
        }
        targetGlobalBeats = Math.max(
          0,
          Math.min(
            targetGlobalBeats,
            maxProjectBeats > 0.001 ? maxProjectBeats - 0.001 : 0
          )
        );
        if (executedSuccessfully) {
          console.log(
            `[AI_HOOK] Computed final playhead targetGlobalBeats = ${targetGlobalBeats.toFixed(
              3
            )}`
          );
          let initialJumpForPlayheadCmd: number;
          const upperBoundary =
            maxProjectBeats > 0.001 ? maxProjectBeats - 0.001 : 0;

          if (Math.abs(targetGlobalBeats) < 0.001) {
            // Target is effectively 0 (beginning)
            initialJumpForPlayheadCmd = Math.min(
              SCROLL_TRIGGER_NUDGE_BEATS,
              upperBoundary
            );
          } else {
            // Target is not 0
            initialJumpForPlayheadCmd =
              targetGlobalBeats + SCROLL_TRIGGER_NUDGE_BEATS;
          }
          initialJumpForPlayheadCmd = Math.max(
            0,
            Math.min(initialJumpForPlayheadCmd, upperBoundary)
          );

          scrollTriggerPlayheadPosition(
            initialJumpForPlayheadCmd,
            targetGlobalBeats,
            details.shouldPlay,
            "PlayheadCmd"
          );
          console.log(
            `[AI_HOOK] Playhead command confirmation – Target beat: ${targetGlobalBeats.toFixed(
              3
            )}. Playback will start if requested after scroll trick.`
          );
          if (details.shouldPlay && !/playing/i.test(message)) {
            message = message
              .replace(/^Moved playhead/i, "Playing")
              .replace(/^Playhead moved/i, "Playing")
              .replace(/^Moved/i, "Playing");
            console.log(
              `[AI_HOOK] Patched playhead message for playback: "${message}"`
            );
          }
        } else {
          message =
            message ||
            "Sorry, I couldn't determine where to move the playhead.";
          console.log(
            `[AI_HOOK] Playhead command not executed successfully. Message: "${message}"`
          );
        }
        return {
          type: commandType,
          confidence: 0.95,
          executed: executedSuccessfully,
          details: {
            message,
            playheadTargetMeasure:
              details.positionType === "measure"
                ? details.targetMeasure
                : undefined,
            playheadTargetAbsoluteBeat:
              details.positionType === "absolute_beat"
                ? details.targetAbsoluteBeat
                : undefined,
            playheadFinalPositionBeats: targetGlobalBeats,
            playheadDidPlay: executedSuccessfully && details.shouldPlay,
            playheadOriginalInput: details.originalInput,
          },
        };
      }

      if (commandType === "rename_project" && paramDetails) {
        const { newName } = paramDetails as RenameProjectCommand;
        const currentProjectName = store.getState().project.present.name;
        let message = "";
        let executed = false;
        let finalNewName = currentProjectName;

        if (newName && newName.trim().length > 0 && newName.length <= 100) {
          if (currentProjectName !== newName.trim()) {
            dispatch(setProjectName(newName.trim()));
            finalNewName = newName.trim();
            message = `Project renamed from "${currentProjectName}" to "${finalNewName}".`;
            executed = true;
          } else {
            message = `Project is already named "${currentProjectName}". No change made.`;
          }
        } else {
          message = "Invalid new project name provided.";
        }
        return {
          type: commandType,
          confidence: 0.95,
          executed,
          details: {
            message,
            oldName: currentProjectName,
            newName: finalNewName,
            targetEntity: "project",
          },
        };
      }

      if (commandType === "rename_track" && paramDetails) {
        const { trackId, currentTrackName, newTrackName } =
          paramDetails as RenameTrackCommand;
        let message = "";
        let executed = false;
        let finalNewName = currentTrackName;

        if (
          trackId &&
          newTrackName &&
          newTrackName.trim().length > 0 &&
          newTrackName.trim().length <= 100
        ) {
          const targetTrack = tracks.find((t) => t.id === trackId);
          if (targetTrack) {
            if (targetTrack.name !== newTrackName.trim()) {
              dispatch(
                updateTrack({
                  id: trackId,
                  changes: { name: newTrackName.trim() },
                })
              );
              finalNewName = newTrackName.trim();
              message = `Track "${currentTrackName}" renamed to "${finalNewName}".`;
              executed = true;
            } else {
              message = `Track "${currentTrackName}" is already named that.`;
            }
          } else {
            message = `Could not find track "${currentTrackName}" to rename.`;
          }
        } else if (!trackId) {
          message = "Could not identify which track you want to rename.";
        } else {
          message = "Invalid new track name provided.";
        }
        return {
          type: commandType,
          confidence: 0.95,
          executed,
          details: {
            message,
            trackName: currentTrackName,
            oldName: currentTrackName,
            newName: finalNewName,
            targetEntity: "track",
          },
        };
      }

      if (commandType === "change_track_color" && paramDetails) {
        const { trackId, currentTrackName, newColor } =
          paramDetails as ChangeTrackColorCommand;
        let message = "";
        let executed = false;
        const targetTrack = tracks.find((t) => t.id === trackId);

        if (targetTrack) {
          if (targetTrack.color?.toLowerCase() !== newColor.toLowerCase()) {
            console.log(
              `[AI_COLOR_DEBUG] Applying color change for track ${trackId} (${currentTrackName}): ${newColor}`
            );
            dispatch(
              updateTrack({ id: trackId, changes: { color: newColor } })
            );
            message = `Track "${currentTrackName}" color changed to ${
              newColor.replace("bg-", "").split("-")[0]
            }.`;
            executed = true;
          } else {
            message = `Track "${currentTrackName}" is already ${
              newColor.replace("bg-", "").split("-")[0]
            }. No change made.`;
          }
        } else {
          message = `Could not find track "${currentTrackName}".`;
        }
        return {
          type: commandType,
          confidence: 0.95,
          executed,
          details: {
            message,
            trackName: currentTrackName,
            newColor: executed ? newColor : targetTrack?.color,
          },
        };
      }

      if (commandType === "duplicate_track" && paramDetails) {
        const { trackId, trackName, preserveSettings } =
          paramDetails as DuplicateTrackCommand;
        let message = "";
        let executed = false;
        const targetTrack = tracks.find((t) => t.id === trackId);

        if (targetTrack) {
          try {
            // Create duplicate track with preserved settings
            const newTrackId = crypto.randomUUID();
            let newTrack: Track;

            if (targetTrack.type === TrackType.SOFTWARE_INSTRUMENT) {
              const originalSoftwareTrack =
                targetTrack as SoftwareInstrumentTrack;
              newTrack = {
                ...originalSoftwareTrack,
                id: newTrackId,
                name: `${targetTrack.name} copy`,
                isSoloed: false, // Don't duplicate solo state
                isRecordArmed: false, // Don't duplicate record arm state
                regions: [], // Will be populated below
              };
            } else {
              const originalAudioTrack = targetTrack as AudioTrack;
              newTrack = {
                ...originalAudioTrack,
                id: newTrackId,
                name: `${targetTrack.name} copy`,
                isSoloed: false, // Don't duplicate solo state
                isRecordArmed: false, // Don't duplicate record arm state
                isInputMonitoringEnabled: false, // Don't duplicate input monitoring
                regions: [], // Will be populated below
                inputLevel: 0, // Reset levels
                outputLevel: 0,
              };
            }

            // Duplicate all regions from the original track if preserveSettings is true
            if (preserveSettings) {
              newTrack.regions = targetTrack.regions.map((region) => ({
                ...region,
                id: crypto.randomUUID(),
                trackId: newTrackId,
                notes: region.notes.map((note) => ({
                  ...note,
                  id: crypto.randomUUID(), // Generate new IDs for notes
                })),
              }));
            }

            // Apply visual effects similar to addTrack
            const styleEl = document.createElement("style");
            styleEl.id = `tmp-hide-${newTrackId}`;
            styleEl.textContent = `[data-track-id="${newTrackId}"] { opacity: 0 !important; }`;
            document.head.appendChild(styleEl);

            // Dispatch the add track action with the duplicated track
            dispatch(
              addTrack({
                type: newTrack.type,
                name: newTrack.name,
                id: newTrackId,
                instrumentId:
                  newTrack.type === TrackType.SOFTWARE_INSTRUMENT
                    ? (newTrack as SoftwareInstrumentTrack).instrumentId
                    : undefined,
              })
            );

            // Wait for DOM update and apply visual effects
            await new Promise((res) => requestAnimationFrame(res));

            const trackEls = Array.from(
              document.querySelectorAll(`[data-track-id="${newTrackId}"]`)
            ) as HTMLElement[];

            trackEls.forEach((el) => {
              el.style.transition = "opacity 150ms ease-out";
            });

            // Lightning animation
            try {
              const startEl = document.querySelector(
                ".ai-sidebar-container.circle-mode"
              ) as HTMLElement | null;
              const endEl = trackEls[0] || null;
              if (startEl && endEl) {
                const { triggerLightning } = await import(
                  "../utils/lightningEffect"
                );
                await triggerLightning(startEl, endEl, "#00eaff", 450);
              }
            } catch {
              /* ignore visual errors */
            }

            // Fade in
            requestAnimationFrame(() => {
              trackEls.forEach((el) => {
                el.style.opacity = "1";
              });
              styleEl.remove();
            });

            // Update the track with preserved settings after creation
            if (preserveSettings) {
              setTimeout(() => {
                dispatch(
                  updateTrack({
                    id: newTrackId,
                    changes: {
                      volume: targetTrack.volume,
                      pan: targetTrack.pan,
                      color: targetTrack.color,
                      height: targetTrack.height,
                      isMuted: targetTrack.isMuted,
                      inserts: targetTrack.inserts
                        ? [...targetTrack.inserts]
                        : undefined,
                    },
                  })
                );

                // Add regions after track is fully created
                if (newTrack.regions.length > 0) {
                  newTrack.regions.forEach((region) => {
                    dispatch(
                      addMidiRegionAction({ trackId: newTrackId, region })
                    );
                  });
                }
              }, 200);
            }

            executed = true;
            message = `Duplicated track "${trackName}" with${
              preserveSettings ? " all settings and content" : "out content"
            } preserved.`;
          } catch (error) {
            console.error("Error duplicating track:", error);
            message = `Failed to duplicate track "${trackName}".`;
          }
        } else {
          message = `Could not find track "${trackName}" to duplicate.`;
        }

        return {
          type: commandType,
          confidence: 0.95,
          executed,
          details: {
            message,
            trackName,
          },
        };
      }

      if (commandType === "duplicate_audio_file" && paramDetails) {
        const { regionId, regionName, trackName } =
          paramDetails as DuplicateAudioFileCommand;
        let message = "";
        let executed = false;

        // Find the region to duplicate
        let regionToDuplicate: MidiRegion | null = null;
        let parentTrack: Track | null = null;

        for (const track of tracks) {
          const foundRegion = track.regions.find((r) => r.id === regionId);
          if (foundRegion) {
            regionToDuplicate = foundRegion;
            parentTrack = track;
            break;
          }
        }

        if (regionToDuplicate && parentTrack) {
          try {
            // Calculate the duration for positioning the duplicate
            const regionDuration =
              regionToDuplicate.audioDuration ||
              Math.max(
                1,
                regionToDuplicate.notes.reduce(
                  (max, n) =>
                    Math.max(
                      max,
                      n.startTime + n.duration - regionToDuplicate.startTime
                    ),
                  0
                )
              );

            // Use trimmed duration if trimming is applied
            const trimStart = regionToDuplicate.trimStart ?? 0;
            const trimEnd = regionToDuplicate.trimEnd ?? regionDuration;
            const effectiveDuration = trimEnd - trimStart;

            // Create duplicate region positioned right after the original
            const duplicateRegion: MidiRegion = {
              id: crypto.randomUUID(),
              trackId: parentTrack.id,
              name: `${regionToDuplicate.name} copy`,
              startTime: regionToDuplicate.startTime + effectiveDuration,
              notes: regionToDuplicate.notes.map((note) => ({
                ...note,
                id: crypto.randomUUID(), // Generate new IDs for notes
              })),
              color: regionToDuplicate.color,
              audioFilename: regionToDuplicate.audioFilename,
              waveform_data: regionToDuplicate.waveform_data,
              audioDuration: regionToDuplicate.audioDuration,
              isLooped: regionToDuplicate.isLooped,
              loopDuration: regionToDuplicate.loopDuration,
              trimStart: regionToDuplicate.trimStart,
              trimEnd: regionToDuplicate.trimEnd,
            };

            // Add the duplicate region
            dispatch(
              addMidiRegionAction({
                trackId: parentTrack.id,
                region: duplicateRegion,
              })
            );

            executed = true;
            message = `Duplicated audio file "${regionName}" on track "${trackName}".`;
          } catch (error) {
            console.error("Error duplicating audio file:", error);
            message = `Failed to duplicate audio file "${regionName}".`;
          }
        } else {
          message = `Could not find audio file "${regionName}" to duplicate.`;
        }

        return {
          type: commandType,
          confidence: 0.95,
          executed,
          details: {
            message,
          },
        };
      }

      if (commandType === "parameter_change" && paramDetails) {
        const {
          type,
          trackId,
          trackName,
          currentValue,
          targetValue,
          requestedPanDirection,
          isExtremePanRequest,
        } = paramDetails as ParameterChangeCommand;
        const trackFromStore = store
          .getState()
          .project.present.tracks.find((t) => t.id === trackId);
        if (!trackFromStore)
          return {
            type: commandType,
            confidence: 0.9,
            executed: false,
            details: {
              parameter: type,
              trackName,
              oldValue: Math.round(currentValue),
              newValue: targetValue,
              message: `Track "${trackName}" not found.`,
            },
          };
        const actualCurrentValueFromStore =
          typeof trackFromStore[type] === "number"
            ? Math.round(trackFromStore[type] as number)
            : type === "volume"
            ? 80
            : 0;
        let finalTargetValue = Math.round(targetValue);
        if (type === "volume")
          finalTargetValue = Math.max(0, Math.min(100, finalTargetValue));
        else if (type === "pan")
          finalTargetValue = Math.max(-100, Math.min(100, finalTargetValue));
        if (finalTargetValue !== actualCurrentValueFromStore) {
          dispatch(
            updateTrack({ id: trackId, changes: { [type]: finalTargetValue } })
          );
          const message = `Set ${type} for "${trackName}" to ${finalTargetValue}.`;
          return {
            type: commandType,
            confidence: 0.95,
            executed: true,
            details: {
              parameter: type,
              trackName,
              oldValue: actualCurrentValueFromStore,
              newValue: finalTargetValue,
              message,
              requestedPanDirection,
              isExtremePanRequest,
            },
          };
        } else {
          const message = `"${trackName}" ${type} is already at ${finalTargetValue}.`;
          return {
            type: commandType,
            confidence: 0.9,
            executed: false,
            details: {
              parameter: type,
              trackName,
              oldValue: actualCurrentValueFromStore,
              newValue: finalTargetValue,
              message,
              requestedPanDirection,
              isExtremePanRequest,
            },
          };
        }
      }

      if (commandType === "help" && paramDetails) {
        const helpDetails = paramDetails as { message?: string };
        if (helpDetails.message) {
          return {
            type: commandType,
            confidence: 0.95,
            executed: true,
            details: { message: helpDetails.message },
          };
        }
      }

      switch (commandType) {
        case "play":
          if (!playingNow) {
            try {
              const startEl = document.querySelector(
                ".ai-sidebar-container.circle-mode"
              ) as HTMLElement | null;
              const endEl = document.querySelector(
                'button[title="Pause"], button[title="Play"]'
              ) as HTMLElement | null;
              const { triggerLightning } = await import(
                "../utils/lightningEffect"
              );
              if (startEl && endEl)
                await triggerLightning(startEl, endEl, "#00eaff", 450);
            } catch {
              /* ignore visual-effect errors */
            }
            dispatch(setPlaying(true));
            const success = await waitForStateChange(
              () => store.getState().sonification.isPlaying === true
            );
            return {
              type: commandType,
              confidence: 0.9,
              executed: success,
              details: {
                message: success
                  ? "Playback started."
                  : "Failed to start playback.",
              },
            };
          }
          return {
            type: commandType,
            confidence: 0.9,
            executed: false,
            details: { message: "Playback is already active." },
          };
        case "pause":
          if (playingNow) {
            try {
              const startEl2 = document.querySelector(
                ".ai-sidebar-container.circle-mode"
              ) as HTMLElement | null;
              const endEl2 = document.querySelector(
                'button[title="Pause"], button[title="Play"]'
              ) as HTMLElement | null;
              const { triggerLightning } = await import(
                "../utils/lightningEffect"
              );
              if (startEl2 && endEl2)
                await triggerLightning(startEl2, endEl2, "#00eaff", 450);
            } catch {}
            dispatch(setPlaying(false));
            const success = await waitForStateChange(
              () => store.getState().sonification.isPlaying === false
            );
            return {
              type: commandType,
              confidence: 0.9,
              executed: success,
              details: {
                message: success
                  ? "Playback paused."
                  : "Failed to pause playback.",
              },
            };
          }
          return {
            type: commandType,
            confidence: 0.9,
            executed: false,
            details: { message: "Playback is already paused." },
          };
        default: {
          // For unhandled command types, avoid spamming the chat with
          // "I recognized an unknown command..." – especially when the text
          // is simply conversational.  If the command type itself is
          // "unknown" we return no system message so the language-model reply
          // can flow naturally.  For other unimplemented types, keep the
          // explanatory message.

          const showMessage = commandType !== "unknown";

          return {
            type: commandType,
            confidence: 0.65,
            executed: false,
            details: showMessage
              ? {
                  message: `I recognized a '${commandType}' command, but I'm not sure how to execute it yet.`,
                  ...(paramDetails || {}),
                }
              : undefined,
          };
        }
      }
    },
    [
      dispatch,
      isPlaying,
      isMetronomeEnabled,
      isCycleModeEnabled,
      timeSignature,
      tracks,
      currentPixelsPerBeatFromStore,
      playheadPosition,
      tempo,
    ]
  );

  const processMessage = useCallback(
    async (
      userInput: string,
      showUserMessage: boolean = true,
      showAssistantMessage: boolean = true
    ): Promise<string | void> => {
      const trimmedInput = userInput.trim();
      if (!trimmedInput) return;
      if (isLoading && trimmedInput === lastProcessedUserInputRef.current)
        return;

      const isVoice = !showUserMessage;

      if (showUserMessage) {
        addMessage("user", trimmedInput);
      }
      lastProcessedUserInputRef.current = trimmedInput;
      setIsLoading(true);
      hasAddedAssistantResponseRef.current = false;

      try {
        // NEW AI-DRIVEN APPROACH: Let the AI model create and execute command plans
        const currentState = {
          isPlaying,
          tracks,
          tempo,
          timeSignature,
          isMetronomeEnabled,
          isCycleModeEnabled,
          isAiSidebarOpen,
        };

        console.log(
          "[AI_DRIVEN] Asking AI to create command plan for:",
          trimmedInput
        );

        // Get personalized instructions for the AI
        const personalizedInstructions = await getPersonalizedInstructions();

        // First, let the AI create a command execution plan
        const commandPlan = await musicAiService.createCommandPlan(
          trimmedInput,
          currentState,
          messages.slice(-10), // Pass recent conversation history for context
          personalizedInstructions
        );

        let finalResponseTextForDisplay = "";

        if (
          commandPlan &&
          commandPlan.commands &&
          commandPlan.commands.length > 0
        ) {
          console.log("[AI_DRIVEN] AI created plan:", commandPlan);

          // Execute the AI's command plan
          const executionResult = await musicAiService.executeCommandPlan(
            commandPlan,
            dispatch,
            currentState,
            trimmedInput
          );

          console.log("[AI_DRIVEN] Execution result:", executionResult);

          if (executionResult.success) {
            // Show a clean, consolidated response
            finalResponseTextForDisplay = executionResult.message;

            // Add details if there were any failures
            if (executionResult.failedCommands.length > 0) {
              finalResponseTextForDisplay += ` Note: ${executionResult.failedCommands.length} command(s) could not be executed.`;
            }

            // Store successful command interaction
            try {
              await musicAiService.storeUserInteraction(
                trimmedInput,
                finalResponseTextForDisplay,
                "command_success",
                commandPlan.commands?.map((cmd) => cmd.type).join(", "),
                true,
                {
                  tracks_count: currentState.tracks.length,
                  is_playing: currentState.isPlaying,
                  tempo: currentState.tempo,
                  executed_commands: executionResult.executedCommands,
                  failed_commands: executionResult.failedCommands,
                  command_plan_id: commandPlan.id,
                }
              );
              console.log(
                "[USER_INTERACTIONS] ✅ Stored successful command interaction"
              );
            } catch (error) {
              console.error(
                "[USER_INTERACTIONS] Error storing successful command interaction:",
                error
              );
            }

            // Extract learnable information from successful commands too
            try {
              await musicAiService.analyzeAndStoreUserLearning(
                trimmedInput,
                messages
                  .slice(-5)
                  .map((m) => `${m.role}: ${m.content}`)
                  .join("\n")
              );
            } catch (error) {
              console.error(
                "[USER_LEARNING] Error analyzing learning from successful command:",
                error
              );
            }
          } else {
            // If execution failed completely, check if it's because of unimplemented features
            if (executionResult.failedCommands.length > 0) {
              // Check if all failures are due to unimplemented commands
              const allUnimplemented = executionResult.failedCommands.every(
                (cmd) =>
                  cmd.includes("being crafted") ||
                  cmd.includes("coming soon") ||
                  cmd.includes("in development") ||
                  cmd.includes("being fine-tuned") ||
                  cmd.includes("being developed") ||
                  cmd.includes("on the way") ||
                  cmd.includes("in the works")
              );

              if (
                allUnimplemented &&
                executionResult.failedCommands.length === 1
              ) {
                // Single unimplemented feature - use the friendly message directly
                finalResponseTextForDisplay =
                  executionResult.failedCommands[0].split(": ")[1] ||
                  executionResult.failedCommands[0];

                // Log the unimplemented feature request
                console.log(
                  "[FAILED_COMMANDS] Single unimplemented feature logged by executeCommandPlan"
                );
              } else if (allUnimplemented) {
                // Multiple unimplemented features - use AI to respond intelligently
                try {
                  finalResponseTextForDisplay =
                    await musicAiService.getChatResponse(
                      trimmedInput,
                      currentState.isPlaying,
                      currentState.tracks,
                      messages.slice(-10),
                      isVoice,
                      personalizedInstructions
                    );
                } catch (error) {
                  console.error(
                    "[AI_RESPONSE] Error generating response for unimplemented features:",
                    error
                  );
                  finalResponseTextForDisplay =
                    "I understand what you're trying to do, but those features aren't available yet. I can help with track management, playback controls, and basic mixing instead!";
                }

                // Log the multiple unimplemented features request
                console.log(
                  "[FAILED_COMMANDS] Multiple unimplemented features logged by executeCommandPlan"
                );
              } else {
                // Mixed success/failure or other errors - fall back to conversational AI
                finalResponseTextForDisplay =
                  await musicAiService.getChatResponse(
                    trimmedInput,
                    currentState.isPlaying,
                    currentState.tracks,
                    messages.slice(-10),
                    isVoice,
                    personalizedInstructions
                  );
              }
            } else {
              // No specific failure messages - fall back to conversational AI
              finalResponseTextForDisplay =
                await musicAiService.getChatResponse(
                  trimmedInput,
                  currentState.isPlaying,
                  currentState.tracks,
                  messages.slice(-10),
                  isVoice,
                  personalizedInstructions
                );
            }
          }
        } else {
          // No command plan created - this could be conversational OR an unhandled command request
          console.log(
            "[AI_DRIVEN] No command plan created, analyzing intent..."
          );

          // First, try to get a regular conversational response from the AI
          finalResponseTextForDisplay = await musicAiService.getChatResponse(
            trimmedInput,
            currentState.isPlaying,
            currentState.tracks,
            messages.slice(-10),
            isVoice,
            personalizedInstructions
          );

          // Implement proper three-table system for interaction logging and learning

          // 1. ALWAYS store the raw interaction data - let AI intelligently categorize
          const interactionType = await (async () => {
            try {
              const categorizationResult =
                await musicAiService.categorizeInteraction(
                  trimmedInput,
                  finalResponseTextForDisplay
                );
              console.log(
                `[AI_CATEGORIZATION] ✅ Intelligent categorization: ${categorizationResult}`
              );
              return categorizationResult;
            } catch (error) {
              console.error(
                "[AI_CATEGORIZATION] Error categorizing interaction, falling back to conversation:",
                error
              );
              // Safe fallback - if AI categorization fails, default to conversation
              return "conversation";
            }
          })();

          try {
            await musicAiService.storeUserInteraction(
              trimmedInput,
              finalResponseTextForDisplay,
              interactionType as "command_failure" | "conversation",
              interactionType === "command_failure"
                ? "AI_COMMAND_PLAN_CREATION"
                : undefined,
              interactionType === "command_failure" ? false : undefined,
              {
                tracks_count: currentState.tracks.length,
                is_playing: currentState.isPlaying,
                tempo: currentState.tempo,
                conversation_context: messages
                  .slice(-3)
                  .map((m) => `${m.role}: ${m.content.substring(0, 50)}`)
                  .join("; "),
              }
            );
            console.log("[USER_INTERACTIONS] ✅ Stored interaction data");
          } catch (error) {
            console.error(
              "[USER_INTERACTIONS] Error storing interaction:",
              error
            );
          }

          // 2. Extract learnable information for ALL interactions (not just explicit teaching)
          try {
            await musicAiService.analyzeAndStoreUserLearning(
              trimmedInput,
              messages
                .slice(-5)
                .map((m) => `${m.role}: ${m.content}`)
                .join("\n")
            );
          } catch (error) {
            console.error(
              "[USER_LEARNING] Error analyzing for learning:",
              error
            );
          }

          // 3. For failed commands specifically, also store technical failure details
          if (interactionType === "command_failure") {
            console.log(
              "[AI_ANALYSIS] ❌ AI detected failed command attempt - storing technical details"
            );
            try {
              await musicAiService.storeUnrecognizedRequest(
                trimmedInput,
                "Command intent detected but no execution plan could be created",
                `AI response: ${finalResponseTextForDisplay.substring(
                  0,
                  100
                )}...`
              );
              console.log(
                "[FAILED_COMMANDS] ✅ Stored technical failure details for developers"
              );
            } catch (error) {
              console.error(
                "[FAILED_COMMANDS] Error storing failed command:",
                error
              );
            }
          } else {
            console.log(
              `[AI_ANALYSIS] ✅ AI detected successful ${interactionType} interaction`
            );
          }
        }

        // For voice commands that are simple transport (play/pause), don't show response
        const isSimpleTransport =
          commandPlan?.commands?.length === 1 &&
          ["play", "pause"].includes(commandPlan.commands[0].type) &&
          isVoice;

        if (isSimpleTransport) {
          finalResponseTextForDisplay = "";
        }

        if (
          showAssistantMessage &&
          finalResponseTextForDisplay.trim() &&
          !hasAddedAssistantResponseRef.current
        ) {
          addMessage("assistant", finalResponseTextForDisplay);
          hasAddedAssistantResponseRef.current = true;
        }

        // Learn from this interaction
        if (finalResponseTextForDisplay.trim()) {
          const context = commandPlan ? "command_execution" : "conversation";
          learnFromInteraction(
            trimmedInput,
            finalResponseTextForDisplay,
            context
          );
        }

        return finalResponseTextForDisplay;
      } catch (error: any) {
        const errorMsg = error?.message || "Please try again.";
        console.error("[AI_HOOK] Error processing message:", error);
        if (showAssistantMessage && !hasAddedAssistantResponseRef.current) {
          addMessage("assistant", `I encountered an error: ${errorMsg}`);
          hasAddedAssistantResponseRef.current = true;
        }
        setErrorMessage(errorMsg);
        return isVoice ? `I encountered an error: ${errorMsg}` : undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [
      addMessage,
      dispatch,
      isLoading,
      messages,
      tracks,
      isPlaying,
      tempo,
      isCycleModeEnabled,
      timeSignature,
      isMetronomeEnabled,
      isAiSidebarOpen,
      getPersonalizedInstructions,
      learnFromInteraction,
    ]
  );

  const clearMessages = useCallback((): void => {
    setMessages([
      {
        role: "system",
        content:
          "Welcome to MuseRoom AI Assistant! I can help you control your music production. Try asking me to play or pause, or adjust track parameters.",
        timestamp: Date.now(),
      },
    ]);
  }, []);

  return {
    messages,
    isLoading,
    processMessage,
    addMessage,
    clearMessages,
    isInitialized,
    errorMessage,
    getFailedCommands: () =>
      FailedCommandTracker.getInstance().getFailedCommands(),
    getRecentFailures: (hours?: number) =>
      FailedCommandTracker.getInstance().getRecentFailures(hours),
    clearFailedCommands: () => FailedCommandTracker.getInstance().clear(),
  };
};

export default useAiAssistant;
