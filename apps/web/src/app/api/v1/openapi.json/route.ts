// A machine-readable description of the API. Zapier, Make, Power Automate and Postman can import it.
const str = { type: "string" } as const;
const date = { type: "string", format: "date", example: "2026-03-15" } as const;
const err = { description: "Error", content: { "application/json": { schema: { type: "object", properties: { error: { type: "object", properties: { code: str, message: str } } } } } } };
const idParam = (name = "id") => ({ name, in: "path", required: true, schema: str });
const list = (ref: string) => ({ type: "object", properties: { data: { type: "array", items: { $ref: `#/components/schemas/${ref}` } } } });
const one = (ref: string) => ({ type: "object", properties: { data: { $ref: `#/components/schemas/${ref}` } } });
const ok = (schema: object) => ({ "200": { description: "OK", content: { "application/json": { schema } } }, "401": err, "404": err });
const paging = [{ name: "limit", in: "query", schema: { type: "integer", default: 100, maximum: 500 } }, { name: "offset", in: "query", schema: { type: "integer", default: 0 } }];
const status = { type: "string", enum: ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] };
const priority = { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] };

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const spec = {
    openapi: "3.0.3",
    info: { title: "Orbit API", version: "1.0.0", description: "Read and update the data of one organization. Create a key under Integrations. Limit: 120 requests per minute per key." },
    servers: [{ url: `${origin}/api/v1` }],
    security: [{ bearer: [] }],
    components: {
      securitySchemes: { bearer: { type: "http", scheme: "bearer", description: "Your key, starting with orbit_" } },
      schemas: {
        Project: { type: "object", properties: { id: str, name: str, code: str, description: str, phase: str, status: str, health: str, currency: str, startDate: date, endDate: date } },
        Task: {
          type: "object",
          properties: {
            id: str, projectId: str, parentId: str, title: str, description: str, status, priority,
            assignee: { type: "object", properties: { id: str, name: str, email: str } }, startDate: date, dueDate: date, estimateHours: { type: "number" },
            labels: { type: "array", items: str }, dependsOn: { type: "array", items: { type: "object", properties: { dependsOnId: str, type: str, lagDays: { type: "integer" } } } },
          },
        },
        Indicator: { type: "object", properties: { id: str, name: str, unit: str, baseline: { type: "number" }, target: { type: "number" }, latestValue: { type: "number" }, latestPeriod: str, progressPercent: { type: "integer" } } },
        Risk: { type: "object", properties: { id: str, title: str, probability: { type: "integer" }, impact: { type: "integer" }, score: { type: "integer" }, status: str, response: str } },
      },
    },
    paths: {
      "/projects": { get: { summary: "List projects", operationId: "listProjects", parameters: paging, responses: ok(list("Project")) } },
      "/projects/{id}": { get: { summary: "Get a project", operationId: "getProject", parameters: [idParam()], responses: ok(one("Project")) } },
      "/projects/{id}/tasks": {
        get: { summary: "List tasks", operationId: "listTasks", parameters: [idParam(), ...paging, { name: "status", in: "query", schema: status }, { name: "assigneeEmail", in: "query", schema: str }], responses: ok(list("Task")) },
        post: {
          summary: "Create a task (needs a write key)", operationId: "createTask", parameters: [idParam()],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["title"], properties: { title: str, description: str, status, priority, startDate: date, dueDate: date, estimateHours: { type: "number" }, assigneeEmail: str, parentId: str } } } } },
          responses: { "201": { description: "Created", content: { "application/json": { schema: one("Task") } } }, "400": err, "401": err, "403": err },
        },
      },
      "/tasks/{id}": {
        get: { summary: "Get a task", operationId: "getTask", parameters: [idParam()], responses: ok(one("Task")) },
        patch: {
          summary: "Change a task (needs a write key)", operationId: "updateTask", parameters: [idParam()],
          requestBody: { content: { "application/json": { schema: { type: "object", properties: { title: str, description: str, status, priority, startDate: date, dueDate: date, estimateHours: { type: "number" }, assigneeEmail: str } } } } },
          responses: ok(one("Task")),
        },
      },
      "/projects/{id}/indicators": { get: { summary: "List indicators with progress", operationId: "listIndicators", parameters: [idParam()], responses: ok(list("Indicator")) } },
      "/indicators/{id}/values": {
        get: { summary: "List recorded results", operationId: "listIndicatorValues", parameters: [idParam()], responses: ok({ type: "object" }) },
        post: {
          summary: "Record a result (needs a write key)", operationId: "addIndicatorValue", parameters: [idParam()],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["period", "periodStart", "value"], properties: { period: { type: "string", example: "2026-Q1" }, periodStart: date, value: { type: "number" }, disaggregation: { type: "object", additionalProperties: { type: "number" } }, note: str } } } } },
          responses: { "201": { description: "Created" }, "400": err, "401": err, "403": err },
        },
      },
      "/projects/{id}/budget": { get: { summary: "Budget summary", operationId: "getBudget", parameters: [idParam()], responses: ok({ type: "object" }) } },
      "/projects/{id}/risks": { get: { summary: "Risk register", operationId: "listRisks", parameters: [idParam()], responses: ok(list("Risk")) } },
    },
  };
  return Response.json(spec, { headers: { "Cache-Control": "public, max-age=300" } });
}
