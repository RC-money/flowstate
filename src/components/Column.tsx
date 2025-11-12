import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import Droppable from "./Droppable";
import TaskCard from "./TaskCard";
import type { Task } from "../App";

interface ColumnProps {
  id: string;
  title: string;
  cards: Task[];
  onCardClick: (task: Task) => void;
}

export default function Column({ id, title, cards }) {
  return (
    <Droppable id={id}>
      <h2 className="text-ether-300 font-bold mb-3">{title}</h2>
      <div className="bg-space-600/60 rounded-2xl p-3 min-h-[280px]">
        <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map(c => <Card key={c.id} id={c.id} title={c.title} />)}
        </SortableContext>
      </div>
    </Droppable>
  );
}
