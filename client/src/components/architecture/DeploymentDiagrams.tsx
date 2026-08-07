import localWorkflow from "../../assets/workflows/local_workflow.svg";
import productionWorkflow from "../../assets/workflows/production_workflow.svg";
import fileHandlingWorkflow from "../../assets/workflows/file_handling_workflow.svg";

function DiagramFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="overflow-x-auto rounded-control border border-slate-200 bg-ink-950 p-4">
      <img src={src} alt={alt} className="h-auto w-full min-w-[640px]" />
    </div>
  );
}

export function ProductionDiagram() {
  return (
    <figure className="m-0">
      <DiagramFrame
        src={productionWorkflow}
        alt="In production, the React SPA talks to Express over HTTPS. Express reads and writes Postgres on Supabase via Prisma, and on approval branches on AI_MODE: live calls Gemini through Google ADK inside the AI message service (guardrails, 20s timeout, 1 retry), mock resolves in-process instead."
      />
      <figcaption className="mt-3 text-sm text-slate-600">
        One Render container runs Express, which serves the built React client and the REST API from a single
        origin. Approving a request calls Gemini through Google ADK for the message text. If that call is slow,
        errors, or no key is configured, I fall back to an in-process deterministic mock instead of failing the
        approval.
      </figcaption>
    </figure>
  );
}

export function LocalDevDiagram() {
  return (
    <figure className="m-0">
      <DiagramFrame
        src={localWorkflow}
        alt="In local development, three separate docker-compose containers run: Vite serves the client and proxies /leave-requests to Express, which talks to a local Postgres container via Prisma."
      />
      <figcaption className="mt-3 text-sm text-slate-600">
        Three containers instead of one. Vite serves the client directly and proxies API calls to Express, rather
        than Express serving a pre-built bundle. Everything else, Prisma to Postgres, the AI provider switch, works
        the same as production.
      </figcaption>
    </figure>
  );
}

export function FileStorageDiagram() {
  return (
    <figure className="m-0">
      <DiagramFrame
        src={fileHandlingWorkflow}
        alt="Proposed file storage: the browser requests a presigned upload URL from Express, then uploads the file directly to AWS S3, bypassing Express entirely for the file bytes. Express only records a reference, the key, filename, and size, in Postgres."
      />
      <figcaption className="mt-3 text-sm text-slate-600">
        Not built, this is the shape I'd use: the browser uploads straight to S3 on a presigned URL. Express only
        authorizes the upload and records a reference. File bytes never transit the app server.
      </figcaption>
    </figure>
  );
}
