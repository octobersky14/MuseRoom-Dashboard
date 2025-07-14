import NotionService, { NotionPage, NotionDatabase, NotionBlock } from './notionService';
import { NotionTask } from '@/types';

// Interfaces for workspace analysis results
export interface TeamInfo {
  id: string;
  name: string;
  homepageId: string;
  homepageUrl: string;
  description?: string;
  members?: TeamMember[];
  projects?: ProjectInfo[];
  recentActivity?: ActivityItem[];
}

export interface TeamMember {
  id: string;
  name: string;
  role?: string;
  avatarUrl?: string;
  email?: string;
  teams?: string[];
}

export interface ProjectInfo {
  id: string;
  name: string;
  status: string;
  team?: string;
  completionPercentage?: number;
  dueDate?: string;
  description?: string;
  tasks?: NotionTask[];
}

export interface DatabaseInfo {
  id: string;
  name: string;
  purpose: string;
  itemCount?: number;
  lastUpdated?: string;
  url: string;
  icon?: string;
}

export interface ActivityItem {
  id: string;
  type: 'page_edit' | 'task_update' | 'comment' | 'meeting_note';
  title: string;
  date: string;
  actor?: string;
  url?: string;
}

export interface WorkspaceOverview {
  teams: TeamInfo[];
  databases: DatabaseInfo[];
  recentActivity: ActivityItem[];
  projects: ProjectInfo[];
  members: TeamMember[];
  organizationalStructure: {
    mainTeams: string[];
    subTeams?: Record<string, string[]>;
  };
}

/**
 * WorkspaceAnalyzer
 * 
 * Analyzes the Notion workspace to provide a comprehensive overview
 * of teams, projects, databases, and organizational structure.
 */
class WorkspaceAnalyzer {
  private notionService: NotionService;
  private cachedOverview: WorkspaceOverview | null = null;
  private lastAnalysisTime: number = 0;
  private cacheValidityPeriod: number = 5 * 60 * 1000; // 5 minutes
  
  constructor(notionApiKey: string) {
    this.notionService = new NotionService(notionApiKey);
  }

  /**
   * Get a comprehensive overview of the workspace
   */
  public async getWorkspaceOverview(forceRefresh: boolean = false): Promise<WorkspaceOverview> {
    const now = Date.now();
    
    // Return cached results if valid and refresh not forced
    if (
      !forceRefresh && 
      this.cachedOverview && 
      now - this.lastAnalysisTime < this.cacheValidityPeriod
    ) {
      return this.cachedOverview;
    }
    
    try {
      // Perform full workspace analysis
      const teams = await this.analyzeTeams();
      const databases = await this.analyzeDatabases();
      const recentActivity = await this.getRecentActivity();
      const projects = await this.analyzeProjects();
      const members = await this.analyzeTeamMembers();
      
      // Create organizational structure
      const organizationalStructure = {
        mainTeams: teams.map(team => team.name)
      };
      
      // Combine all analysis results
      this.cachedOverview = {
        teams,
        databases,
        recentActivity,
        projects,
        members,
        organizationalStructure
      };
      
      this.lastAnalysisTime = now;
      return this.cachedOverview;
    } catch (error) {
      console.error('Error analyzing workspace:', error);
      
      // Return cached results if available, even if expired
      if (this.cachedOverview) {
        return this.cachedOverview;
      }
      
      // Return empty structure if no cache available
      return {
        teams: [],
        databases: [],
        recentActivity: [],
        projects: [],
        members: [],
        organizationalStructure: {
          mainTeams: []
        }
      };
    }
  }

