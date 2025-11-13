export type StrangeLoopQuestionKind = "entropy" | "drift" | "cooling" | "crowded";

export interface StrangeLoopQuestion {
  id: string;
  kind: StrangeLoopQuestionKind;
  message: string;
  taskId?: string;
  createdAt: number;
}
