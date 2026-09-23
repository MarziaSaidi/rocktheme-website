import { getCampusProject } from "./records/get-campus.project";
import { newStartMobileProject } from "./records/new-start-mobile.project";
import { qalinProject } from "./records/qalin.project";
import { quillAndPigeonProject } from "./records/quill-and-pigeon.project";
import { relayProject } from "./records/relay.project";
import { supportIqProject } from "./records/supportiq.project";
import { survueProject } from "./records/survue.project";
import { wildwoodProject } from "./records/wildwood.project";
import type { Project } from "./project.types";

/**
 * The registry is the single import boundary for project records.
 * Display order is always derived from each record's `order` field.
 */
export const projectRegistry = [
  qalinProject,
  relayProject,
  supportIqProject,
  getCampusProject,
  newStartMobileProject,
  quillAndPigeonProject,
  wildwoodProject,
  survueProject,
] satisfies readonly Project[];