  /**
   * Analyze team structure based on Home pages
   */
  private async analyzeTeams(): Promise<TeamInfo[]> {
    try {
      // Search for team home pages
      const homePages = await this.notionService.search('Home', {
        filter: { property: 'object', value: 'page' }
      });
      
      const teams: TeamInfo[] = [];
      
      // Process each home page
      for (const page of homePages.results) {
        // Skip pages that don't look like team home pages
        if (!page.properties?.title?.title?.[0]?.plain_text) continue;
        
        const title = page.properties.title.title[0].plain_text;
        
        // Identify team name from title
        let teamName = title;
        if (title.includes('Home')) {
          teamName = title.replace('Home', '').replace('Page', '').trim();
        }
        
        // Skip if it doesn't look like a team page
        if (!teamName) continue;
        
        // Create team info
        const team: TeamInfo = {
          id: page.id,
          name: teamName,
          homepageId: page.id,
          homepageUrl: page.url,
        };
        
        // Try to get team description from page content
        try {
          const blocks = await this.notionService.getPageContent(page.id);
          if (blocks.length > 0) {
            // Look for the first paragraph that might contain a description
            for (const block of blocks) {
              if (
                block.type === 'paragraph' && 
                block.paragraph?.rich_text?.length > 0
              ) {
                team.description = block.paragraph.rich_text
                  .map(text => text.plain_text)
                  .join('');
                break;
              }
            }
          }
        } catch (error) {
          console.warn(`Could not fetch content for team page ${page.id}:`, error);
        }
        
        teams.push(team);
      }
      
      return teams;
    } catch (error) {
      console.error('Error analyzing teams:', error);
      return [];
    }
  }

  /**
   * Analyze databases and their purposes
   */
  private async analyzeDatabases(): Promise<DatabaseInfo[]> {
    try {
      // Search for databases
      const databasesResult = await this.notionService.search('', {
        filter: { property: 'object', value: 'database' }
      });
      
      const databases: DatabaseInfo[] = [];
      
      // Process each database
      for (const db of databasesResult.results) {
        if (!db.title?.[0]?.plain_text) continue;
        
        const dbName = db.title[0].plain_text;
        
        // Determine database purpose based on name and properties
        let purpose = 'Unknown';
        
        // Check database name for common patterns
        if (dbName.includes('Task') || dbName.includes('To Do')) {
          purpose = 'Task management';
        } else if (dbName.includes('Project')) {
          purpose = 'Project tracking';
        } else if (dbName.includes('Resource')) {
          purpose = 'Resource library';
        } else if (dbName.includes('Meeting') || dbName.includes('Note')) {
          purpose = 'Meeting notes';
        } else if (dbName.includes('Team')) {
          purpose = 'Team information';
        } else if (dbName.includes('Goal')) {
          purpose = 'Goal tracking';
        } else if (dbName.includes('Lead') || dbName.includes('Waitlist')) {
          purpose = 'Customer/Lead management';
        } else {
          // Analyze properties to guess purpose
          const properties = db.properties || {};
          const propertyNames = Object.keys(properties).map(key => properties[key].name);
          
          if (propertyNames.includes('Status') && propertyNames.includes('Assignee')) {
            purpose = 'Task or project management';
          } else if (propertyNames.includes('Date') && propertyNames.includes('Attendees')) {
            purpose = 'Meeting or event tracking';
          } else if (propertyNames.includes('URL') && propertyNames.includes('Type')) {
            purpose = 'Resource or link collection';
          }
        }
        
        databases.push({
          id: db.id,
          name: dbName,
          purpose,
          url: db.url,
          icon: db.icon?.type === 'emoji' ? db.icon.emoji : undefined
        });
      }
      
      return databases;
    } catch (error) {
      console.error('Error analyzing databases:', error);
      return [];
    }
  }

  /**
   * Get recent activity in the workspace
   */
  private async getRecentActivity(): Promise<ActivityItem[]> {
    try {
      // Search for recently edited pages
      const recentPages = await this.notionService.search('', {
        sort: {
          direction: 'descending',
          timestamp: 'last_edited_time'
        },
        page_size: 10
      });
      
      const activities: ActivityItem[] = [];
      
      // Process recent pages
      for (const page of recentPages.results) {
        if (!page.properties?.title?.title?.[0]?.plain_text) continue;
        
        const title = page.properties.title.title[0].plain_text;
        const lastEditTime = page.last_edited_time;
        const editor = page.last_edited_by?.name || 'Unknown';
        
        // Determine activity type
        let type: ActivityItem['type'] = 'page_edit';
        
        if (page.parent?.type === 'database_id') {
          // Check if it's a task
          if (
            page.properties?.Status || 
            title.includes('Task') || 
            title.includes('TODO')
          ) {
            type = 'task_update';
          } else if (title.includes('Meeting') || title.includes('Notes')) {
            type = 'meeting_note';
          }
        }
        
        activities.push({
          id: page.id,
          type,
          title,
          date: lastEditTime,
          actor: editor,
          url: page.url
        });
      }
      
      return activities;
    } catch (error) {
      console.error('Error getting recent activity:', error);
      return [];
    }
  }

