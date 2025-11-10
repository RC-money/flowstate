import { useState } from "react";
import { motion } from "motion/react";
import { Plus } from "lucide-react";

import { TaskCard } from "./components/TaskCard";
import { TaskModal } from "./components/TaskModal";
import { ProgressIndicator } from "./components/ProgressIndicator";
import FlowBackground from "./components/FlowBackground";
import GlowOverlay from "./components/GlowOverlay";
import NoiseOverlay from "./components/NoiseOverlay";

interface Task {
  id: string;
  title: string;
  status: "todo" | "inprogress" | "done";
  notes: string[];
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: "1",
      title: "Design homepage layout",
      status: "todo",
      notes: [
        "Create wireframes for desktop and mobile",
        "Define color scheme and typography",
        "Design hero section with call-to-action",
      ],
    },
    {
      id: "2",
      title: "Build authentication system",
      status: "todo",
      notes: [
        "Set up user registration flow",
        "Implement login with OAuth",
        "Add password reset functionality",
      ],
    },
    {
      id: "3",
      title: "Create dashboard components",
      status: "inprogress",
      notes: [
        "Build reusable card components",
        "Implement data visualization charts",
        "Add responsive grid layout",
      ],
    },
    {
      id: "4",
      title: "Write API documentation",
      status: "inprogress",
      notes: [
        "Document all endpoints",
        "Add code examples",
        "Create authentication guide",
      ],
    },
    {
      id: "5",
      title: "Set up CI/CD pipeline",
      status: "done",
      notes: [
        "Configure GitHub Actions",
        "Set up automated testing",
        "Deploy to production environment",
      ],
    },
    {
      id: "6",
      title: "Conduct user testing",
      status: "done",
      notes: [
        "Recruit 10 beta testers",
        "Gather feedback on UX",
        "Iterate based on findings",
      ],
    },
  ]);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeColumn, setActiveColumn] = useState<"todo" | "inprogress" | "done" | null>(null);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleComplete = () => {
    if (selectedTask) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === selectedTask.id ? { ...t, status: "done" as const } : t
        )
      );
      setIsModalOpen(false);
    }
  };

  const handleMoveToProgress = () => {
    if (selectedTask) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === selectedTask.id ? { ...t, status: "inprogress" as const } : t
        )
      );
      setIsModalOpen(false);
    }
  };

  const todoTasks = tasks.filter((t) => t.status === "todo");
  const inProgressTasks = tasks.filter((t) => t.status === "inprogress");
  const doneTasks = tasks.filter((t) => t.status === "done");

  return (
    <div className="relative min-h-screen overflow-hidden font-sans text-white">
      {/* Dynamic Background Layers */}
      <FlowBackground />
      <GlowOverlay activeColumn={activeColumn} />
      <NoiseOverlay />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="border-b px-8 py-8 relative z-20"
        style={{ borderColor: "rgba(148,163,184,0.18)" }}
      >
        <h1 className="text-3xl font-extrabold tracking-wide">FLOWSTATE</h1>
        <p className="mt-2 text-slate-400">Your tasks, in motion.</p>
      </motion.header>

      {/* Kanban Board */}
      <main className="px-8 py-16 flex justify-center items-start relative z-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-7xl">
          {[
            { title: "TO-DO", tasks: todoTasks, key: "todo" },
            { title: "IN PROGRESS", tasks: inProgressTasks, key: "inprogress" },
            { title: "DONE", tasks: doneTasks, key: "done" },
          ].map((col) => (
            <motion.div
              key={col.key}
              onMouseEnter={() => setActiveColumn(col.key as any)}
              onMouseLeave={() => setActiveColumn(null)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="mb-6">
                <h3 className="mb-2 text-xl font-semibold tracking-wide">{col.title}</h3>
                <ProgressIndicator
                  total={tasks.length}
                  completed={col.tasks.length}
                  colorFrom="#67E8F9"
                  colorTo="#93C5FD"
                />
              </div>

              <div className="space-y-4">
                {col.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    title={task.title}
                    status={task.status}
                    onClick={() => handleTaskClick(task)}
                  />
                ))}

                {col.key === "todo" && (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 rounded-xl border-2 border-dashed border-slate-600 text-slate-400 flex items-center justify-center gap-2 hover:text-white hover:border-slate-400 transition-all duration-300"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Add Task</span>
                  </motion.button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      {/* Modal */}
      {selectedTask && (
        <TaskModal
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  title={selectedTask.title}
  notes={selectedTask.notes}
  onMoveToProgress={() => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === selectedTask.id ? { ...t, status: "inprogress" as const } : t
      )
    );
    setIsModalOpen(false);
  }}
  onMoveToTodo={() => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === selectedTask.id ? { ...t, status: "todo" as const } : t
      )
    );
    setIsModalOpen(false);
  }}
  onComplete={() => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === selectedTask.id ? { ...t, status: "done" as const } : t
      )
    );
    setIsModalOpen(false);
  }}
/>

      )}
    </div>
  );
}
