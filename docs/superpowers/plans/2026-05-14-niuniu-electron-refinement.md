# NiuNiu Electron Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前 Electron 客户端第一批页面细节升级到更接近 macOS 毛玻璃复盘工作室的质感，并迁回 Flutter 端更成熟的工作台行为。

**Architecture:** 保留现有路由、侧边栏、接口和页面大纲，只新增少量共享展示组件与局部状态。公共组件负责摘要条、标签化数据工作区和视觉语言，页面只做数据映射与交互接入。

**Tech Stack:** React 19, Vite, TypeScript, TanStack Query, Vitest, Testing Library, Electron Builder.

---

### Task 1: Shared Workspace Polish Components

**Files:**
- Create: `src/shared/components/WorkspaceSummaryBar.tsx`
- Test: `src/shared/components/WorkspaceSummaryBar.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing tests for summary metrics, tones, and actions.**

Run: `npm test -- src/shared/components/WorkspaceSummaryBar.test.tsx`
Expected: fail because the component does not exist.

- [ ] **Step 2: Implement `WorkspaceSummaryBar`.**

Render a glass summary strip with label/value pairs, optional tone classes, optional detail text, and action slot.

- [ ] **Step 3: Run targeted tests.**

Run: `npm test -- src/shared/components/WorkspaceSummaryBar.test.tsx`
Expected: pass.

### Task 2: Market Center Tab Workspace

**Files:**
- Create: `src/shared/components/TableWorkspaceTabs.tsx`
- Test: `src/shared/components/TableWorkspaceTabs.test.tsx`
- Modify: `src/features/marketCenter/MarketCenterPage.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing tests for active table rendering and table switching.**

Run: `npm test -- src/shared/components/TableWorkspaceTabs.test.tsx`
Expected: fail because the component does not exist.

- [ ] **Step 2: Implement `TableWorkspaceTabs`.**

Use `SegmentedTabs` and `TableSectionCard` to show only one data table at a time, with count badges and a compact workspace summary.

- [ ] **Step 3: Wire Market Center to the tab workspace.**

Keep empty state and export sheets intact. Replace vertical table stack with the tab workspace.

- [ ] **Step 4: Run targeted tests.**

Run: `npm test -- src/shared/components/TableWorkspaceTabs.test.tsx`
Expected: pass.

### Task 3: High-Value Page Detail Pass

**Files:**
- Modify: `src/features/plateRotation/PlateRotationPage.tsx`
- Modify: `src/features/askAi/AskAiPage.tsx`
- Modify: `src/features/limitReview/LimitReviewPage.tsx`
- Modify: `src/features/auction/AuctionPage.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add small focused tests where shared behavior is introduced.**

Use component tests for reusable helpers. Keep page changes lightweight when they depend on live query data.

- [ ] **Step 2: Plate Rotation.**

Add selected plate/date detail strip, heat strength styling hooks, and clearer matrix cell classes.

- [ ] **Step 3: Ask AI.**

Add provider/model status cards, prompt preview panel, history restore actions, and Markdown-style answer container.

- [ ] **Step 4: Limit Review.**

Add weakness workspace and board-height mini chart styling while preserving existing AI and group table flow.

- [ ] **Step 5: Auction.**

Add summary hero, auto-refresh toggle, and selected stock linkage styling without triggering side-effect actions.

### Task 4: Verification

**Files:**
- No production files unless failures require fixes.

- [ ] **Step 1: Run typecheck.**

Run: `npm run typecheck`
Expected: pass.

- [ ] **Step 2: Run unit tests.**

Run: `npm test`
Expected: pass.

- [ ] **Step 3: Run production build.**

Run: `npm run build`
Expected: pass.

- [ ] **Step 4: Visual audit.**

Run: `node scripts\visual-audit.mjs`
Expected: captures updated screenshots without page errors.