  /**
   * Analyze projects and their status
   */
  private async analyzeProjects(): Promise<ProjectInfo[]> {
    try {
      // Find project databases
      const databases = await this.analyzeDatabases();
      const projectDbs = databases.filter(db => 
        db.purpose.includes('Project') || 
        db.name.includes('Project')
      );
      
      if (projectDbs.length === 0) {
        // Try to find projects by searching
        const projectSearch = await this.notionService.search('Project', {
          filter: { property: 'object', value: 'page' }
        });
        
        return projectSearch.results
          .filter(page => page.properties?.title?.title?.[0]?.plain_text)
          .map(page => {
            const title = page.properties.title.title[0].plain_text;
            let status = 'Unknown';
            
            // Try to extract status from properties
            if (page.properties?.Status) {
              if (typeof page.properties.Status.status?.name === 'string') {
                status = page.properties.Status.status.name;
              } else if (typeof page.properties.Status.select?.name === 'string') {
                status = page.properties.Status.select.name;
              }
            }
            
            return {
              id: page.id,
              name: title,
              status,
              url: page.url
            };
          });
      }
      
      const projects: ProjectInfo[] = [];
      
      // For each project database, get its pages
      for (const projectDb of projectDbs) {
        try {
          const dbPages = await this.notionService.queryDatabase(projectDb.id, {
            sorts: [{ property: 'last_edited_time', direction: 'descending' }],
            page_size: 20
          });
          
          for (const page of dbPages.results) {
            if (!page.properties?.title?.title?.[0]?.plain_text) continue;
            
            const title = page.properties.title.title[0].plain_text;
            let status = 'Unknown';
            let team: string | undefined;
            let completionPercentage: number | undefined;
            let dueDate: string | undefined;
            let description: string | undefined;
            
            // Extract project properties
            if (page.properties) {
              // Status
              if (page.properties.Status) {
                if (typeof page.properties.Status.status?.name === 'string') {
                  status = page.properties.Status.status.name;
                } else if (typeof page.properties.Status.select?.name === 'string') {
                  status = page.properties.Status.select.name;
                }
              }
              
              // Team
              if (page.properties.Team || page.properties.Teams) {
                const teamProp = page.properties.Team || page.properties.Teams;
                if (teamProp.select?.name) {
                  team = teamProp.select.name;
                } else if (teamProp.multi_select?.[0]?.name) {
                  team = teamProp.multi_select[0].name;
                }
              }
              
              // Completion
              if (page.properties.Completion || page.properties.Progress) {
                const completionProp = page.properties.Completion || page.properties.Progress;
                if (typeof completionProp.number === 'number') {
                  completionPercentage = completionProp.number;
                } else if (typeof completionProp.rollup?.number === 'number') {
                  completionPercentage = completionProp.rollup.number;
                }
              }
              
              // Due date
              if (page.properties['Due Date'] || page.properties.Due || page.properties.Deadline) {
                const dueDateProp = page.properties['Due Date'] || page.properties.Due || page.properties.Deadline;
                if (dueDateProp.date?.start) {
                  dueDate = dueDateProp.date.start;
                }
              }
              
              // Description
              if (page.properties.Description || page.properties.Summary) {
                const descProp = page.properties.Description || page.properties.Summary;
                if (descProp.rich_text?.[0]?.plain_text) {
                  description = descProp.rich_text.map(text => text.plain_text).join('');
                }
              }
            }
            
            projects.push({
              id: page.id,
              name: title,
              status,
              team,
              completionPercentage,
              dueDate,
              description
            });
          }
        } catch (error) {
          console.warn(`Error querying project database ${projectDb.id}:`, error);
        }
      }
      
      return projects;
    } catch (error) {
      console.error('Error analyzing projects:', error);
      return [];
    }
  }

