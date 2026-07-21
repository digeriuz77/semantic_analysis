/**
 * COREQ (Consolidated criteria for reporting qualitative research) — 32-item
 * checklist (Tong, Sainsbury & Craig, 2007). Condensed for self-check.
 * Source: qualitative-research-skill methodology references.
 */

import type { CoreqItem } from "@/types";

export const COREQ_ITEMS: CoreqItem[] = [
  // Team and reflexivity (items 1-8)
  { id: 1, domain: "team", question: "Interviewer/facilitator identified and credentialed (occupation, experience)?" },
  { id: 2, domain: "team", question: "Were participants' characteristics reported (age, sex, occupation, etc.)?" },
  { id: 3, domain: "team", question: "Was the relationship between researcher and participants established before study commencement?" },
  { id: 4, domain: "team", question: "Did participants know the researcher's characteristics (goals, reasons for research)?" },
  { id: 5, domain: "team", question: "Were interviewer characteristics reported that could influence the inquiry (bias)?" },
  { id: 6, domain: "team", question: "Was the relationship between researcher and participants considered for its influence?" },
  { id: 7, domain: "team", question: "Was researcher reflexivity reported (how the researcher's stance shaped inquiry)?" },
  { id: 8, domain: "team", question: "Were repeat interviews carried out, and if so, how many?" },

  // Study design (items 9-15)
  { id: 9, domain: "study_methods", question: "Was the theoretical framework guiding the study stated and described?" },
  { id: 10, domain: "study_methods", question: "Was the participant selection method stated (purposive, theoretical, etc.)?" },
  { id: 11, domain: "study_methods", question: "Was the method of approach to participants stated?" },
  { id: 12, domain: "study_methods", question: "Was the sample method and size justified?" },
  { id: 13, domain: "study_methods", question: "Was the setting of data collection described (where, when)?" },
  { id: 14, domain: "study_methods", question: "Was the presence of non-participants during interview reported?" },
  { id: 15, domain: "study_methods", question: "Was a description of the sample given (demographics)?" },

  // Data collection (items 16-22, under study_methods domain)
  { id: 16, domain: "study_methods", question: "Was the interview guide described (semi-structured, pilot-tested)?" },
  { id: 17, domain: "study_methods", question: "Were repeat interviews (follow-ups) described?" },
  { id: 18, domain: "study_methods", question: "Were audio/visual recordings made and reported?" },
  { id: 19, domain: "study_methods", question: "Was field note-taking described?" },
  { id: 20, domain: "study_methods", question: "Was data saturation discussed?" },
  { id: 21, domain: "study_methods", question: "Were transcripts returned to participants for comment/correction?" },
  { id: 22, domain: "study_methods", question: "Was the number of data collection sessions reported?" },

  // Analysis and findings (items 23-28)
  { id: 23, domain: "analysis", question: "Were the data coding tree / index themes derived and described?" },
  { id: 24, domain: "analysis", question: "Were themes derived inductively or deductively described?" },
  { id: 25, domain: "analysis", question: "Was software used for data management described?" },
  { id: 26, domain: "analysis", question: "Was participant checking / member checking carried out?" },
  { id: 27, domain: "analysis", question: "Were quotations presented to link findings to data (with participant identifiers)?" },
  { id: 28, domain: "analysis", question: "Was consistency between data presented and findings demonstrated?" },

  // Reporting (items 29-32)
  { id: 29, domain: "reports", question: "Were major themes presented clearly in the findings?" },
  { id: 30, domain: "reports", question: "Was there a distinction between data and interpretation?" },
  { id: 31, domain: "reports", question: "Were divergent cases / negative instances reported?" },
  { id: 32, domain: "reports", question: "Was the discussion of findings connected to theory and prior literature?" },
];

export const COREQ_DOMAIN_LABEL: Record<CoreqItem["domain"], string> = {
  team: "Team and reflexivity",
  study_methods: "Study design & data collection",
  context: "Context",
  analysis: "Analysis & findings",
  reports: "Reporting",
};
