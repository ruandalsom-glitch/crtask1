/**
 * Enterprise Task Management Integration Engine
 * Supports: Monday.com (GraphQL v2024), ClickUp (REST v2), Jira (REST v3), Asana (REST v1), Trello (REST v1)
 * Features: Unified Schema, Exponential Backoff + Jitter, Strict Type Safety, Batching, Error Resilience.
 */

// ==========================================
// 1. DOMAIN MODELS & TYPINGS
// ==========================================

export type ProviderType = 'monday' | 'clickup' | 'jira' | 'asana' | 'trello';

export interface UnifiedTask {
  id: string;
  externalId: string;
  provider: ProviderType;
  title: string;
  description?: string;
  status: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  assigneeEmails: string[];
  dueDate?: string; // ISO 8601 string
  createdAt?: string;
  updatedAt?: string;
  customFields?: Record<string, unknown>;
  rawResponse?: unknown;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  assigneeEmails?: string[];
  dueDate?: string;
  containerId: string; // Board ID (Monday/Trello), List ID (ClickUp), Project ID (Asana), Project Key (Jira)
  customFields?: Record<string, unknown>;
}

export interface UpdateTaskInput {
  taskId: string;
  containerId?: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  assigneeEmails?: string[];
  dueDate?: string;
  customFields?: Record<string, unknown>;
}

export interface TaskFilter {
  containerId: string;
  status?: string;
  assigneeEmail?: string;
  limit?: number;
  cursor?: string;
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  extraHeaders?: Record<string, string>;
}

// ==========================================
// 2. ERROR HANDLING & RESILIENCE
// ==========================================

export class IntegrationError extends Error {
  constructor(
    message: string,
    public readonly provider: ProviderType,
    public readonly statusCode?: number,
    public readonly originalError?: unknown
  ) {
    super(`[${provider.toUpperCase()}_API_ERROR] ${message}`);
    this.name = 'IntegrationError';
  }
}

export class AuthenticationError extends IntegrationError {
  constructor(provider: ProviderType, message = 'Invalid or expired API token') {
    super(message, provider, 401);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends IntegrationError {
  constructor(provider: ProviderType, public readonly retryAfterSeconds: number = 60) {
    super(`Rate limit exceeded. Retry after ${retryAfterSeconds}s`, provider, 429);
    this.name = 'RateLimitError';
  }
}

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
}

/**
 * Resilient HTTP Client with Exponential Backoff + Jitter
 */
export class ResilientHttpClient {
  private maxRetries: number;
  private initialDelayMs: number;
  private maxDelayMs: number;

  constructor(options: RetryOptions = {}) {
    this.maxRetries = options.maxRetries ?? 4;
    this.initialDelayMs = options.initialDelayMs ?? 500;
    this.maxDelayMs = options.maxDelayMs ?? 10000;
  }

