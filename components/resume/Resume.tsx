"use client";
// /resume (pedido de Lucas 11/11, como /curriculo do v5): currículo em HTML (EN fiel ao PDF), download do PDF,
// impressão A4 e linguagem RITO. Conteúdo: direction/about-curriculo.md (lib/site.ts → CV).
import Link from "next/link";
import { useState } from "react";
import { copyText } from "@/lib/motion";
import { PROJECTS } from "@/lib/projects";
import { CV, SITE } from "@/lib/site";
import { SectionIntro } from "@/components/bits/SectionIntro";
import { SplitText } from "@/components/bits/SplitText";
import { SectionIndex } from "@/components/SectionIndex";

const INDEX = [
  { id: "cv-profile", label: "Profile" },
  { id: "cv-skills", label: "Skills" },
  { id: "cv-work", label: "Work" },
  { id: "cv-education", label: "Education" },
];

export function Resume() {
  const [copied, setCopied] = useState(false);
  return (
    <main id="main" tabIndex={-1} className="resume">
      <article className="cv-sheet" aria-labelledby="cv-name">
        <header className="cv-head">
          <h1 id="cv-name">
            <SplitText tag="span" text="Lucas" className="grot" /> <span className="black">Melo</span>
          </h1>
          <p className="cv-role">{SITE.role}</p>
          <p className="mono cv-loc">Brazil · Remote</p>
          <ul className="cv-contact">
            <li>
              <a href={`mailto:${SITE.email}`}>{SITE.email}</a>{" "}
              <button
                type="button"
                className="pill no-print"
                onClick={() => copyText(SITE.email).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                })}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </li>
            <li>
              <a href={SITE.tel}>{SITE.phone}</a>
            </li>
            <li>
              <a href={SITE.github} target="_blank" rel="noopener">github.com/lucshllw</a>
            </li>
            <li>
              <a href={SITE.linkedin} target="_blank" rel="noopener">LinkedIn — Lucas Melo</a>
            </li>
          </ul>
          <span className="sr-only" aria-live="polite">{copied ? "Email address copied to clipboard" : ""}</span>
          <div className="cv-actions no-print">
            <a className="pill" href={SITE.resume} download="lucas-melo-resume.pdf">
              Download PDF (Portuguese) ↓
            </a>
            <button type="button" className="pill" onClick={() => window.print()}>
              Print
            </button>
          </div>
        </header>

        <SectionIntro n={1} title="Profile" className="cv-sec" id="cv-profile">
          <p className="cv-text">{CV.profile}</p>
        </SectionIntro>
        <SectionIntro n={2} title="Skills" className="cv-sec" id="cv-skills">
          <dl className="cv-skills">
            {CV.skills.map((s) => (
              <div key={s.k}>
                <dt>{s.k}</dt>
                <dd>{s.v}</dd>
              </div>
            ))}
          </dl>
        </SectionIntro>
        <SectionIntro n={3} title="Selected work" className="cv-sec" id="cv-work">
          <ol className="cv-work">
            {PROJECTS.map((p) => (
              <li key={p.slug}>
                <Link href={`/works/${p.slug}/`}>
                  <span className="n">{p.n}</span>
                  <span className="name">{p.name}</span>
                  <span className="kind">
                    {p.kind}
                    {p.slug === "infernai" ? " · built as a pair" : ""} — {p.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                  </span>
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ol>
        </SectionIntro>
        <SectionIntro n={4} title="Education" className="cv-sec" id="cv-education">
          <ul className="cv-edu">
            {CV.education.map((e) => (
              <li key={e.inst}>
                <span className="inst">{e.inst}</span>
                <span className="course">{e.course}</span>
                <span className="status">{e.status}</span>
              </li>
            ))}
          </ul>
        </SectionIntro>
      </article>
      <SectionIndex items={INDEX} />
    </main>
  );
}
