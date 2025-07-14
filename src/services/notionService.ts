import { NotionTask } from "@/types";

export interface NotionPage {
  id: string;
  title: string;
  icon?: string;
  url: string;
  created_time: string;
  last_edited_time: string;
  properties: Record<string, any>;
  parent: {
    type: string;
    database_id?: string;
    page_id?: string;
  };
}

export interface NotionDatabase {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  url: string;
  created_time: string;
  last_edited_time: string;
  properties: Record<string, any>;
}

export interface NotionBlock {
  id: string;
  type: string;
  created_time: string;
  last_edited_time: string;
  has_children: boolean;
  content: any;
}

export interface CreatePageRequest {
  parent: {
    database_id?: string;
    page_id?: string;
  };
  properties: Record<string, any>;
  children?: any[];
  icon?: {
    type: "emoji" | "external" | "file";
    emoji?: string;
    external?: { url: string };
    file?: { url: string };
  };
}

export interface UpdatePageRequest {
  properties?: Record<string, any>;
  icon?: {
    type: "emoji" | "external" | "file";
    emoji?: string;
    external?: { url: string };
    file?: { url: string };
  };
}

/**
 * All Notion traffic is routed through a lightweight **local proxy**
 * (see `server.js`) in order to bypass the browser's CORS restrictions.
 * The proxy lives on http://localhost:3005/api/notion by default.
 *
 * We therefore:
 * 1. Point `baseUrl` at the proxy.
 * 2. Pass the integration token via the custom header **x-notion-api-key**.
 *    The proxy then re-injects the real `Authorization` and `Notion-Version`
 *    headers before forwarding to https://api.notion.com.
 */

