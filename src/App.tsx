import { useState } from "react";
import { motion } from "motion/react";
import { TaskCard } from "./components/TaskCard";
import { TaskModal } from "./components/TaskModal";
import { ProgressIndicator } from "./components/ProgressIndicator";
import { Plus } from "lucide-react";

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

  const todoTasks = tasks.filter((t) => t.status === "todo");
  const inProgressTasks = tasks.filter((t) => t.status === "inprogress");
  const doneTasks = tasks.filter((t) => t.status === "done");

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0E1625" }}>
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="border-b px-8 py-8"
        style={{ borderColor: "rgba(148,163,184,0.18)" }}
      >
        <h1 className="text-title text-3xl font-extrabold">FLOWSTATE</h1>
        <p className="mt-2 text-sub">Your tasks, in motion.</p>
      </motion.header>

      {/* Main Kanban Board */}
      <main className="px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {/* TO-DO */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="mb-6">
              <h3 className="mb-2 text-xl font-semibold text-title">TO-DO</h3>
              <ProgressIndicator
                total={tasks.length}
                completed={todoTasks.length}
                colorFrom="#67E8F9"
                colorTo="#93C5FD"
              />
            </div>

            <div className="space-y-4">
              {todoTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  title={task.title}
                  status={task.status}
                  onClick={() => handleTaskClick(task)}
                />
              ))}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-4 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 transition-all duration-300"
                style={{ borderColor: "rgba(148,163,184,0.18)", color: "#A7B2C3" }}
              >
                <Plus className="w-5 h-5" />
                <span>Add Task</span>
              </motion.button>
            </div>
          </motion.div>

          {/* IN PROGRESS */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="mb-6">
              <h3 className="mb-2 text-xl font-semibold text-title">
                IN PROGRESS
              </h3>
              <ProgressIndicator
                total={tasks.length}
                completed={inProgressTasks.length}
                colorFrom="#67E8F9"
                colorTo="#93C5FD"
              />
            </div>

            <div className="space-y-4">
              {inProgressTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  title={task.title}
                  status={task.status}
                  onClick={() => handleTaskClick(task)}
                />
              ))}
            </div>
          </motion.div>

          {/* DONE */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <div className="mb-6">
              <h3 className="mb-2 text-xl font-semibold text-title">DONE</h3>
              <ProgressIndicator
                total={tasks.length}
                completed={doneTasks.length}
                colorFrom="#67E8F9"
                colorTo="#93C5FD"
              />
            </div>

            <div className="space-y-4">
              {doneTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  title={task.title}
                  status={task.status}
                  onClick={() => handleTaskClick(task)}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </main>

      {/* Task Modal */}
      {selectedTask && (
        <TaskModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={selectedTask.title}
          notes={selectedTask.notes}
          onComplete={handleComplete}
        />
      )}
    </div>
  );
}


