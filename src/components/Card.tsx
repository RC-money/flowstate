// src/components/Card.tsx
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export default function Card({ id, title }: { id: string; title: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      className="p-4 mb-3 rounded-xl bg-space-500 shadow-glow hover:animate-pulseSoft cursor-grab active:cursor-grabbing select-none"
    >
      <h3 className="font-medium text-ether-200">{title}</h3>
    </div>
  );
}