  /**
   * Analyze team members and their roles
   */
  private async analyzeTeamMembers(): Promise<TeamMember[]> {
    try {
      // Try to find a team members database or user mentions
      const userMentions = new Map<string, TeamMember>();
      
      // Collect users from recent activity
      const recentActivity = await this.getRecentActivity();
      for (const activity of recentActivity) {
        if (activity.actor && !userMentions.has(activity.actor)) {
          userMentions.set(activity.actor, {
            id: `user_${activity.actor.replace(/\s+/g, '_').toLowerCase()}`,
            name: activity.actor
          });
        }
      }
      
      // Look for users in project assignments
      const projects = await this.analyzeProjects();
      for (const project of projects) {
        // Try to get project content to find assignees
        try {
          const blocks = await this.notionService.getPageContent(project.id);
          for (const block of blocks) {
            // Look for mentions in text
            if (block.type === 'paragraph' && block.paragraph?.rich_text) {
              for (const text of block.paragraph.rich_text) {
                if (text.type === 'mention' && text.mention?.type === 'user') {
                  const user = text.mention.user;
                  if (user.name && !userMentions.has(user.name)) {
                    userMentions.set(user.name, {
                      id: user.id,
                      name: user.name,
                      avatarUrl: user.avatar_url
                    });
                  }
                }
              }
            }
          }
        } catch (error) {
          // Ignore errors for individual projects
        }
      }
      
      // If we found very few users, try a general search for people mentions
      if (userMentions.size < 3) {
        try {
          // Search for pages that might contain user information
          const peoplePages = await this.notionService.search('team member', {
            filter: { property: 'object', value: 'page' }
          });
          
          for (const page of peoplePages.results.slice(0, 5)) {
            const blocks = await this.notionService.getPageContent(page.id);
            for (const block of blocks) {
              // Look for mentions in text
              if (block.type === 'paragraph' && block.paragraph?.rich_text) {
                for (const text of block.paragraph.rich_text) {
                  if (text.type === 'mention' && text.mention?.type === 'user') {
                    const user = text.mention.user;
                    if (user.name && !userMentions.has(user.name)) {
                      userMentions.set(user.name, {
                        id: user.id,
                        name: user.name,
                        avatarUrl: user.avatar_url
                      });
                    }
                  }
                }
              }
            }
          }
        } catch (error) {
          console.warn('Error searching for people mentions:', error);
        }
      }
      
      // Try to infer roles from context
      const members = Array.from(userMentions.values());
      const teams = await this.analyzeTeams();
      
      // Associate members with teams based on activity
      for (const member of members) {
        // Look for team associations in recent activity
        const memberActivities = recentActivity.filter(
          activity => activity.actor === member.name
        );
        
        const teamMentions = new Map<string, number>();
        
        for (const activity of memberActivities) {
          // Check if activity title contains team name
          for (const team of teams) {
            if (activity.title.includes(team.name)) {
              teamMentions.set(team.name, (teamMentions.get(team.name) || 0) + 1);
            }
          }
        }
        
        // Assign teams with the most mentions
        if (teamMentions.size > 0) {
          const sortedTeams = Array.from(teamMentions.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([team]) => team);
          
          member.teams = sortedTeams;
          
          // Guess role based on team and activity patterns
          if (sortedTeams.length > 0) {
            const primaryTeam = sortedTeams[0];
            
            // Check if they might be a team lead
            const teamLeadIndicators = memberActivities.filter(
              activity => 
                activity.title.includes('Lead') || 
                activity.title.includes('Manager') ||
                activity.title.includes('Head of')
            ).length;
            
            if (teamLeadIndicators > 0) {
              member.role = `${primaryTeam} Lead`;
            } else {
              member.role = `${primaryTeam} Team`;
            }
          }
        }
      }
      
      return members;
    } catch (error) {
      console.error('Error analyzing team members:', error);
      return [];
    }
  }

  /**
   * Get information about a specific team
   */
  public async getTeamInfo(teamName: string): Promise<TeamInfo | null> {
    try {
      const overview = await this.getWorkspaceOverview();
      
      // Find team by name (case insensitive)
      const teamNameLower = teamName.toLowerCase();
      const team = overview.teams.find(
        t => t.name.toLowerCase().includes(teamNameLower)
      );
      
      if (!team) return null;
      
      // Enrich team info with members and projects
      team.members = overview.members.filter(
        member => member.teams?.some(t => t.toLowerCase().includes(teamNameLower))
      );
      
      team.projects = overview.projects.filter(
        project => 
          project.team?.toLowerCase().includes(teamNameLower) || 
          project.name.toLowerCase().includes(teamNameLower)
      );
      
      team.recentActivity = overview.recentActivity.filter(
        activity => activity.title.toLowerCase().includes(teamNameLower)
      );
      
      return team;
    } catch (error) {
      console.error(`Error getting info for team "${teamName}":`, error);
      return null;
    }
  }

