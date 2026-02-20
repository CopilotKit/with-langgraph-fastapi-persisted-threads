import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";
import { NextRequest } from "next/server";
import { loadThreadState } from "@/lib/checkpoint-db";

// 1. You can use any service adapter here for multi-agent support. We use
//    the empty adapter since we're only using one agent.
const serviceAdapter = new ExperimentalEmptyAdapter();

// 2. Create the CopilotRuntime instance and utilize the LangGraph AG-UI
//    integration to setup the connection.
const runtime = new CopilotRuntime({
  agents: {
    sample_agent: new LangGraphHttpAgent({
      url: process.env.AGENT_URL || "http://localhost:8123",
      // loadState: async (threadId) => {
      //   // Query the LangGraph checkpoint tables in Postgres directly,
      //   // avoiding an extra hop through the agent API.
      //   const state = await loadThreadState(threadId);
      //   console.log({threadId, state})
      //   if (!state) return null;
      //   return { state };
      // },
      // loadState: async (threadId) => {
      //   const state = await loadThreadState(threadId);
      //   if (!state) return null;
    
      //   // Convert LangGraph messages to AG-UI format
      //   const messages = (state.messages ?? []).map((msg: any) => ({
      //     id: msg.id,
      //     role: msg.type === "human" ? "user" : msg.type === "ai" ? "assistant" : msg.type,
      //     content: typeof msg.content === "string" ? msg.content : undefined,
      //     ...(msg.tool_calls?.length ? {
      //       toolCalls: msg.tool_calls.map((tc: any) => ({
      //         id: tc.id,
      //         name: tc.name,
      //         args: typeof tc.args === "string" ? tc.args : JSON.stringify(tc.args),
      //       })),
      //     } : {}),
      //   }));
    
      //   return {
      //     state,       // Hydrates agent state (proverbs, copilotkit, etc.)
      //     messages,    // Hydrates the chat UI
      //   };
      // },


    }),
  },
});

// 3. Build a Next.js API route that handles the CopilotKit runtime requests.
export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
