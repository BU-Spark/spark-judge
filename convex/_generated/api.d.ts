/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as appreciations from "../appreciations.js";
import type * as auth from "../auth.js";
import type * as demoDayImport from "../demoDayImport.js";
import type * as events from "../events.js";
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
import type * as judgeAssignments from "../judgeAssignments.js";
import type * as migrations from "../migrations.js";
import type * as participants from "../participants.js";
import type * as prizes from "../prizes.js";
import type * as qrCodes from "../qrCodes.js";
import type * as qrCodesQueries from "../qrCodesQueries.js";
import type * as router from "../router.js";
import type * as scores from "../scores.js";
import type * as seed from "../seed.js";
import type * as seeds_admin_adminAccess from "../seeds/admin/adminAccess.js";
import type * as seeds_admin_clearAllData from "../seeds/admin/clearAllData.js";
import type * as seeds_core_seedEvents from "../seeds/core/seedEvents.js";
import type * as seeds_core_seedEverything from "../seeds/core/seedEverything.js";
import type * as seeds_core_seedJudgeScores from "../seeds/core/seedJudgeScores.js";
import type * as seeds_demos_cohortJudging from "../seeds/demos/cohortJudging.js";
import type * as seeds_demos_demoDay from "../seeds/demos/demoDay.js";
import type * as seeds_demos_regularJudging from "../seeds/demos/regularJudging.js";
import type * as seeds_prize_prizeFlow from "../seeds/prize/prizeFlow.js";
import type * as seeds_shared_auth from "../seeds/shared/auth.js";
import type * as seeds_shared_scoring from "../seeds/shared/scoring.js";
import type * as teams from "../teams.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  appreciations: typeof appreciations;
  auth: typeof auth;
  demoDayImport: typeof demoDayImport;
  events: typeof events;
  helpers: typeof helpers;
  http: typeof http;
  judgeAssignments: typeof judgeAssignments;
  migrations: typeof migrations;
  participants: typeof participants;
  prizes: typeof prizes;
  qrCodes: typeof qrCodes;
  qrCodesQueries: typeof qrCodesQueries;
  router: typeof router;
  scores: typeof scores;
  seed: typeof seed;
  "seeds/admin/adminAccess": typeof seeds_admin_adminAccess;
  "seeds/admin/clearAllData": typeof seeds_admin_clearAllData;
  "seeds/core/seedEvents": typeof seeds_core_seedEvents;
  "seeds/core/seedEverything": typeof seeds_core_seedEverything;
  "seeds/core/seedJudgeScores": typeof seeds_core_seedJudgeScores;
  "seeds/demos/cohortJudging": typeof seeds_demos_cohortJudging;
  "seeds/demos/demoDay": typeof seeds_demos_demoDay;
  "seeds/demos/regularJudging": typeof seeds_demos_regularJudging;
  "seeds/prize/prizeFlow": typeof seeds_prize_prizeFlow;
  "seeds/shared/auth": typeof seeds_shared_auth;
  "seeds/shared/scoring": typeof seeds_shared_scoring;
  teams: typeof teams;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