  /**
   * Get information about what a specific team is working on
   */
  public async getTeamWorkStatus(teamName: string): Promise<string> {
    try {
      const team = await this.getTeamInfo(teamName);
      
      if (!team) {
        return `Could not find information about the ${teamName} team.`;
      }
      
      // Build a summary of what the team is working on
      let summary = `The ${team.name} team `;
      
      if (team.members && team.members.length > 0) {
        summary += `consists of ${team.members.length} members `;
        if (team.members.length <= 5) {
          summary += `(${team.members.map(m => m.name).join(', ')}) `;
        }
      }
      
      if (team.projects && team.projects.length > 0) {
        const activeProjects = team.projects.filter(
          p => p.status !== 'Completed' && p.status !== 'Done' && p.status !== 'Cancelled'
        );
        
        if (activeProjects.length > 0) {
          summary += `is currently working on ${activeProjects.length} active projects: `;
          summary += activeProjects.map(p => `"${p.name}" (${p.status})`).join(', ');
          
          // Add details about the most recent project
          const mostRecent = activeProjects[0];
          if (mostRecent.description) {
            summary += `. The most recent project "${mostRecent.name}" is described as: ${mostRecent.description}`;
          }
        } else {
          summary += `has ${team.projects.length} projects, but none are currently active.`;
        }
      } else {
        summary += `doesn't have any projects that I could find.`;
      }
      
      // Add recent activity if available
      if (team.recentActivity && team.recentActivity.length > 0) {
        summary += ` Recent activity includes: ${team.recentActivity.slice(0, 3).map(a => `"${a.title}"`).join(', ')}.`;
      }
      
      return summary;
    } catch (error) {
      console.error(`Error getting work status for team "${teamName}":`, error);
      return `I encountered an error while trying to get information about what the ${teamName} team is working on.`;
    }
  }

  /**
   * Get a summary of the entire workspace
   */
  public async getWorkspaceSummary(): Promise<string> {
    try {
      const overview = await this.getWorkspaceOverview();
      
      let summary = `# MuseRoom Workspace Overview\n\n`;
      
      // Teams summary
      summary += `## Teams (${overview.teams.length})\n`;
      for (const team of overview.teams) {
        summary += `- **${team.name}**: `;
        if (team.description) {
          summary += `${team.description.substring(0, 100)}${team.description.length > 100 ? '...' : ''}\n`;
        } else {
          summary += `No description available.\n`;
        }
      }
      
      // Projects summary
      const activeProjects = overview.projects.filter(
        p => p.status !== 'Completed' && p.status !== 'Done' && p.status !== 'Cancelled'
      );
      
      summary += `\n## Active Projects (${activeProjects.length})\n`;
      for (const project of activeProjects.slice(0, 5)) {
        summary += `- **${project.name}** (${project.status})`;
        if (project.team) {
          summary += ` - ${project.team} team`;
        }
        if (project.dueDate) {
          summary += ` - Due: ${project.dueDate}`;
        }
        summary += '\n';
      }
      
      // Databases summary
      summary += `\n## Key Databases (${overview.databases.length})\n`;
      for (const db of overview.databases.slice(0, 5)) {
        summary += `- **${db.name}**: ${db.purpose}\n`;
      }
      
      // Recent activity
      summary += `\n## Recent Activity\n`;
      for (const activity of overview.recentActivity.slice(0, 5)) {
        const date = new Date(activity.date).toLocaleDateString();
        summary += `- **${activity.title}** (${date})`;
        if (activity.actor) {
          summary += ` by ${activity.actor}`;
        }
        summary += '\n';
      }
      
      return summary;
    } catch (error) {
      console.error('Error getting workspace summary:', error);
      return 'I encountered an error while trying to generate a workspace summary.';
    }
  }
}

export default WorkspaceAnalyzer;
