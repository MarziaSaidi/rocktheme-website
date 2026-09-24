export {
  getAllProjects,
  getFeaturedProjects,
  getNextProject,
  getProjectBySlug,
  getProjectRoute,
  getProjectStaticParams,
  requireProjectBySlug,
} from "./projectLoader";
export { projectRegistry } from "./projectRegistry";
export { getCaseStudyStages } from "./caseStudyAdapter";
export {
  BLOCK_LAYOUT,
  PROJECT_ACCENT_BEHAVIORS,
  PROJECT_BLOCK_TYPES,
  PROJECT_SCENE_PLACEMENTS,
  PROJECT_VISUAL_EMPHASIS,
} from "./project.types";
export type {
  BlockColumns,
  BlockMediaPosition,
  BlockTone,
  BlockWidth,
  CaseStudyBlock,
  CaseStudyInfo,
  CaseStudyStage,
  CaseStudyStory,
  ImageMedia,
  Project,
  ProjectBlockType,
  ProjectMedia,
  ProjectAccentBehavior,
  ProjectScenePlacement,
  ProjectVisualEmphasis,
  StoryVisual,
  VideoMedia,
} from "./project.types";