class NotionService {
  private apiKey: string;
  /**
   * Proxy URL is configurable via Vite env so it can be changed without a
   * code-level edit (e.g. when the proxy runs on a different host / port in CI).
   * Falls back to the local default if the env-var is not defined.
   */
  private baseUrl =
    (import.meta as any).env?.VITE_NOTION_PROXY_URL ||
    "http://localhost:3005/api/notion";
  // Version is handled by the proxy – kept for reference only
  private version = "2022-06-28";
  // Enable verbose logging when running `VITE_DEBUG_NOTION=true vite`
  private debug =
    (import.meta as any).env?.VITE_DEBUG_NOTION === "true" ||
    (import.meta as any).env?.MODE === "development";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.debug(
        `[NotionService] Using proxy URL: ${this.baseUrl} (debug ON)`
      );
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    if (this.debug) {
      // eslint-disable-next-line no-console
      console.debug(
        `[NotionService] → ${options.method || "GET"} ${url}`,
        options.body ? JSON.parse(options.body as string) : ""
      );
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        // Send token to proxy; proxy adds real headers before forwarding
        "x-notion-api-key": this.apiKey,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Notion API Error: ${error.message || response.statusText}`
      );
    }

    if (this.debug) {
      // eslint-disable-next-line no-console
      console.debug(`[NotionService] ← ${response.status} ${url}`);
    }

    return response.json();
  }

  // Search for pages and databases
  async search(
    query?: string,
    filter?: { property: string; value: string }
  ): Promise<{
    results: (NotionPage | NotionDatabase)[];
    next_cursor?: string;
    has_more: boolean;
  }> {
    const body: any = {
      page_size: 100,
    };

    if (query) {
      body.query = query;
    }

    if (filter) {
      body.filter = {
        property: filter.property,
        rich_text: {
          contains: filter.value,
        },
      };
    }

    return this.makeRequest("/search", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  // Get all pages
  async getAllPages(): Promise<NotionPage[]> {
    const response = await this.search();
    return response.results.filter((item) => "parent" in item) as NotionPage[];
  }

  // Get all databases
  async getAllDatabases(): Promise<NotionDatabase[]> {
    const response = await this.search();
    return response.results.filter(
      (item) => "properties" in item && !("parent" in item)
    ) as NotionDatabase[];
  }

  // Get a specific page
  async getPage(pageId: string): Promise<NotionPage> {
    return this.makeRequest(`/pages/${pageId}`);
  }

  // Get a specific database
  async getDatabase(databaseId: string): Promise<NotionDatabase> {
    return this.makeRequest(`/databases/${databaseId}`);
  }

  // Get page content (blocks)
  async getPageContent(pageId: string): Promise<NotionBlock[]> {
    const response = await this.makeRequest(`/blocks/${pageId}/children`);
    return response.results;
  }

  // Query database
  async queryDatabase(
    databaseId: string,
    options: {
      filter?: any;
      sorts?: any[];
      start_cursor?: string;
      page_size?: number;
    } = {}
  ): Promise<{
    results: NotionPage[];
    next_cursor?: string;
    has_more: boolean;
  }> {
    const body = {
      page_size: options.page_size || 100,
      ...options,
    };

    return this.makeRequest(`/databases/${databaseId}/query`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  // Create a new page
  async createPage(request: CreatePageRequest): Promise<NotionPage> {
    return this.makeRequest("/pages", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  // Update a page
  async updatePage(
    pageId: string,
    request: UpdatePageRequest
  ): Promise<NotionPage> {
    return this.makeRequest(`/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify(request),
    });
  }

  // Delete a page (archive it)
  async deletePage(pageId: string): Promise<NotionPage> {
    return this.makeRequest(`/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({ archived: true }),
    });
  }

  // Add content to a page
  async addBlocksToPage(
    pageId: string,
    blocks: any[]
  ): Promise<{ results: NotionBlock[] }> {
    return this.makeRequest(`/blocks/${pageId}/children`, {
      method: "PATCH",
      body: JSON.stringify({ children: blocks }),
    });
  }

  // Helper method to create a task in a database
  async createTask(
    databaseId: string,
    task: {
      title: string;
      description?: string;
      status?: string;
      assignee?: string;
      dueDate?: string;
      priority?: string;
    }
  ): Promise<NotionPage> {
    const properties: any = {
      Name: {
        title: [
          {
            text: {
              content: task.title,
            },
          },
        ],
      },
    };

    if (task.description) {
      properties.Description = {
        rich_text: [
          {
            text: {
              content: task.description,
            },
          },
        ],
      };
    }

    if (task.status) {
      properties.Status = {
        select: {
          name: task.status,
        },
      };
    }

    if (task.assignee) {
      properties.Assignee = {
        rich_text: [
          {
            text: {
              content: task.assignee,
            },
          },
        ],
      };
    }

    if (task.dueDate) {
      properties["Due Date"] = {
        date: {
          start: task.dueDate,
        },
      };
    }

    if (task.priority) {
      properties.Priority = {
        select: {
          name: task.priority,
        },
      };
    }

    return this.createPage({
      parent: { database_id: databaseId },
      properties,
    });
  }

  // Helper method to get tasks from a database
  async getTasks(
    databaseId: string,
    filters?: {
      status?: string;
      assignee?: string;
      completed?: boolean;
    }
  ): Promise<NotionTask[]> {
    let filter: any = undefined;

    if (filters) {
      const conditions: any[] = [];

      if (filters.status) {
        conditions.push({
          property: "Status",
          select: {
            equals: filters.status,
          },
        });
      }

      if (filters.assignee) {
        conditions.push({
          property: "Assignee",
          rich_text: {
            contains: filters.assignee,
          },
        });
      }

      if (filters.completed !== undefined) {
        conditions.push({
          property: "Completed",
          checkbox: {
            equals: filters.completed,
          },
        });
      }

      if (conditions.length > 0) {
        filter = conditions.length === 1 ? conditions[0] : { and: conditions };
      }
    }

    const response = await this.queryDatabase(databaseId, { filter });

    return response.results.map((page) => ({
      id: page.id,
      title: this.extractTitle(page.properties),
      description: this.extractRichText(page.properties, "Description"),
      status: this.extractSelect(page.properties, "Status") as any,
      assignee: this.extractRichText(page.properties, "Assignee"),
      due_date: this.extractDate(page.properties, "Due Date"),
      created_at: page.created_time,
      updated_at: page.last_edited_time,
      properties: page.properties,
    }));
  }

  // Helper methods to extract data from Notion properties
  private extractTitle(properties: any): string {
    const titleProp = Object.values(properties).find(
      (prop: any) => prop.type === "title"
    ) as any;
    return titleProp?.title?.[0]?.text?.content || "Untitled";
  }

  private extractRichText(
    properties: any,
    propertyName: string
  ): string | undefined {
    const prop = properties[propertyName];
    return prop?.rich_text?.[0]?.text?.content;
  }

  private extractSelect(
    properties: any,
    propertyName: string
  ): string | undefined {
    const prop = properties[propertyName];
    return prop?.select?.name;
  }

  private extractDate(
    properties: any,
    propertyName: string
  ): string | undefined {
    const prop = properties[propertyName];
    return prop?.date?.start;
  }

  // Create common block types
  createTextBlock(text: string): any {
    return {
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          {
            type: "text",
            text: {
              content: text,
            },
          },
        ],
      },
    };
  }

  createHeadingBlock(text: string, level: 1 | 2 | 3 = 1): any {
    const type = `heading_${level}` as "heading_1" | "heading_2" | "heading_3";
    return {
      object: "block",
      type,
      [type]: {
        rich_text: [
          {
            type: "text",
            text: {
              content: text,
            },
          },
        ],
      },
    };
  }

  createBulletListBlock(items: string[]): any[] {
    return items.map((item) => ({
      object: "block",
      type: "bulleted_list_item",
      bulleted_list_item: {
        rich_text: [
          {
            type: "text",
            text: {
              content: item,
            },
          },
        ],
      },
    }));
  }

  createCheckboxBlock(text: string, checked: boolean = false): any {
    return {
      object: "block",
      type: "to_do",
      to_do: {
        rich_text: [
          {
            type: "text",
            text: {
              content: text,
            },
          },
        ],
        checked,
      },
    };
  }
}

export default NotionService;
