"use client";

import { useOptimistic, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "@/db/schema";
import type { ScoredTask } from "@/features/constellation/layout";
import { TaskRow } from "./TaskRow";
import { moveTask } from "./actions";

function SortableRow({
  task,
  isTop,
  onOpen,
}: {
  task: ScoredTask;
  isTop: boolean;
  onOpen: (t: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="sortable-row">
      <button
        type="button"
        className="drag-handle"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <div
        className="sortable-row-body"
        data-detail-opener
        onClick={(e) => {
          const tag = (e.target as HTMLElement).tagName;
          if (["INPUT", "BUTTON", "TEXTAREA", "SELECT"].includes(tag)) return;
          onOpen(task);
        }}
      >
        <TaskRow task={task} isTop={isTop} />
      </div>
    </div>
  );
}

export function SortableTaskList({
  tasks,
  onOpen,
}: {
  tasks: ScoredTask[];
  onOpen: (t: Task) => void;
}) {
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(
    tasks,
    (_current, next: ScoredTask[]) => next
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIndex = optimistic.findIndex((t) => t.id === active.id);
    const newIndex = optimistic.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(optimistic, oldIndex, newIndex);
    const prevId = newIndex > 0 ? next[newIndex - 1]!.id : null;
    const nextId = newIndex < next.length - 1 ? next[newIndex + 1]!.id : null;

    startTransition(async () => {
      setOptimistic(next);
      await moveTask(Number(active.id), prevId, nextId);
    });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={optimistic.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {optimistic.map((t, i) => (
          <SortableRow key={t.id} task={t} isTop={i === 0} onOpen={onOpen} />
        ))}
      </SortableContext>
    </DndContext>
  );
}
