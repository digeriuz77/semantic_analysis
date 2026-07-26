/**
 * Epistemological paradigms and their quality criteria.
 *
 * Distilled from the qualitative-research-skill methodology. The core principle
 * (Source B): paradigm determines which validity criteria are appropriate —
 * constructivist work emphasizes Lincoln & Guba trustworthiness and should NOT
 * be forced to report Cohen's kappa, whereas post-positivist work may use κ.
 * This module drives which metrics the dashboard surfaces.
 */

export type ParadigmId =
  | "constructivist"
  | "post_positivist"
  | "critical"
  | "pragmatic";

export interface QualityCriterion {
  id: string;
  name: string;
  description: string;
}

export interface Paradigm {
  id: ParadigmId;
  label: string;
  summary: string;
  /** Whether Cohen's kappa is appropriate for this paradigm. */
  kappaAppropriate: boolean;
  /** Whether to foreground kappa or treat it as optional/supplementary. */
  foregroundKappa: boolean;
  qualityCriteria: QualityCriterion[];
}

export const PARADIGMS: Record<ParadigmId, Paradigm> = {
  constructivist: {
    id: "constructivist",
    label: "Constructivist",
    summary:
      "Reality is socially constructed and interpreted. Meaning is co-produced between researcher and participants. Emphasises Lincoln & Guba trustworthiness criteria; κ is optional, not mandated.",
    kappaAppropriate: false,
    foregroundKappa: false,
    qualityCriteria: [
      {
        id: "credibility",
        name: "Credibility",
        description:
          "Are the findings a faithful representation of participants' meanings? Supported by persistent engagement, triangulation, member checking, and peer debriefing.",
      },
      {
        id: "transferability",
        name: "Transferability",
        description:
          "Can findings transfer to other contexts? Supported by thick description that lets readers judge applicability to their setting.",
      },
      {
        id: "dependability",
        name: "Dependability",
        description:
          "Is the analytic process trackable and consistent? Supported by an audit trail — exactly what the pipeline trace and lineage views provide.",
      },
      {
        id: "confirmability",
        name: "Confirmability",
        description:
          "Do findings reflect the data rather than researcher bias? Supported by confirmability audit and reflexive annotation.",
      },
    ],
  },
  post_positivist: {
    id: "post_positivist",
    label: "Post-positivist",
    summary:
      "Reality exists but is only imperfectly apprehensible. Seeks objectivity through systematic, replicable methods. Cohen's kappa is appropriate and foregrounded for inter-rater reliability.",
    kappaAppropriate: true,
    foregroundKappa: true,
    qualityCriteria: [
      {
        id: "internal_validity",
        name: "Internal validity",
        description:
          "Causal and inferential soundness; inter-rater reliability (κ) supports that coding is systematic rather than idiosyncratic.",
      },
      {
        id: "external_validity",
        name: "External validity",
        description: "Generalisability of findings, supported by transparent sampling.",
      },
      {
        id: "reliability",
        name: "Reliability",
        description:
          "Replicability of the analysis. The ensemble + κ + reproducible seeds provide a quantified reliability claim.",
      },
      {
        id: "objectivity",
        name: "Objectivity",
        description:
          "Findings grounded in data, minimising researcher influence; supported by the audit trail.",
      },
    ],
  },
  critical: {
    id: "critical",
    label: "Critical",
    summary:
      "Research aims to critique and transform power relations. Emphasises authenticity criteria (fairness, ontological and educative authenticity). κ is supplementary at most.",
    kappaAppropriate: false,
    foregroundKappa: false,
    qualityCriteria: [
      {
        id: "fairness",
        name: "Fairness",
        description:
          "Are all stakeholder constructions of the issue faithfully represented, including marginalised voices?",
      },
      {
        id: "ontological_authenticity",
        name: "Ontological authenticity",
        description:
          "Did participants' understandings of their world improve through the research process?",
      },
      {
        id: "educative_authenticity",
        name: "Educative authenticity",
        description:
          "Did participants' understanding of others' constructions improve?",
      },
      {
        id: "catalytic_authenticity",
        name: "Catalytic authenticity",
        description: "Did the research empower action among participants?",
      },
    ],
  },
  pragmatic: {
    id: "pragmatic",
    label: "Pragmatic",
    summary:
      "Method chosen by what best answers the research question; mixes criteria as appropriate. κ and trustworthiness can both be reported depending on audience.",
    kappaAppropriate: true,
    foregroundKappa: false,
    qualityCriteria: [
      {
        id: "usefulness",
        name: "Usefulness",
        description:
          "Do the findings productively inform the problem under study?",
      },
      {
        id: "transparency",
        name: "Transparency",
        description: "Is the analytic process open to scrutiny (audit trail)?",
      },
      {
        id: "adequacy",
        name: "Adequacy",
        description:
          "Are the data and analysis sufficient to support the claims made?",
      },
      {
        id: "responsiveness",
        name: "Responsiveness",
        description: "Does the method respond to the real-world context?",
      },
    ],
  },
};

export const PARADIGM_LIST: Paradigm[] = Object.values(PARADIGMS);