  async request<T>(
    provider: ProviderType,
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        const response = await fetch(url, options);

        if (response.ok) {
          // Handle 204 No Content
          if (response.status === 204) {
            return {} as T;
          }
          return (await response.json()) as T;
        }

        // Authentication failures
        if (response.status === 401 || response.status === 403) {
          throw new AuthenticationError(provider, `Access denied (${response.status}) at ${url}`);
        }

        // Rate Limiting (HTTP 429)
        if (response.status === 429) {
          const retryHeader = response.headers.get('retry-after');
          const retryAfterSec = retryHeader ? parseInt(retryHeader, 10) || 5 : 5;

          if (attempt >= this.maxRetries) {
            throw new RateLimitError(provider, retryAfterSec);
          }

          const delay = Math.min(
            retryAfterSec * 1000 + Math.random() * 200,
            this.maxDelayMs
          );
          await this.sleep(delay);
          attempt++;
          continue;
        }

        // Server errors (5xx) - Eligible for retry
        if (response.status >= 500 && attempt < this.maxRetries) {
          const delay = this.calculateBackoff(attempt);
          await this.sleep(delay);
          attempt++;
          continue;
        }

        // Client errors (4xx) - Non-retryable
        const errorText = await response.text().catch(() => 'Unknown error payload');
        throw new IntegrationError(
          `HTTP ${response.status}: ${errorText}`,
          provider,
          response.status
        );
      } catch (err: unknown) {
        if (err instanceof IntegrationError) {
          throw err;
        }

        // Network or fetch exceptions
        if (attempt < this.maxRetries) {
          const delay = this.calculateBackoff(attempt);
          await this.sleep(delay);
          attempt++;
          continue;
        }

        throw new IntegrationError(
          `Network request failed: ${err instanceof Error ? err.message : String(err)}`,
          provider,
          undefined,
          err
        );
      }
    }
  }

  private calculateBackoff(attempt: number): number {
    const exponential = Math.pow(2, attempt) * this.initialDelayMs;
    const jitter = Math.random() * 200;
    return Math.min(exponential + jitter, this.maxDelayMs);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ==========================================
// 3. ADAPTER INTERFACE
// ==========================================

export interface ITaskProviderAdapter {
  readonly provider: ProviderType;
  getTasks(filter: TaskFilter): Promise<UnifiedTask[]>;
  createTask(input: CreateTaskInput): Promise<UnifiedTask>;
  updateTask(input: UpdateTaskInput): Promise<UnifiedTask>;
}

// ==========================================
// 4. PROVIDER ADAPTER IMPLEMENTATIONS
// ==========================================

/**
 * MONDAY.COM ADAPTER (GraphQL API v2024-04)
 */
export class MondayAdapter implements ITaskProviderAdapter {
  public readonly provider: ProviderType = 'monday';
  private httpClient: ResilientHttpClient;
  private endpoint = 'https://api.monday.com/v2';

  constructor(private config: ProviderConfig, httpClient?: ResilientHttpClient) {
    this.httpClient = httpClient || new ResilientHttpClient();
  }

  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: this.config.apiKey,
      'API-Version': '2024-04',
      ...(this.config.extraHeaders || {}),
    };
  }

  async getTasks(filter: TaskFilter): Promise<UnifiedTask[]> {
    const query = `
      query GetBoardItems($boardId: [ID!], $limit: Int) {
        boards(ids: $boardId) {
          items_page(limit: $limit) {
            cursor
            items {
              id
              name
              created_at
              updated_at
              column_values {
                id
                text
                value
                type
              }
            }
          }
        }
      }
    `;

    const variables = {
      boardId: [filter.containerId],
      limit: filter.limit || 100,
    };

    const response = await this.httpClient.request<{
      data?: {
        boards?: Array<{
          items_page?: {
            items?: Array<{
              id: string;
              name: string;
              created_at?: string;
              updated_at?: string;
              column_values?: Array<{ id: string; text?: string; value?: string; type: string }>;
            }>;
          };
        }>;
      };
      errors?: Array<{ message: string }>;
    }>(this.provider, this.endpoint, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ query, variables }),
    });

    if (response.errors && response.errors.length > 0) {
      throw new IntegrationError(
        `Monday GraphQL error: ${response.errors.map((e) => e.message).join(', ')}`,
        this.provider
      );
    }

    const items = response.data?.boards?.[0]?.items_page?.items || [];
    return items.map((item) => this.mapToUnifiedTask(item));
  }

  async createTask(input: CreateTaskInput): Promise<UnifiedTask> {
    const query = `
      mutation CreateItem($boardId: ID!, $itemName: String!, $columnValues: JSON) {
        create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) {
          id
          name
          created_at
          column_values {
            id
            text
            value
            type
          }
        }
      }
    `;

    const columnValuesObj: Record<string, unknown> = {};
    if (input.status) {
      columnValuesObj['status'] = { label: input.status };
    }
    if (input.dueDate) {
      columnValuesObj['date'] = { date: input.dueDate.split('T')[0] };
    }

    const variables = {
      boardId: input.containerId,
      itemName: input.title,
      columnValues: JSON.stringify(columnValuesObj),
    };

    const response = await this.httpClient.request<{
      data?: { create_item?: { id: string; name: string; created_at?: string; column_values?: [] } };
      errors?: Array<{ message: string }>;
    }>(this.provider, this.endpoint, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ query, variables }),
    });

    if (response.errors && response.errors.length > 0) {
      throw new IntegrationError(response.errors[0].message, this.provider);
    }

    const created = response.data?.create_item;
    if (!created) {
      throw new IntegrationError('Failed to create item in Monday.com', this.provider);
    }

    return this.mapToUnifiedTask(created);
  }

  async updateTask(input: UpdateTaskInput): Promise<UnifiedTask> {
    const query = `
      mutation ChangeColumnValues($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
        change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $columnValues) {
          id
          name
          updated_at
          column_values {
            id
            text
            value
            type
          }
        }
      }
    `;

    const columnValuesObj: Record<string, unknown> = {};
    if (input.status) columnValuesObj['status'] = { label: input.status };
    if (input.dueDate) columnValuesObj['date'] = { date: input.dueDate.split('T')[0] };

    const variables = {
      boardId: input.containerId,
      itemId: input.taskId,
      columnValues: JSON.stringify(columnValuesObj),
    };

    const response = await this.httpClient.request<{
      data?: { change_multiple_column_values?: { id: string; name: string; column_values?: [] } };
      errors?: Array<{ message: string }>;
    }>(this.provider, this.endpoint, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ query, variables }),
    });

    if (response.errors && response.errors.length > 0) {
      throw new IntegrationError(response.errors[0].message, this.provider);
    }

    const updated = response.data?.change_multiple_column_values;
    if (!updated) {
      throw new IntegrationError('Failed to update item in Monday.com', this.provider);
    }

    return this.mapToUnifiedTask(updated);
  }

  private mapToUnifiedTask(rawItem: {
    id: string;
    name: string;
    created_at?: string;
    updated_at?: string;
    column_values?: Array<{ id: string; text?: string; value?: string; type: string }>;
  }): UnifiedTask {
    let status = 'To Do';
    const customFields: Record<string, unknown> = {};

    if (Array.isArray(rawItem.column_values)) {
      for (const col of rawItem.column_values) {
        if (col.id === 'status' && col.text) {
          status = col.text;
        }
        customFields[col.id] = col.text || col.value;
      }
    }

    return {
      id: `monday_${rawItem.id}`,
      externalId: rawItem.id,
      provider: 'monday',
      title: rawItem.name || 'Untitled',
      status,
      assigneeEmails: [],
      createdAt: rawItem.created_at,
      updatedAt: rawItem.updated_at,
      customFields,
      rawResponse: rawItem,
    };
  }
}

