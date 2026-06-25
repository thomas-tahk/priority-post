"use client";

import { useOptimistic, useRef, useTransition, type RefObject } from "react";
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
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

// A press lands on a "control" — its own action runs, never a drag.
// Walks up from the event target so clicks on glyphs inside a button still count.
function isInteractiveElement(target: EventTarget | null): boolean {
  const tags = ["button", "input", "textarea", "select", "option", "a"];
  let node = target instanceof HTMLElement ? target : null;
  while (node) {
    if (tags.includes(node.tagName.toLowerCase())) return true;
    node = node.parentElement;
  }
  return false;
}

// Whole-card drag: the row is the drag surface, but a press that starts on a
// control (title input, checkbox, ✕, tag pills) does its own thing instead.
class SmartMouseSensor extends MouseSensor {
  static activators = [
    {
      eventName: "onMouseDown" as const,
      handler: ({ nativeEvent: e }: { nativeEvent: MouseEvent }) =>
        e.button !== 2 && !isInteractiveElement(e.target),
    },
  ];
}

class SmartTouchSensor extends TouchSensor {
  static activators = [
    {
      eventName: "onTouchStart" as const,
      handler: ({ nativeEvent: e }: { nativeEvent: TouchEvent }) =>
        e.touches.length <= 1 && !isInteractiveElement(e.target),
    },
  ];
}

function SortableRow({
  task,
  isTop,
  onOpen,
  didDragRef,
}: {
  task: ScoredTask;
  isTop: boolean;
  onOpen: (t: Task) => void;
  didDragRef: RefObject<boolean>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="sortable-row"
      data-detail-opener
      {...attributes}
      {...listeners}
      onPointerDownCapture={() => {
        didDragRef.current = false;
      }}
      onClick={(e) => {
        // Controls handle their own clicks; a just-finished drag must not open.
        if (isInteractiveElement(e.target)) return;
        if (didDragRef.current) return;
        onOpen(task);
      }}
    >
      <span className="drag-handle" aria-hidden="true">
        ⠿
      </span>
      <div className="sortable-row-body">
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
  // Set when a drag begins; checked on click so reordering never opens the panel.
  const didDragRef = useRef(false);

  const sensors = useSensors(
    useSensor(SmartMouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(SmartTouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
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
      await moveTask(next[newIndex]!.id, prevId, nextId);
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={() => {
        didDragRef.current = true;
      }}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={optimistic.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {optimistic.map((t, i) => (
          <SortableRow key={t.id} task={t} isTop={i === 0} onOpen={onOpen} didDragRef={didDragRef} />
        ))}
      </SortableContext>
    </DndContext>
  );
}
