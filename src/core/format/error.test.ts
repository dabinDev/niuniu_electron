import { describe, expect, it } from "vitest";
import { ApiError } from "../api/apiClient";
import { errorMessage } from "./error";

describe("errorMessage", () => {
  it("turns FastAPI validation responses into readable Chinese messages", () => {
    const error = new ApiError(
      '{"detail":[{"loc":["query","limit"],"msg":"Input should be less than or equal to 40","input":"80"}]}',
      422,
      '{"detail":[{"loc":["query","limit"],"msg":"Input should be less than or equal to 40","input":"80"}]}'
    );

    expect(errorMessage(error)).toBe("接口参数校验失败：limit Input should be less than or equal to 40（当前值：80）");
  });
});
