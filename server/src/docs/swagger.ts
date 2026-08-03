import swaggerJSDoc from "swagger-jsdoc";

const definition = {
  openapi: "3.0.3",
  info: {
    title: "AscendX Leave Requests API",
    version: "1.0.0",
    description:
      "Employees submit leave requests, managers approve/reject them, and an AI assistant " +
      "drafts the approval message. See the project README for setup and AI-mode details.",
  },
  servers: [{ url: "/", description: "Current host" }],
  components: {
    securitySchemes: {
      employeeId: {
        type: "apiKey" as const,
        in: "header" as const,
        name: "x-employee-id",
        description:
          "Stand-in for real session/JWT auth. Set to a seeded employee id to act as that user.",
      },
    },
    schemas: {
      Employee: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          managerId: { type: "string", format: "uuid", nullable: true },
          teamId: { type: "string" },
        },
      },
      LeaveStatus: {
        type: "string",
        enum: ["pending", "approved", "rejected"],
      },
      LeaveRequest: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          employeeId: { type: "string", format: "uuid" },
          startDate: { type: "string", format: "date-time" },
          endDate: { type: "string", format: "date-time" },
          reason: { type: "string" },
          managerNote: { type: "string", nullable: true },
          status: { $ref: "#/components/schemas/LeaveStatus" },
          aiMessage: { type: "string", nullable: true },
          decidedById: { type: "string", format: "uuid", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          decidedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      StaffingWarning: {
        type: "object",
        description: "Non-blocking warning returned when approving would drop team availability below the configured threshold.",
        properties: {
          message: { type: "string" },
          availableRatio: { type: "number" },
        },
      },
      Error: {
        type: "object",
        description: "Standard failure envelope returned by every endpoint.",
        properties: {
          status: { type: "string", enum: ["error"] },
          message: { type: "string", description: "Human-readable explanation." },
          data: { type: "object", nullable: true, example: null },
          code: {
            type: "string",
            description: "Stable machine-readable identifier.",
            enum: ["invalid_input", "unauthenticated", "forbidden", "not_found", "internal_error"],
          },
          field: { type: "string", description: "Present when one input field is at fault." },
        },
        required: ["status", "message", "data", "code"],
      },
      SuccessEnvelope: {
        type: "object",
        description: "Standard success envelope. `data` carries the resource itself.",
        properties: {
          status: { type: "string", enum: ["success"] },
          message: { type: "string" },
          data: { description: "Resource, or array of resources." },
        },
        required: ["status", "message", "data"],
      },
      DecisionResult: {
        type: "object",
        properties: {
          leaveRequest: { $ref: "#/components/schemas/LeaveRequest" },
          staffingWarning: { nullable: true, $ref: "#/components/schemas/StaffingWarning" },
          decided: {
            type: "boolean",
            description: "False when a staffing warning held the decision back pending confirmation.",
          },
        },
      },
    },
  },
  security: [{ employeeId: [] }],
} satisfies swaggerJSDoc.OAS3Definition;

export const openapiSpec = swaggerJSDoc({
  definition,
  // tsc keeps the src/ prefix under outDir (rootDir is the package root, so the
  // seed script keeps its own folder), hence dist/src/routes rather than
  // dist/routes. Both globs are listed so the spec is populated in dev and in a
  // compiled production image.
  apis: ["./src/routes/*.ts", "./dist/src/routes/*.js"],
});
