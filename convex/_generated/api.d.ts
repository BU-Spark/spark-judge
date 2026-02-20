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
