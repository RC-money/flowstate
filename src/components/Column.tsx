import React from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import Droppable from "./Droppable";
import Card from "./Card";

export default function Column({
  id,
  title,
  cards,
}: {
  id: string;
  title: string;
  cards: { id: string; title: string }[];
}) {
  return (
    <Droppable id={id}>
      <h2 className="text-ether-300 font-bold mb-3 text-center">{title}</h2>
      <div className="bg-space-600/60 rounded-2xl p-4 min-h-[300px]">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((c) => (
            <Card key={c.id} id={c.id} title={c.title} />
          ))}
        </SortableContext>
      </div>
    </Droppable>
  );
}
