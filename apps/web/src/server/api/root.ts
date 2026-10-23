import { router } from "./trpc";
import { workspaceRouter } from "@/modules/core/workspaces/router";
import { projectRouter } from "@/modules/core/projects/router";
import { taskRouter } from "@/modules/core/tasks/router";
import { commentRouter } from "@/modules/core/comments/router";
import { notificationRouter } from "@/modules/core/notifications/router";
import { labelRouter } from "@/modules/core/labels/router";
import { milestoneRouter } from "@/modules/core/milestones/router";
import { timeRouter } from "@/modules/time-tracking/router";
import { workflowRouter } from "@/modules/workflows/router";
import { customFieldRouter } from "@/modules/custom-fields/router";
import { budgetRouter } from "@/modules/budget/router";
import { riskRouter, issueRouter } from "@/modules/risks/router";
import { changeRouter } from "@/modules/change-control/router";
import { stakeholderRouter } from "@/modules/stakeholders/router";
import { documentRouter } from "@/modules/documents/router";
import { evaluationRouter } from "@/modules/evaluation/router";
import { reportRouter } from "@/modules/reports/router";
import { searchRouter } from "@/modules/search/router";
import { logframeRouter } from "@/modules/ngo/logframe/router";
import { indicatorRouter } from "@/modules/ngo/indicators/router";
import { fundingRouter } from "@/modules/ngo/grants/router";
import { partnerRouter } from "@/modules/ngo/partners/router";
import { beneficiaryRouter } from "@/modules/ngo/beneficiaries/router";
import { donorReportRouter } from "@/modules/ngo/donor-reports/router";
import { integrationRouter } from "@/modules/integrations/router";
import { exchangeRouter } from "@/modules/data-exchange/router";

// Every module's endpoints are joined here
export const appRouter = router({
  // core
  workspace: workspaceRouter,
  project: projectRouter,
  task: taskRouter,
  comment: commentRouter,
  notification: notificationRouter,
  label: labelRouter,
  milestone: milestoneRouter,
  // lifecycle
  workflow: workflowRouter,
  customField: customFieldRouter,
  budget: budgetRouter,
  risk: riskRouter,
  issue: issueRouter,
  change: changeRouter,
  stakeholder: stakeholderRouter,
  document: documentRouter,
  evaluation: evaluationRouter,
  time: timeRouter,
  report: reportRouter,
  search: searchRouter,
  // NGO pack
  logframe: logframeRouter,
  indicator: indicatorRouter,
  funding: fundingRouter,
  partner: partnerRouter,
  beneficiary: beneficiaryRouter,
  donorReport: donorReportRouter,
  // connections to other tools
  integration: integrationRouter,
  exchange: exchangeRouter,
});

export type AppRouter = typeof appRouter;
