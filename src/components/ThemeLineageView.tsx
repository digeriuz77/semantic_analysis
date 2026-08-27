"use client";

import { useState } from "react";
import type {
  ConsensusTheme,
  ThemeAnnotation,
  ThemeLineageMember,
} from "@/types";
import { cosinePercent, tierColor } from "@/lib/kappa";
import {
  ArrowLeft,
  GitBranch,
  Quote,
  CheckCircle2,
  XCircle,
  Flag,
  Save,
  Network,
} from "lucide-react";

interface ThemeLineageViewProps {
  theme: ConsensusTheme;
  themeIndex: number;
  runSeeds: number[];
  annotation?: ThemeAnnotation;
  onAnnotate: (annotation: ThemeAnnotation) => void;
  onBack: () => void;
}

export function ThemeLineageView({
  theme,
  themeIndex,
  runSeeds,
  annotation,
  onAnnotate,
  onBack,
}: ThemeLineageViewProps) {
  const [annoStatus, setAnnoStatus] = useState<ThemeAnnotation["status"]>(
    annotation?.status ?? "accepted"
  );
  const [note, setNote] = useState(annotation?.note ?? "");

  const save = () => {
    onAnnotate({
      status: annoStatus,
      note: note.trim(),
      updatedAt: new Date().toISOString(),
    });
  };

  const members = theme.lineage ?? [];
  const sortedMembers = [...members].sort(
    (a, b) => b.cosineToMedoid - a.cosineToMedoid
  );
  const medoid = members.find((m) => m.isMedoid);

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
      >
        <ArrowLeft size={16} /> Back to consensus themes
      </button>

      {/* Header */}
      <div
        className="rounded-xl border-2 p-6"
        style={{
          borderColor: `${tierColor(theme.tier)}55`,
          backgroundColor: `${tierColor(theme.tier)}11`,
        }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold">
              Consensus theme #{themeIndex + 1}
            </p>
            <h2 className="text-2xl font-bold text-white mt-1">{theme.label}</h2>
            <p className="text-slate-300 text-sm mt-2 max-w-2xl">
              {theme.description}
            </p>
          </div>
          <div className="text-right">
            <div
              className="text-3xl font-bold font-mono"
              style={{ color: tierColor(theme.tier) }}
            >
              {theme.occurrence}/{theme.runCount}
            </div>
            <p className="text-xs text-slate-400">runs · {theme.tier}</p>
          </div>
        </div>
      </div>

      {/* Lineage: per-run derivation */}
      <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-white font-semibold flex items-center gap-2 mb-4">
          <GitBranch size={18} className="text-teal-400" />
          Derivation Lineage
        </h3>
        <p className="text-slate-400 text-xs mb-5 max-w-2xl">
          Each row is one LLM run&apos;s contribution to this consensus theme.
          The cluster formed because these theme variants had cosine similarity
          ≥ the threshold. The medoid is the most central, used as the
          representative.
        </p>

        {sortedMembers.length === 0 ? (
          <p className="text-slate-500 text-sm italic">
            No lineage recorded (older analysis format).
          </p>
        ) : (
          <div className="space-y-3">
            {sortedMembers.map((m, i) => (
              <LineageMemberRow
                key={i}
                member={m}
                seed={runSeeds[m.runIndex] ?? m.seed ?? m.runIndex}
              />
            ))}
          </div>
        )}

        {medoid && members.length > 1 && (
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <Network size={14} className="text-teal-400" />
            Cluster cohesion: members agree at cosine{" "}
            <span className="text-slate-300 font-mono">
              {(
                members.reduce((s, m) => s + m.cosineToMedoid, 0) /
                members.length
              ).toFixed(3)}
            </span>{" "}
            avg to medoid.
          </div>
        )}
      </section>

      {/* Evidence: supporting source spans */}
      <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-white font-semibold flex items-center gap-2 mb-4">
          <Quote size={18} className="text-teal-400" />
          Evidence from Source Corpus
        </h3>
        {(theme.evidence && theme.evidence.length > 0) ||
        members.some((m) => m.quotes.length > 0) ? (
          <div className="space-y-4">
            {/* LLM-returned quotes first */}
            {members.some((m) => m.quotes.length > 0) && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">
                  LLM-cited quotes
                </p>
                <div className="space-y-2">
                  {members
                    .flatMap((m) => m.quotes.map((q) => ({ q, seed: m.seed })))
                    .slice(0, 6)
                    .map((item, i) => (
                      <blockquote
                        key={i}
                        className="border-l-2 border-teal-500 pl-3 py-1 text-slate-300 text-sm italic"
                      >
                        &ldquo;{item.q}&rdquo;
                        <span className="not-italic text-slate-600 text-xs ml-2">
                          (seed {item.seed ?? "?"})
                        </span>
                      </blockquote>
                    ))}
                </div>
              </div>
            )}
            {/* Retrieved spans */}
            {theme.evidence && theme.evidence.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">
                  Retrieved by semantic similarity
                </p>
                <div className="space-y-2">
                  {theme.evidence.map((span, i) => (
                    <div
                      key={i}
                      className="bg-slate-950 border border-slate-800 rounded-lg p-3"
                    >
                      <p className="text-slate-300 text-sm">{span.text}</p>
                      <span className="text-xs text-slate-600 font-mono mt-1 inline-flex items-center gap-2 flex-wrap">
                        {span.rowIndex !== undefined ? (
                          <span className="text-teal-500/80">
                            row {span.rowIndex}
                            {span.columnName ? ` · ${span.columnName}` : ""}
                          </span>
                        ) : null}
                        <span>
                          cosine {span.cosine.toFixed(3)} ({cosinePercent(span.cosine)}%)
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-slate-500 text-sm italic">
            No evidence spans available (enable the NLP service for retrieval).
          </p>
        )}
      </section>

      {/* Annotation: researcher judgement */}
      <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-white font-semibold flex items-center gap-2 mb-4">
          <Flag size={18} className="text-gold-400" />
          Researcher Annotation
        </h3>
        <p className="text-slate-400 text-xs mb-4 max-w-2xl">
          Record your case-by-case judgement. This iterates transparency: future
          readers can see which themes a researcher accepted, rejected, or
          flagged as artifacts, and why.
        </p>
        <div className="flex gap-2 mb-4">
          {(
            [
              ["accepted", "Accept", CheckCircle2, "#0d9488"],
              ["rejected", "Reject", XCircle, "#ef4444"],
              ["flagged", "Flag", Flag, "#f59e0b"],
            ] as const
          ).map(([status, label, Icon, color]) => (
            <button
              key={status}
              onClick={() => setAnnoStatus(status)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-colors ${
                annoStatus === status ? "text-white" : "text-slate-400"
              }`}
              style={{
                borderColor: annoStatus === status ? color : "#334155",
                backgroundColor: annoStatus === status ? `${color}33` : "transparent",
              }}
            >
              <Icon size={15} style={{ color }} /> {label}
            </button>
          ))}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Why this disposition? (e.g. 'This appears to be an artifact of seed 456 only; the supporting quotes are weak.')"
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:border-teal-500 outline-none resize-y"
        />
        <div className="flex items-center justify-between mt-3">
          {annotation && (
            <span className="text-xs text-slate-500">
              Last annotated {new Date(annotation.updatedAt).toLocaleString()}
            </span>
          )}
          <button
            onClick={save}
            className="ml-auto flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Save size={15} /> Save Annotation
          </button>
        </div>
      </section>
    </div>
  );
}

function LineageMemberRow({
  member,
  seed,
}: {
  member: ThemeLineageMember;
  seed: number;
}) {
  const cosPct = cosinePercent(member.cosineToMedoid);
  const cosColor =
    cosPct >= 80 ? "#0d9488" : cosPct >= 60 ? "#3b82f6" : "#f59e0b";

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-slate-500">
            run #{member.runIndex + 1}
          </span>
          <span className="text-xs font-mono text-teal-400">seed {seed}</span>
          {member.isMedoid && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-teal-900/50 text-teal-300 border border-teal-700">
              medoid
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <span style={{ color: cosColor }}>cos {member.cosineToMedoid.toFixed(3)}</span>
          <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${cosPct}%`, backgroundColor: cosColor }}
            />
          </div>
        </div>
      </div>
      <p className="text-slate-200 text-sm font-medium">
        {member.name || "(unnamed)"}
      </p>
      {member.description && (
        <p className="text-slate-400 text-xs mt-1">{member.description}</p>
      )}
      {member.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {member.keywords.map((kw, i) => (
            <span
              key={i}
              className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded"
            >
              {kw}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
