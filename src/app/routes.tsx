import type { ReactNode } from "react";
import { Navigate, RouteObject } from "react-router-dom";
import { AskAiPage } from "../features/askAi/AskAiPage";
import { AuctionPage } from "../features/auction/AuctionPage";
import { BoardHeightPage } from "../features/boardHeight/BoardHeightPage";
import { BoardTierPage } from "../features/boardTier/BoardTierPage";
import { JobsPage } from "../features/jobs/JobsPage";
import { LimitReviewPage } from "../features/limitReview/LimitReviewPage";
import { MarketCenterPage } from "../features/marketCenter/MarketCenterPage";
import { NewsPage } from "../features/news/NewsPage";
import { NodePage } from "../features/node/NodePage";
import { OverviewPage } from "../features/overview/OverviewPage";
import { PlateRotationPage } from "../features/plateRotation/PlateRotationPage";
import { YesterdayStatsPage } from "../features/yesterdayStats/YesterdayStatsPage";
import { AppShell } from "../shared/components/AppShell";

function ShellPage({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

export const routes: RouteObject[] = [
  { element: <Navigate replace to="/overview" />, path: "/" },
  { element: <ShellPage><OverviewPage /></ShellPage>, path: "/overview" },
  { element: <ShellPage><AuctionPage /></ShellPage>, path: "/auction" },
  { element: <ShellPage><NodePage /></ShellPage>, path: "/node" },
  { element: <ShellPage><MarketCenterPage /></ShellPage>, path: "/market-center" },
  { element: <ShellPage><YesterdayStatsPage /></ShellPage>, path: "/yesterday-stats" },
  { element: <ShellPage><BoardTierPage /></ShellPage>, path: "/board-tier" },
  { element: <ShellPage><BoardHeightPage /></ShellPage>, path: "/board-height" },
  { element: <ShellPage><LimitReviewPage /></ShellPage>, path: "/limit-review" },
  { element: <ShellPage><PlateRotationPage /></ShellPage>, path: "/plate-rotation" },
  { element: <ShellPage><NewsPage /></ShellPage>, path: "/news" },
  { element: <ShellPage><AskAiPage /></ShellPage>, path: "/ask-ai" },
  { element: <ShellPage><JobsPage /></ShellPage>, path: "/jobs" }
];
