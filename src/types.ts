export type ColumnID = "TO-DO" | "IN PROGRESS" | "DONE";
export type TaskID = string;

export interface Task {
  id: TaskID;
  title: string;
  status: ColumnID;
  description?: string;
  dependsOn?: TaskID[];
  blocked?: boolean;
  tags?: string[];
}
