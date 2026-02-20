"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CopilotKit } from "@copilotkit/react-core";
import {
  useCoAgent,
  useFrontendTool,
  useHumanInTheLoop,
  useRenderToolCall,
} from "@copilotkit/react-core";
import { CopilotKitCSSProperties, CopilotSidebar } from "@copilotkit/react-ui";
import { ProverbsCard } from "@/components/proverbs";
import { WeatherCard } from "@/components/weather";
import { MoonCard } from "@/components/moon";
import { AgentState } from "@/lib/types";

// ─── Thread Types ────────────────────────────────────────────────────────────

type Thread = {
  id: string;
  title: string;
};

// ─── Root Page ───────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <Suspense>
      <HomeInner />
    </Suspense>
  );
}

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const threadParam = searchParams.get("thread");

  const [threads, setThreads] = useState<Thread[]>(() => {
    const id = threadParam ?? crypto.randomUUID();
    return [{ id, title: "Thread 1" }];
  });

  const [activeThreadId, setActiveThreadId] = useState(
    () => threadParam ?? threads[0].id,
  );

  // Load threads from the database on mount
  useEffect(() => {
    fetch("/api/threads")
      .then((r) => r.json())
      .then((ids: string[]) => {
        if (ids.length === 0) return;
        const loaded = ids.map((id, i) => ({ id, title: `Thread ${i + 1}` }));

        // If the URL points to a thread not in the DB, add it
        if (threadParam && !ids.includes(threadParam)) {
          loaded.push({
            id: threadParam,
            title: `Thread ${loaded.length + 1}`,
          });
        }

        setThreads(loaded);
        if (threadParam && ids.includes(threadParam)) {
          setActiveThreadId(threadParam);
        } else {
          setActiveThreadId(loaded[0].id);
        }
      })
      .catch(() => {
        // Agent not reachable yet — keep the default thread
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync activeThreadId → URL
  useEffect(() => {
    const current = searchParams.get("thread");
    if (current !== activeThreadId) {
      router.replace(`?thread=${activeThreadId}`, { scroll: false });
    }
  }, [activeThreadId, router, searchParams]);

  const createThread = useCallback(() => {
    const thread: Thread = {
      id: crypto.randomUUID(),
      title: `Thread ${threads.length + 1}`,
    };
    setThreads((prev) => [...prev, thread]);
    setActiveThreadId(thread.id);
  }, [threads.length]);

  const deleteThread = useCallback(
    (id: string) => {
      setThreads((prev) => {
        if (prev.length <= 1) return prev;
        const next = prev.filter((t) => t.id !== id);
        if (activeThreadId === id) setActiveThreadId(next[0].id);
        return next;
      });
    },
    [activeThreadId],
  );

  return (
    <div className="flex h-screen">
      {/* ── Thread sidebar ─────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 bg-zinc-900 text-white flex flex-col border-r border-zinc-800">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Threads
          </h2>
          <button
            onClick={createThread}
            className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
          >
            + New Thread
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {threads.map((thread) => (
            <div
              key={thread.id}
              onClick={() => setActiveThreadId(thread.id)}
              className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                activeThreadId === thread.id
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              <div className="min-w-0">
                <span className="text-sm truncate block">{thread.title}</span>
                <span className="text-[10px] text-zinc-500 truncate block font-mono">
                  {thread.id.slice(0, 8)}
                </span>
              </div>
              {threads.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteThread(thread.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all ml-2 shrink-0 cursor-pointer"
                >
                  &times;
                </button>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* ── CopilotKit with active thread ──────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <CopilotKit
          runtimeUrl="/api/copilotkit"
          agent="sample_agent"
          threadId={activeThreadId}
        >
          <ChatWithAgent />
        </CopilotKit>
      </div>
    </div>
  );
}

// ─── Chat + Agent Hooks ──────────────────────────────────────────────────────
// All CopilotKit hooks must live inside <CopilotKit>.

function ChatWithAgent() {
  const [themeColor, setThemeColor] = useState("#6366f1");

  useFrontendTool({
    name: "setThemeColor",
    parameters: [
      {
        name: "themeColor",
        description: "The theme color to set. Make sure to pick nice colors.",
        required: true,
      },
    ],
    handler({ themeColor }) {
      setThemeColor(themeColor);
    },
  });

  return (
    <main
      style={
        { "--copilot-kit-primary-color": themeColor } as CopilotKitCSSProperties
      }
    >
      <CopilotSidebar
        disableSystemMessage={true}
        clickOutsideToClose={false}
        defaultOpen
        labels={{
          title: "Popup Assistant",
          initial:
            "Hi! Each thread has its own conversation and shared state. Try switching threads!",
        }}
        suggestions={[
          {
            title: "Generative UI",
            message: "Get the weather in San Francisco.",
          },
          {
            title: "Frontend Tools",
            message: "Set the theme to green.",
          },
          {
            title: "Human In the Loop",
            message: "Please go to the moon.",
          },
          {
            title: "Write Agent State",
            message: "Add a proverb about AI.",
          },
          {
            title: "Update Agent State",
            message:
              "Please remove 1 random proverb from the list if there are any.",
          },
          {
            title: "Read Agent State",
            message: "What are the proverbs?",
          },
        ]}
      >
        <MainContent themeColor={themeColor} />
      </CopilotSidebar>
    </main>
  );
}

// ─── Main Content (shared state + generative UI + HITL) ──────────────────────

function MainContent({ themeColor }: { themeColor: string }) {
  const { state, setState } = useCoAgent<AgentState>({
    name: "sample_agent",
    initialState: {
      proverbs: [
        "CopilotKit may be new, but its the best thing since sliced bread.",
      ],
    },
  });

  useFrontendTool({
    name: "updateProverbs",
    parameters: [
      {
        name: "proverbs",
        description: "What the current list of proverbs should be updated to",
        type: "string[]",
        required: true,
      },
    ],
    handler: ({ proverbs }) => {
      setState({ ...state, proverbs });
    },
  });

  useRenderToolCall(
    {
      name: "get_weather",
      description: "Get the weather for a given location.",
      parameters: [{ name: "location", type: "string", required: true }],
      render: ({ args }) => (
        <WeatherCard location={args.location} themeColor={themeColor} />
      ),
    },
    [themeColor],
  );

  useHumanInTheLoop(
    {
      name: "go_to_moon",
      description: "Go to the moon on request.",
      render: ({ respond, status }) => (
        <MoonCard themeColor={themeColor} status={status} respond={respond} />
      ),
    },
    [themeColor],
  );

  return (
    <div
      style={{ backgroundColor: themeColor }}
      className="h-screen flex justify-center items-center flex-col transition-colors duration-300"
    >
      <ProverbsCard state={state} setState={setState} />
    </div>
  );
}
