import { describe, expect, it } from "vitest";
import { ApiError } from "../api/apiClient";
import { errorMessage } from "./error";

describe("errorMessage", () => {
  it("uses flat access error messages from the server", () => {
    const error = new ApiError(
      '{"error_code":"ACCESS_INVALID","message":"非法请求，请重新激活访问凭证"}',
      401,
      '{"error_code":"ACCESS_INVALID","message":"非法请求，请重新激活访问凭证"}'
    );

    expect(errorMessage(error)).toBe("非法请求，请重新激活访问凭证");
  });

  it("uses nested FastAPI detail messages for quota errors", () => {
    const error = new ApiError(
      '{"detail":{"error_code":"AI_DAILY_LIMIT_EXCEEDED","message":"今日该 AI 功能次数已用完，请明日再试"}}',
      429,
      '{"detail":{"error_code":"AI_DAILY_LIMIT_EXCEEDED","message":"今日该 AI 功能次数已用完，请明日再试"}}'
    );

    expect(errorMessage(error)).toBe("今日该 AI 功能次数已用完，请明日再试");
  });

  it("turns FastAPI validation responses into readable Chinese messages", () => {
    const error = new ApiError(
      '{"detail":[{"loc":["query","limit"],"msg":"Input should be less than or equal to 40","input":"80"}]}',
      422,
      '{"detail":[{"loc":["query","limit"],"msg":"Input should be less than or equal to 40","input":"80"}]}'
    );

    expect(errorMessage(error)).toBe("接口参数校验失败：limit Input should be less than or equal to 40（当前值：80）");
  });
});