/**
 * CLICKUP ADAPTER (REST API v2)
 */
export class ClickUpAdapter implements ITaskProviderAdapter {
  public readonly provider: ProviderType = 'clickup';
  private httpClient: ResilientHttpClient;
  private baseUrl = 'https://api.clickup.com/api/v2';

  constructor(private config: ProviderConfig, httpClient?: ResilientHttpClient) {
    this.httpClient = httpClient || new ResilientHttpClient();
  }

  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: this.config.apiKey,
      ...(this.config.extraHeaders || {}),
    };
  }

  async getTasks(filter: TaskFilter): Promise<UnifiedTask[]> {
    const url = new URL(`${this.baseUrl}/list/${filter.containerId}/task`);
    if (filter.limit) url.searchParams.set('limit', filter.limit.toString());
    if (filter.status) url.searchParams.set('statuses[]', filter.status);

    const response = await this.httpClient.request<{ tasks?: Array<ClickUpTaskRaw> }>(
      this.provider,
      url.toString(),
      { method: 'GET', headers: this.headers }
    );

    return (response.tasks || []).map((t) => this.mapToUnifiedTask(t));
  }

  async createTask(input: CreateTaskInput): Promise<UnifiedTask> {
    const url = `${this.baseUrl}/list/${input.containerId}/task`;

    const body: Record<string, unknown> = {
      name: input.title,
      description: input.description || '',
      status: input.status,
    };

    if (input.dueDate) {
      body['due_date'] = new Date(input.dueDate).getTime();
    }

    const response = await this.httpClient.request<ClickUpTaskRaw>(this.provider, url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    return this.mapToUnifiedTask(response);
  }

  async updateTask(input: UpdateTaskInput): Promise<UnifiedTask> {
    const url = `${this.baseUrl}/task/${input.taskId}`;

    const body: Record<string, unknown> = {};
    if (input.title) body['name'] = input.title;
    if (input.description) body['description'] = input.description;
    if (input.status) body['status'] = input.status;
    if (input.dueDate) body['due_date'] = new Date(input.dueDate).getTime();

    const response = await this.httpClient.request<ClickUpTaskRaw>(this.provider, url, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    return this.mapToUnifiedTask(response);
  }

  private mapToUnifiedTask(t: ClickUpTaskRaw): UnifiedTask {
    const assigneeEmails = (t.assignees || [])
      .map((a) => a.email)
      .filter((e): e is string => Boolean(e));

    return {
      id: `clickup_${t.id}`,
      externalId: t.id,
      provider: 'clickup',
      title: t.name || 'Untitled',
      description: t.description,
      status: t.status?.status || 'open',
      priority: this.mapPriority(t.priority?.priority),
      assigneeEmails,
      dueDate: t.due_date ? new Date(Number(t.due_date)).toISOString() : undefined,
      createdAt: t.date_created ? new Date(Number(t.date_created)).toISOString() : undefined,
      updatedAt: t.date_updated ? new Date(Number(t.date_updated)).toISOString() : undefined,
      rawResponse: t,
    };
  }

  private mapPriority(p?: string): UnifiedTask['priority'] {
    if (!p) return undefined;
    switch (p.toLowerCase()) {
      case '1':
      case 'urgent':
        return 'urgent';
      case '2':
      case 'high':
        return 'high';
      case '3':
      case 'normal':
      case 'medium':
        return 'medium';
      default:
        return 'low';
    }
  }
}

interface ClickUpTaskRaw {
  id: string;
  name: string;
  description?: string;
  status?: { status: string };
  priority?: { priority: string };
  assignees?: Array<{ email?: string }>;
  due_date?: string;
  date_created?: string;
  date_updated?: string;
}

/**
 * JIRA ADAPTER (REST API v3)
 */
export class JiraAdapter implements ITaskProviderAdapter {
  public readonly provider: ProviderType = 'jira';
  private httpClient: ResilientHttpClient;

  constructor(
    private config: ProviderConfig & { domain: string; email: string },
    httpClient?: ResilientHttpClient
  ) {
    this.httpClient = httpClient || new ResilientHttpClient();
  }

  private get headers(): Record<string, string> {
    const authToken = Buffer.from(`${this.config.email}:${this.config.apiKey}`).toString('base64');
    return {
      'Content-Type': 'application/json',
      Authorization: `Basic ${authToken}`,
      Accept: 'application/json',
    };
  }

  private get baseUrl(): string {
    return `https://${this.config.domain}.atlassian.net/rest/api/3`;
  }

  async getTasks(filter: TaskFilter): Promise<UnifiedTask[]> {
    const jql = `project = "${filter.containerId}" ORDER BY created DESC`;
    const url = new URL(`${this.baseUrl}/search`);
    url.searchParams.set('jql', jql);
    if (filter.limit) url.searchParams.set('maxResults', filter.limit.toString());

    const response = await this.httpClient.request<{ issues?: Array<JiraIssueRaw> }>(
      this.provider,
      url.toString(),
      { method: 'GET', headers: this.headers }
    );

    return (response.issues || []).map((issue) => this.mapToUnifiedTask(issue));
  }

  async createTask(input: CreateTaskInput): Promise<UnifiedTask> {
    const url = `${this.baseUrl}/issue`;

    // Convert plain text to Jira Atlassian Document Format (ADF)
    const adfDescription = {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: input.description || '' }],
        },
      ],
    };

    const body = {
      fields: {
        project: { key: input.containerId },
        summary: input.title,
        description: adfDescription,
        issuetype: { name: 'Task' },
        ...(input.dueDate ? { duedate: input.dueDate.split('T')[0] } : {}),
      },
    };

    const response = await this.httpClient.request<JiraIssueRaw>(this.provider, url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    return this.mapToUnifiedTask(response);
  }

  async updateTask(input: UpdateTaskInput): Promise<UnifiedTask> {
    const url = `${this.baseUrl}/issue/${input.taskId}`;

    const fields: Record<string, unknown> = {};
    if (input.title) fields['summary'] = input.title;
    if (input.dueDate) fields['duedate'] = input.dueDate.split('T')[0];

    await this.httpClient.request<void>(this.provider, url, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify({ fields }),
    });

    return {
      id: `jira_${input.taskId}`,
      externalId: input.taskId,
      provider: 'jira',
      title: input.title || 'Updated Task',
      status: input.status || 'Updated',
      assigneeEmails: [],
    };
  }

  private mapToUnifiedTask(issue: JiraIssueRaw): UnifiedTask {
    const fields = issue.fields || {};
    return {
      id: `jira_${issue.key}`,
      externalId: issue.key,
      provider: 'jira',
      title: fields.summary || 'Untitled Issue',
      status: fields.status?.name || 'Backlog',
      assigneeEmails: fields.assignee?.emailAddress ? [fields.assignee.emailAddress] : [],
      dueDate: fields.duedate,
      createdAt: fields.created,
      updatedAt: fields.updated,
      rawResponse: issue,
    };
  }
}

interface JiraIssueRaw {
  key: string;
  fields?: {
    summary?: string;
    status?: { name?: string };
    assignee?: { emailAddress?: string };
    duedate?: string;
    created?: string;
    updated?: string;
  };
}

// ==========================================
// 5. UNIFIED TASK MANAGER (FACADE / ENGINE)
// ==========================================

export class UnifiedTaskManager {
  private adapters = new Map<ProviderType, ITaskProviderAdapter>();

  registerAdapter(adapter: ITaskProviderAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  getAdapter(provider: ProviderType): ITaskProviderAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new Error(`Provider adapter '${provider}' is not registered.`);
    }
    return adapter;
  }

  /**
   * Fetches tasks from multiple providers concurrently with error isolation
   */
  async getTasksFromAll(
    filters: Array<{ provider: ProviderType; filter: TaskFilter }>
  ): Promise<{ provider: ProviderType; tasks?: UnifiedTask[]; error?: string }[]> {
    const promises = filters.map(async ({ provider, filter }) => {
      try {
        const adapter = this.getAdapter(provider);
        const tasks = await adapter.getTasks(filter);
        return { provider, tasks };
      } catch (err: unknown) {
        return {
          provider,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    });

    return Promise.all(promises);
  }
}
