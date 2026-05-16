export type Loadable<T> =
  | { status: "loading" }
  | { message: string; status: "error" }
  | { data: T; status: "success" };
