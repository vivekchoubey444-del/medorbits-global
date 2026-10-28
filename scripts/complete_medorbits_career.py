
#!/usr/bin/env python3
"""
MedOrbits Career Pages Builder -- Production-Oriented Edition
===========================================================

File:
    scripts/complete_medorbits_career.py

Requirements:
    Python 3.10+
    No third-party Python packages

Usage from repository root:
    python scripts/complete_medorbits_career.py --dry-run
    python scripts/complete_medorbits_career.py
    python scripts/complete_medorbits_career.py --validate-only
    python scripts/complete_medorbits_career.py --force
    python scripts/complete_medorbits_career.py --force --force-support-files
    python scripts/complete_medorbits_career.py --report-json reports/career-build.json

Features:
    - Generates nine standalone career pages.
    - Premium dark green, champagne gold and burgundy design.
    - Responsive layouts, accessible controls and reduced-motion support.
    - Embedded CSS and JavaScript; no shared career assets required.
    - Existing pages and support files are preserved by default.
    - Atomic file writes and explicit overwrite controls.
    - Dry-run mode, validation-only mode and JSON reporting.
    - HTML structure, duplicate ID, image alt and local-link checks.
    - Safe path checks and explicit repository-root selection.
    - Creates documentation, manifest and optional scaffold folders.
    - Does not delete files, commit, push or deploy.

Important:
    The enquiry form opens an email draft; it does not submit to a server.
    Vacancy pages provide guidance and do not claim to list live vacancies.
    Review remote-image licensing, canonical URLs and contact details before launch.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit


SITE_NAME = "MedOrbits"
SITE_URL = "https://www.medorbits.in"
CAREERS_EMAIL = "careers@medorbits.in"
GENERATOR_PATH = "scripts/complete_medorbits_career.py"
GENERATOR_VERSION = "3.0.0"

PAGE_NAMES = (
    "index.html",
    "fresher-jobs.html",
    "work-from-home.html",
    "internships.html",
    "apprenticeships.html",
    "walk-in-interviews.html",
    "application-form.html",
    "resume-guide.html",
    "interview-preparation.html",
)

PHOTO_IDS = {
    "team": "photo-1521737711867-e3b97375f902",
    "office": "photo-1521791136064-7986c2920216",
    "students": "photo-1523240795612-9a054b0db644",
    "training": "photo-1522071820081-009f0129c71c",
    "planning": "photo-1454165804606-c3d57bc86b40",
    "writing": "photo-1455390582262-044cdead277a",
    "meeting": "photo-1552664730-d307ca884978",
    "support": "photo-1553877522-43269d4ea984",
    "technology": "photo-1516321318423-f06f85e504b3",
    "remote": "photo-1498050108023-c5249f4df085",
}

def page(
    title: str,
    description: str,
    eyebrow: str,
    heading: str,
    intro: str,
    image: str,
    primary: tuple[str, str],
    secondary: tuple[str, str],
    stats: list[tuple[str, str]],
    sections: list[tuple[str, str, list[tuple[str, str, str, str]]]],
    faqs: list[tuple[str, str]],
) -> dict[str, Any]:
    return {
        "title": title,
        "description": description,
        "eyebrow": eyebrow,
        "heading": heading,
        "intro": intro,
        "image": image,
        "primary": primary,
        "secondary": secondary,
        "stats": stats,
        "sections": sections,
        "faqs": faqs,
    }


PAGES: dict[str, dict[str, Any]] = {
    "index.html": page(
        "MedOrbits Career Hub | Jobs, Internships & Career Support",
        "Explore career guidance, fresher jobs, internships, apprenticeships, remote-work resources and interview preparation with MedOrbits.",
        "CAREER HUB",
        "Build your next chapter with confidence.",
        "Explore career resources, prepare for interviews and take practical steps toward your next career move with MedOrbits.",
        "team",
        ("Explore opportunities", "#opportunities"),
        ("Career enquiry", "application-form.html"),
        [("Career paths", "Explore"), ("Practical guidance", "Prepare"), ("Next step", "Start today")],
        [
            ("Find your next opportunity", "Explore resources by the kind of opportunity you are looking for.", [
                ("Fresher jobs", "Entry-level job-search guidance for graduates and first-time applicants.", "fresher-jobs.html", "office"),
                ("Work from home", "Explore remote-work categories and learn to evaluate listings carefully.", "work-from-home.html", "remote"),
                ("Internships", "Build practical experience and strengthen your early-career profile.", "internships.html", "students"),
                ("Apprenticeships", "Understand structured workplace training and skill development.", "apprenticeships.html", "training"),
                ("Walk-in interviews", "Prepare documents and verify the details before attending a drive.", "walk-in-interviews.html", "team"),
                ("Career application", "Prepare an enquiry about career guidance and support.", "application-form.html", "planning"),
            ]),
            ("Strengthen your applications", "Use clear, accurate information to demonstrate your skills.", [
                ("Resume guide", "Build a readable resume focused on relevant skills and evidence.", "resume-guide.html", "writing"),
                ("Interview preparation", "Practise genuine examples and prepare useful questions.", "interview-preparation.html", "meeting"),
                ("Opportunity checks", "Verify employer identity, eligibility, terms and application routes.", "fresher-jobs.html", "support"),
            ]),
        ],
        [
            ("Does MedOrbits guarantee employment?", "No. Guidance may support your search, but selection depends on the employer and your eligibility."),
            ("Should I pay an employer to get hired?", "Be cautious of upfront fees, deposits and guaranteed-placement payments. Independently verify the organisation before paying or sharing sensitive information."),
            ("What should I prepare before applying?", "Prepare an accurate resume, education and experience details, relevant certificates and a professional email address."),
        ],
    ),
    "fresher-jobs.html": page(
        "Fresher Jobs | MedOrbits Career Hub",
        "Entry-level job-search guidance, application preparation and practical checks for fresher opportunities.",
        "EARLY CAREER",
        "Start strong. Learn fast. Grow with purpose.",
        "Organise your job search, identify realistic entry-level roles and prepare applications that communicate your strengths.",
        "office",
        ("Prepare an application", "application-form.html"),
        ("Explore internships", "internships.html"),
        [("Resume", "Tailored"), ("Skills", "Demonstrated"), ("Claims", "Verified")],
        [
            ("A practical fresher job-search plan", "Use a repeatable process rather than applying randomly.", [
                ("Choose target roles", "Identify roles that match your qualification, location, skills and learning goals.", "application-form.html", "planning"),
                ("Build a focused resume", "Highlight education, projects, coursework, certifications and demonstrable skills.", "resume-guide.html", "writing"),
                ("Track applications", "Record employer, role, application date, status and follow-up details.", "application-form.html", "meeting"),
            ]),
            ("Entry-level areas to explore", "These are search categories, not advertised live vacancies. Availability and eligibility vary.", [
                ("Operations and administration", "Explore coordinator, operations assistant and office-support role categories.", "application-form.html", "team"),
                ("Customer support", "Check communication requirements, shift patterns and language expectations.", "work-from-home.html", "support"),
                ("Technology and digital", "Show projects, portfolio links, practical skills and evidence of learning.", "internships.html", "technology"),
            ]),
        ],
        [
            ("Can I apply without experience?", "Yes, when the role accepts freshers. Highlight relevant projects, coursework, volunteering and transferable skills."),
            ("Are these live vacancies?", "This page provides job-search guidance. Confirm active vacancies through an employer's official careers website."),
            ("How do I avoid fake job offers?", "Verify employer contact details and the official domain. Never disclose OTPs, passwords or unnecessary identity-document information."),
        ],
    ),
    "work-from-home.html": page(
        "Work From Home Opportunities | MedOrbits",
        "Learn how to search for remote work, evaluate work-from-home listings and prepare remote applications.",
        "REMOTE WORK",
        "Find remote work with a clear, careful plan.",
        "Explore remote-work categories, prepare for online interviews and verify a listing before sharing personal information.",
        "remote",
        ("Start an application", "application-form.html"),
        ("Explore fresher jobs", "fresher-jobs.html"),
        [("Role fit", "First"), ("Employer", "Verified"), ("Fees", "Questioned")],
        [
            ("Remote-work categories", "Tasks, compensation, hours and eligibility depend on each employer.", [
                ("Customer support", "Check shifts, language needs, equipment requirements and training.", "application-form.html", "support"),
                ("Writing and content", "Prepare writing samples and clarify deadlines, ownership and revisions.", "resume-guide.html", "writing"),
                ("Digital and technical", "Show projects, practical skills and a portfolio where relevant.", "internships.html", "technology"),
                ("Virtual administration", "Review document, calendar, communication and confidentiality requirements.", "application-form.html", "planning"),
            ]),
            ("Remote-job safety checklist", "Pause and verify before proceeding if a listing feels rushed or unclear.", [
                ("Verify the employer", "Check the official website, company email domain and independently sourced contact details.", "fresher-jobs.html", "meeting"),
                ("Reject pay-to-work pressure", "Registration, security-deposit or guaranteed-job fees are warning signs requiring careful verification.", "application-form.html", "team"),
                ("Protect your information", "Never share OTPs, passwords or full payment-card credentials with recruiters.", "application-form.html", "technology"),
            ]),
        ],
        [
            ("Does remote work always mean flexible hours?", "No. Remote roles may have fixed shifts, attendance rules, targets and location restrictions."),
            ("Should I pay to receive remote work?", "Be highly cautious of fees connected to guaranteed employment. Verify independently before paying anything."),
            ("How can I check a remote job?", "Cross-check the vacancy on the employer's official careers page and use independently verified contact details."),
        ],
    ),
    "internships.html": page(
        "Internships & Practical Experience | MedOrbits",
        "Internship-search guidance, application preparation and practical ways to build experience.",
        "PRACTICAL EXPERIENCE",
        "Turn what you learn into work you can show.",
        "A well-chosen internship can help you practise skills, understand a workplace and build evidence for future applications.",
        "students",
        ("Prepare your application", "application-form.html"),
        ("Explore apprenticeships", "apprenticeships.html"),
        [("Learning goals", "Defined"), ("Mentorship", "Clarified"), ("Work samples", "Documented")],
        [
            ("Choose an internship carefully", "Look for a clear learning plan and realistic responsibilities.", [
                ("Match your interests", "Choose a field where you can build relevant, transferable skills.", "application-form.html", "technology"),
                ("Check the learning plan", "Clarify supervision, duration, work hours, stipend and expected deliverables.", "application-form.html", "team"),
                ("Prepare examples", "Use projects, coursework, volunteering and personal work to demonstrate your abilities.", "resume-guide.html", "writing"),
            ]),
            ("Before you accept", "Make sure expectations are written down and understandable.", [
                ("Confirm the terms", "Request written details about duties, duration, location, compensation and reporting.", "application-form.html", "planning"),
                ("Protect your work", "Understand confidentiality, ownership and portfolio-use rules before sharing work.", "application-form.html", "meeting"),
                ("Set a learning target", "Define what you want to practise and how progress will be reviewed.", "apprenticeships.html", "training"),
            ]),
        ],
        [
            ("Are all internships paid?", "No. Terms differ. Confirm compensation, expenses, hours and learning outcomes before accepting."),
            ("Can an internship guarantee a permanent job?", "Not usually. Ask whether conversion is possible, but treat guarantees cautiously and get terms in writing."),
            ("What if I have no previous experience?", "Use academic projects, volunteering, self-directed work and coursework to demonstrate interest and skills."),
        ],
    ),
    "apprenticeships.html": page(
        "Apprenticeships & Skill Training | MedOrbits",
        "Understand apprenticeship pathways, training expectations, application preparation and important checks.",
        "LEARN WHILE YOU WORK",
        "Build skills through structured workplace learning.",
        "Understand apprenticeship opportunities, review training agreements and prepare an accurate application.",
        "training",
        ("Prepare an application", "application-form.html"),
        ("Explore internships", "internships.html"),
        [("Training", "Structured"), ("Terms", "Written"), ("Skills", "Practical")],
        [
            ("What to review in an apprenticeship", "Programmes differ by occupation, employer and applicable rules.", [
                ("Eligibility", "Check age, qualification, trade, location and programme-specific requirements.", "application-form.html", "planning"),
                ("Training structure", "Understand practical training, classroom learning, assessments and supervision.", "internships.html", "team"),
                ("Stipend and conditions", "Read written terms for stipend, duration, working hours, leave and safety.", "application-form.html", "meeting"),
            ]),
            ("Prepare before applying", "Keep your information accurate and use official channels.", [
                ("Gather documents", "Prepare records only as requested through a verified application process.", "application-form.html", "writing"),
                ("Use official portals", "Confirm the scheme and employer through relevant official sources before registering.", "fresher-jobs.html", "technology"),
                ("Keep records", "Save the application reference, agreement, contact details and important communications.", "application-form.html", "planning"),
            ]),
        ],
        [
            ("Is an apprenticeship the same as a regular job?", "Not necessarily. It is generally a structured training arrangement with defined terms and learning objectives."),
            ("Do all apprenticeships have the same eligibility?", "No. Requirements depend on the trade, employer, scheme and applicable rules."),
            ("Where should I confirm official details?", "Use the relevant government or programme portal and the employer's verified recruitment channel."),
        ],
    ),
    "walk-in-interviews.html": page(
        "Walk-In Interviews | Preparation Guide | MedOrbits",
        "Prepare for walk-in interviews with document checklists, interview tips and employer verification guidance.",
        "INTERVIEW PREPARATION",
        "Walk in prepared. Leave a clear impression.",
        "Plan your documents, understand the role and verify the organiser before travelling to an interview.",
        "team",
        ("Prepare an application", "application-form.html"),
        ("Explore fresher jobs", "fresher-jobs.html"),
        [("Role details", "Checked"), ("Documents", "Ready"), ("Travel plan", "Set")],
        [
            ("Before you attend", "A few simple checks can help you avoid wasted travel and suspicious offers.", [
                ("Verify the drive", "Confirm date, venue, role and organiser using the employer's official contact channel.", "fresher-jobs.html", "meeting"),
                ("Prepare documents", "Carry relevant resume copies and requested certificates; avoid surrendering originals unnecessarily.", "application-form.html", "writing"),
                ("Plan your arrival", "Check the route, reporting time, dress expectations and a reliable contact number.", "application-form.html", "planning"),
            ]),
            ("During the interview", "Communicate clearly and ask practical questions about the role.", [
                ("Introduce yourself", "Summarise your education, relevant skills and interest in the role.", "interview-preparation.html", "team"),
                ("Clarify the job", "Ask about responsibilities, location, hours, compensation and reporting structure.", "application-form.html", "planning"),
                ("Watch for red flags", "Do not pay for guaranteed selection or share OTPs, passwords or banking credentials.", "work-from-home.html", "technology"),
            ]),
        ],
        [
            ("Are the walk-in details on this page current?", "No specific live drive is advertised here. Confirm current details directly with the employer."),
            ("Should I surrender original certificates?", "Keep originals in your possession. Show them for inspection only when genuinely required and use appropriate caution."),
            ("Is a recruitment fee normal?", "Be cautious of fees tied to guaranteed selection. Verify the recruiter and terms independently."),
        ],
    ),
    "application-form.html": page(
        "Career Support Enquiry | MedOrbits",
        "Contact MedOrbits about career guidance, job-search resources, internships, apprenticeships and recruitment support.",
        "CAREER SUPPORT",
        "Tell us what you want to work toward.",
        "Share basic details about your career enquiry. This demo form opens an email draft; it does not store or submit information to a server.",
        "planning",
        ("Browse opportunities", "index.html#opportunities"),
        ("Review interview tips", "interview-preparation.html"),
        [("Details", "Accurate"), ("Privacy", "Considered"), ("Next step", "Clear")],
        [
            ("Before you submit", "Only provide information needed for your enquiry.", [
                ("Use a professional email", "Choose an email address you can access and check regularly.", "resume-guide.html", "writing"),
                ("Keep documents safe", "Do not include passwords, OTPs, bank details or unnecessary identity-document numbers.", "work-from-home.html", "technology"),
                ("Describe your goal", "Tell us the role, field or kind of career support you are seeking.", "internships.html", "team"),
            ]),
        ],
        [
            ("Does this form send my details to MedOrbits?", "No. This standalone page opens an email draft on your device. It does not transmit or store form data."),
            ("Should I upload identity documents?", "No upload is provided. Share sensitive documents only through a verified, secure process when necessary."),
            ("Does an enquiry guarantee placement?", "No. An enquiry is not a job offer or a guarantee of employment."),
        ],
    ),
    "resume-guide.html": page(
        "Resume Guide | MedOrbits Career Hub",
        "Create a clear, accurate resume with practical guidance for freshers and early-career applicants.",
        "APPLICATION TOOLKIT",
        "Make your skills easy to understand.",
        "Use a clean, role-focused resume to show what you know, what you have done and how your experience relates to the opportunity.",
        "writing",
        ("Career support enquiry", "application-form.html"),
        ("Explore fresher jobs", "fresher-jobs.html"),
        [("Accuracy", "Essential"), ("Relevance", "Focused"), ("Format", "Readable")],
        [
            ("Resume essentials", "Keep the document readable and specific to the role.", [
                ("Contact details", "Include a professional email and phone number; omit unnecessary sensitive information.", "application-form.html", "planning"),
                ("Skills and projects", "Show concrete examples, tools used and outcomes you can explain honestly.", "internships.html", "technology"),
                ("Education and training", "List relevant qualifications, dates, certificates and coursework accurately.", "apprenticeships.html", "training"),
            ]),
        ],
        [
            ("How long should a fresher resume be?", "One page is often sufficient, but relevance and readability matter more than a strict length."),
            ("Should I include skills I have not used?", "Only list skills you can discuss honestly and demonstrate at an appropriate level."),
            ("Should I use one resume for every role?", "Keep a master resume and tailor the summary and relevant skills to each role."),
        ],
    ),
    "interview-preparation.html": page(
        "Interview Preparation | MedOrbits",
        "Prepare for interviews with practical research, structured examples and questions to ask employers.",
        "CAREER TOOLKIT",
        "Prepare with evidence, not memorised scripts.",
        "Research the employer, practise clear examples and prepare thoughtful questions so you can discuss your experience accurately.",
        "meeting",
        ("Walk-in interview guide", "walk-in-interviews.html"),
        ("Career support enquiry", "application-form.html"),
        [("Research", "Complete"), ("Examples", "Practised"), ("Questions", "Prepared")],
        [
            ("A repeatable preparation routine", "Use a simple structure to prepare without sounding scripted.", [
                ("Research the role", "Understand responsibilities, required skills, employer and interview format.", "fresher-jobs.html", "planning"),
                ("Prepare real examples", "Describe the situation, your actions and the result; clarify your contribution.", "resume-guide.html", "writing"),
                ("Ask useful questions", "Clarify success measures, training, work arrangements, compensation and next steps.", "application-form.html", "team"),
            ]),
        ],
        [
            ("What if I do not know an answer?", "Be honest, explain how you would approach the problem and avoid claiming experience you do not have."),
            ("How early should I arrive?", "Follow the employer's instructions and plan enough time for travel and check-in."),
            ("What should I ask about salary?", "Ask professionally about the compensation range, benefits, work hours and written terms when appropriate."),
        ],
    ),
}


CSS = r"""
:root{color-scheme:dark;--bg:#0b1713;--panel:#12251e;--panel2:#182c24;--gold:#d7b77a;--gold2:#f0d9a6;--cream:#f4eee2;--muted:#c0c8bf;--line:rgba(215,183,122,.24);--wine:#572b38;--radius:22px;--shadow:0 20px 60px rgba(0,0,0,.26)}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:100px}
body{margin:0;background:radial-gradient(ellipse at 10% 0%,rgba(87,43,56,.34),transparent 38%),radial-gradient(ellipse at 90% 12%,rgba(215,183,122,.10),transparent 30%),var(--bg);color:var(--cream);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.65}
a{color:inherit;text-decoration:none}
img{display:block;max-width:100%}
button,input,select,textarea{font:inherit}
.wrap{width:min(1160px,calc(100% - 40px));margin-inline:auto}
.topbar{position:sticky;top:0;z-index:20;background:rgba(8,20,15,.94);backdrop-filter:blur(18px);border-bottom:1px solid var(--line)}
.nav{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:24px}
.brand{display:flex;align-items:center;gap:12px;font-weight:800;letter-spacing:.02em}
.brandmark{display:grid;place-items:center;width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,#f0d9a6,#a98143);color:#15241b;font-weight:900;box-shadow:0 8px 24px #0004}
.brand small{display:block;color:var(--muted);font-size:.68rem;font-weight:600;letter-spacing:.12em;text-transform:uppercase}
.navlinks{display:flex;align-items:center;gap:14px;color:#e5e0d5;font-size:.88rem}
.navlinks a:hover,.footer a:hover{color:var(--gold2)}
.menu-toggle{display:none;background:transparent;color:var(--cream);border:1px solid var(--line);border-radius:12px;padding:8px 12px}
.hero{padding:70px 0 56px;overflow:hidden}
.hero-grid{display:grid;grid-template-columns:1.03fr .97fr;gap:48px;align-items:center}
.eyebrow{display:inline-flex;align-items:center;gap:9px;color:var(--gold2);font-size:.75rem;font-weight:800;letter-spacing:.19em;text-transform:uppercase}
.eyebrow:before{content:"";width:28px;height:1px;background:var(--gold)}
h1,h2,h3,p{margin-top:0}
h1{font-size:clamp(2.45rem,5vw,4.8rem);line-height:1.04;letter-spacing:-.055em;margin:18px 0 22px;max-width:760px}
.lead{color:#d0d6ce;font-size:1.12rem;max-width:640px}
.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
.btn{display:inline-flex;justify-content:center;align-items:center;gap:9px;border:1px solid var(--line);border-radius:999px;padding:12px 19px;font-weight:750;transition:transform .2s,background .2s}
.btn:hover{transform:translateY(-2px)}
.btn-primary{background:linear-gradient(135deg,#e7cc91,#bd9658);color:#15231b;border-color:transparent}
.btn-secondary{background:rgba(255,255,255,.035)}
:focus-visible{outline:3px solid var(--gold2);outline-offset:3px}
.hero-media{position:relative;min-height:400px;border-radius:30px;overflow:hidden;border:1px solid var(--line);box-shadow:var(--shadow)}
.hero-media img{width:100%;height:100%;min-height:400px;object-fit:cover;filter:saturate(.78)}
.hero-media:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 45%,rgba(6,17,12,.82))}
.image-note{position:absolute;z-index:1;bottom:22px;left:24px;right:24px;color:white}
.image-note strong{display:block;font-size:1.2rem}
.image-note span{color:#e4dfd4;font-size:.9rem}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:34px}
.stat{padding:17px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.025);min-width:0}
.stat strong{display:block;color:var(--gold2);font-size:1rem}
.stat span{color:var(--muted);font-size:.82rem}
.section{padding:64px 0}
.section-head{max-width:760px;margin-bottom:28px}
.section-head h2{font-size:clamp(1.8rem,3vw,2.7rem);line-height:1.15;letter-spacing:-.035em;margin:12px 0}
.section-head p{color:var(--muted)}
.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
.card{overflow:hidden;background:linear-gradient(145deg,rgba(25,47,37,.96),rgba(15,31,24,.96));border:1px solid var(--line);border-radius:var(--radius);transition:transform .25s,border-color .25s;min-width:0}
.card:hover{transform:translateY(-5px);border-color:rgba(240,217,166,.62)}
.card img{width:100%;height:190px;object-fit:cover;filter:saturate(.75)}
.card-body{padding:22px}
.card h3{font-size:1.2rem;margin:0 0 9px}
.card p{color:var(--muted);font-size:.94rem;margin-bottom:18px}
.text-link{display:inline-flex;align-items:center;gap:8px;color:var(--gold2);font-weight:800;font-size:.92rem}
.text-link:after{content:"↗"}
.feature-band{padding:34px;border:1px solid var(--line);border-radius:28px;background:linear-gradient(120deg,rgba(87,43,56,.38),rgba(215,183,122,.08)),var(--panel)}
.feature-band h2{font-size:clamp(1.65rem,3vw,2.35rem);margin-bottom:10px}
.feature-band p{color:var(--muted);max-width:760px}
.split{display:grid;grid-template-columns:.8fr 1.2fr;gap:32px;align-items:start}
.checklist{display:grid;gap:12px}
.check{display:flex;gap:13px;padding:17px;border-radius:16px;border:1px solid var(--line);background:rgba(255,255,255,.025)}
.checkmark{flex:0 0 30px;width:30px;height:30px;border-radius:10px;display:grid;place-items:center;background:rgba(215,183,122,.13);color:var(--gold2)}
.check strong{display:block;margin-bottom:3px}
.check p{margin:0;color:var(--muted);font-size:.92rem}
.carousel-track{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.slide{padding:22px;background:var(--panel);border:1px solid var(--line);border-radius:20px}
.slide p{color:var(--muted);margin-bottom:0}
.carousel-controls{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}
.circle-btn{width:42px;height:42px;border-radius:50%;border:1px solid var(--line);background:var(--panel);color:var(--gold2);cursor:pointer}
.faq-list{display:grid;gap:10px}
.faq-list details{background:rgba(255,255,255,.025);border:1px solid var(--line);border-radius:16px;padding:17px 20px}
.faq-list summary{font-weight:800;cursor:pointer}
.faq-list details p{margin:12px 0 0;color:var(--muted)}
.form-shell{display:grid;grid-template-columns:.8fr 1.2fr;gap:24px}
.form-aside,.form-panel{padding:28px;border:1px solid var(--line);border-radius:24px;background:var(--panel)}
.form-aside p{color:var(--muted)}
.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.field{display:grid;gap:7px;min-width:0}
.field.full{grid-column:1/-1}
.field label{font-weight:750;font-size:.9rem}
.field input,.field select,.field textarea{width:100%;min-width:0;border:1px solid rgba(215,183,122,.36);border-radius:12px;padding:12px 13px;background:#0b1913;color:var(--cream);outline:none}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--gold)}
.field textarea{min-height:120px;resize:vertical}
.hint{font-size:.82rem;color:var(--muted)}
.form-message{margin-top:14px;color:var(--gold2);overflow-wrap:anywhere}
.footer{padding:42px 0 26px;border-top:1px solid var(--line);background:rgba(4,12,8,.38)}
.footer-grid{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:28px}
.footer p,.footer li{color:var(--muted);font-size:.91rem}
.footer ul{list-style:none;padding:0;margin:10px 0;display:grid;gap:8px}
.footer h3{font-size:1rem}
.footer-bottom{display:flex;justify-content:space-between;gap:15px;flex-wrap:wrap;margin-top:30px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:.82rem}
.reveal{opacity:0;transform:translateY(18px);transition:opacity .65s ease,transform .65s ease}
.reveal.visible{opacity:1;transform:none}
.notice{padding:14px 16px;border-radius:14px;background:rgba(215,183,122,.09);border:1px solid var(--line);color:#e8ddc7;font-size:.9rem}
.breadcrumb{padding-top:22px;color:var(--muted);font-size:.86rem;overflow-wrap:anywhere}
.breadcrumb a{color:var(--gold2)}
.back-top{position:fixed;right:18px;bottom:18px;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:var(--gold);color:#17241b;box-shadow:var(--shadow);z-index:10;opacity:0;pointer-events:none;transition:opacity .2s;border:0}
.back-top.show{opacity:1;pointer-events:auto}
@media(max-width:1000px){.navlinks{gap:9px;font-size:.8rem}.hero-grid{gap:28px}}
@media(max-width:900px){.hero-grid,.split,.form-shell{grid-template-columns:1fr}.hero{padding-top:46px}.hero-media,.hero-media img{min-height:320px}.cards{grid-template-columns:repeat(2,minmax(0,1fr))}.carousel-track{grid-template-columns:1fr}.carousel-track .slide:not(:first-child){display:none}.footer-grid{grid-template-columns:1fr 1fr}.footer-grid>div:first-child{grid-column:1/-1}}
@media(max-width:640px){.wrap{width:min(calc(100% - 28px),1160px)}.nav{min-height:68px}.menu-toggle{display:block}.navlinks{display:none;position:absolute;top:68px;left:14px;right:14px;padding:16px;border:1px solid var(--line);border-radius:16px;background:#0d1d15;flex-direction:column;align-items:stretch;gap:4px;font-size:.95rem}.navlinks.open{display:flex}.navlinks a{padding:10px}.hero{padding:36px 0 28px}.hero-grid{gap:25px}h1{font-size:clamp(2.35rem,12vw,3.5rem)}.hero-media,.hero-media img{min-height:270px}.stats{gap:8px}.stat{padding:12px 9px}.stat span{font-size:.74rem}.section{padding:44px 0}.cards{grid-template-columns:1fr}.card img{height:200px}.feature-band{padding:24px}.form-aside,.form-panel{padding:20px}.form-grid{grid-template-columns:1fr}.field.full{grid-column:auto}.footer-grid{grid-template-columns:1fr}.footer-grid>div:first-child{grid-column:auto}.footer-bottom{display:block}.actions .btn{width:100%}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition:none!important;animation:none!important}.reveal{opacity:1;transform:none}}
"""

JS = r"""
(function(){
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const menu = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.navlinks');

  function closeMenu(returnFocus) {
    if (!menu || !nav) return;
    nav.classList.remove('open');
    menu.setAttribute('aria-expanded', 'false');
    if (returnFocus) menu.focus();
  }

  if (menu && nav) {
    menu.addEventListener('click', function () {
      const open = nav.classList.toggle('open');
      menu.setAttribute('aria-expanded', String(open));
    });

    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { closeMenu(false); });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeMenu(true);
    });

    document.addEventListener('click', function (event) {
      if (!nav.contains(event.target) && !menu.contains(event.target)) {
        closeMenu(false);
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 640) closeMenu(false);
    });
  }

  const revealElements = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reducedMotion.matches) {
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });

    revealElements.forEach(function (element) { observer.observe(element); });
  } else {
    revealElements.forEach(function (element) { element.classList.add('visible'); });
  }

  const backTop = document.querySelector('.back-top');
  if (backTop) {
    const updateBackTop = function () {
      backTop.classList.toggle('show', window.scrollY > 500);
    };
    window.addEventListener('scroll', updateBackTop, { passive: true });
    updateBackTop();
    backTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    });
  }

  const track = document.querySelector('.carousel-track');
  const previous = document.querySelector('[data-slide="prev"]');
  const next = document.querySelector('[data-slide="next"]');

  if (track && previous && next) {
    const slides = Array.from(track.children);
    let activeIndex = 0;

    function renderSlides() {
      const compact = window.matchMedia('(max-width: 900px)').matches;
      slides.forEach(function (slide, index) {
        slide.hidden = compact && index !== activeIndex;
      });
    }

    previous.addEventListener('click', function () {
      activeIndex = (activeIndex - 1 + slides.length) % slides.length;
      renderSlides();
    });

    next.addEventListener('click', function () {
      activeIndex = (activeIndex + 1) % slides.length;
      renderSlides();
    });

    window.addEventListener('resize', renderSlides);
    renderSlides();
  }

  const form = document.querySelector('#career-form');

  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!form.reportValidity()) return;

      const data = new FormData(form);
      const value = function (name, fallback) {
        const item = data.get(name);
        const text = String(item || '').trim();
        return text || fallback;
      };

      const subject = encodeURIComponent(
        'MedOrbits career enquiry - ' + value('interest', 'Career support')
      );

      const body = encodeURIComponent([
        'Career enquiry',
        '',
        'Name: ' + value('name', ''),
        'Email: ' + value('email', ''),
        'Phone: ' + value('phone', 'Not provided'),
        'Interest: ' + value('interest', ''),
        'Location: ' + value('location', 'Not provided'),
        'Message: ' + value('message', 'Not provided'),
        '',
        'Please review and reply to this enquiry.'
      ].join('\n'));

      const status = document.querySelector('.form-message');
      if (status) {
        status.textContent =
          'Your email application may open with a draft. Nothing has been sent or saved by this page.';
      }

      window.location.href =
        'mailto:careers@medorbits.in?subject=' + subject + '&body=' + body;
    });
  }

  const year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
})();
"""

SCAFFOLD_DIRS = (
    "scripts",
    "career",
    "career/assets",
    "career/assets/images",
    "career/data",
    "career/partials",
    "career/tests",
    "docs",
    "docs/career",
    "tests",
    "tests/career",
)

SCAFFOLD_FILES: dict[str, str | None] = {
    "career/README.md": """# MedOrbits Career Hub

Generated by `scripts/complete_medorbits_career.py`.

## Pages

- `index.html` -- career hub
- `fresher-jobs.html` -- fresher job-search guidance
- `work-from-home.html` -- remote-work guidance and safety
- `internships.html` -- internship preparation
- `apprenticeships.html` -- apprenticeship guidance
- `walk-in-interviews.html` -- walk-in interview preparation
- `application-form.html` -- career enquiry email-draft form
- `resume-guide.html` -- resume preparation
- `interview-preparation.html` -- interview preparation

## Important

The pages embed CSS and JavaScript and use remote Unsplash images.
Review image licensing, availability, privacy and performance before production.

The enquiry form uses `mailto:`. It does not securely submit or store information.
Connect a validated backend endpoint before using it for live submissions.

## Commands

```bash
python scripts/complete_medorbits_career.py --dry-run
python scripts/complete_medorbits_career.py
python scripts/complete_medorbits_career.py --validate-only
```
""",
    "docs/career/IMPLEMENTATION.md": """# Career Hub implementation

- Existing career pages are preserved by default.
- `--force` replaces the generated career HTML pages.
- `--force-support-files` replaces generator-owned support files.
- `--root PATH` specifies the repository root.
- `--dry-run` previews changes without writing files.
- `--validate-only` validates existing career pages.
- `--report-json PATH` writes a machine-readable run report.
- The script never deletes, commits, pushes or deploys files.
- Confirm canonical URLs, contact routing and sitemap inclusion.
- Connect the enquiry form to a secure backend before collecting enquiries.
""",
    "career/data/page-manifest.json": None,
    "career/tests/README.md": """# Career page checks

The generator performs basic HTML and local-link smoke checks. These checks are not a
replacement for a standards-compliant HTML validator or browser tests.

Suggested CI checks:
- expected pages exist;
- titles, descriptions and landmarks are present;
- local links resolve;
- images have alt attributes;
- form disclosure is visible;
- mobile navigation works;
- reduced-motion preferences are respected.
""",
    "tests/career/README.md": """# Career hub tests

Suggested automated checks:
- all configured pages exist;
- each page has a title, description, h1, main and footer;
- local links resolve;
- images include alt attributes;
- the demo form clearly discloses its mail-draft-only behaviour;
- mobile navigation and reduced-motion behaviour work in a browser.
""",
    "career/assets/images/README.md": """# Career images

Reserved for locally hosted, licensed images. The current pages use remote Unsplash URLs.
Update `PHOTO_IDS` and `photo_url()` before migrating to local assets.
""",
    "career/assets/README.md": """# Career assets

The generated pages currently embed CSS and JavaScript. This folder is reserved for future
local assets or a later shared-asset refactor.
""",
    "career/partials/README.md": """# Career partials

Reserved for reusable templates if these pages are later refactored to use a template system.
The current generator produces standalone HTML documents.
""",
}


def esc(value: object) -> str:
    """Escape content before placing it into HTML."""
    return html.escape(str(value), quote=True)


def photo_url(key: str) -> str:
    """Return a stable Unsplash image URL from an allowlisted photo key."""
    if key not in PHOTO_IDS:
        raise ValueError(f"Unknown photo key: {key!r}")
    return f"https://images.unsplash.com/{PHOTO_IDS[key]}?auto=format&fit=crop&w=1200&q=82"


def nav_html() -> str:
    links = (
        ("Career Hub", "index.html"),
        ("Fresher Jobs", "fresher-jobs.html"),
        ("Remote Work", "work-from-home.html"),
        ("Internships", "internships.html"),
        ("Apprenticeships", "apprenticeships.html"),
        ("Walk-In Interviews", "walk-in-interviews.html"),
    )
    items = "".join(
        f'<a href="{esc(href)}">{esc(label)}</a>' for label, href in links
    )
    return (
        '<nav class="nav wrap" aria-label="Main navigation">'
        '<a class="brand" href="../index.html" aria-label="MedOrbits home">'
        '<span class="brandmark" aria-hidden="true">M</span>'
        '<span>MedOrbits<small>Education · Admissions · Careers</small></span></a>'
        '<button class="menu-toggle" type="button" aria-expanded="false" '
        'aria-controls="primary-nav">Menu</button>'
        f'<div class="navlinks" id="primary-nav">{items}'
        '<a class="btn btn-primary" href="application-form.html">Get career support</a>'
        '</div></nav>'
    )


def render_cards(cards: list[tuple[str, str, str, str]]) -> str:
    rendered: list[str] = []
    for title, description, href, image in cards:
        rendered.append(
            '<article class="card reveal">'
            f'<img loading="lazy" decoding="async" src="{esc(photo_url(image))}" '
            f'alt="{esc(title)}" width="800" height="500">'
            f'<div class="card-body"><h3>{esc(title)}</h3>'
            f'<p>{esc(description)}</p>'
            f'<a class="text-link" href="{esc(href)}">Explore guide</a>'
            '</div></article>'
        )
    return '<div class="cards">' + ''.join(rendered) + '</div>'


def render_form_section() -> str:
    return f"""
<section class="section" id="enquiry">
  <div class="wrap form-shell">
    <aside class="form-aside reveal">
      <span class="eyebrow">CAREER ENQUIRY</span>
      <h2>Share your next step.</h2>
      <p>This demo form opens a draft email in your email application. It does not send automatically or save data to a server.</p>
      <div class="notice">Safety note: do not enter passwords, OTPs, banking credentials or unnecessary identity-document numbers.</div>
      <p style="margin-top:18px">Email: <a class="text-link" href="mailto:{esc(CAREERS_EMAIL)}">{esc(CAREERS_EMAIL)}</a></p>
    </aside>
    <div class="form-panel reveal">
      <form id="career-form">
        <div class="form-grid">
          <div class="field">
            <label for="name">Full name *</label>
            <input id="name" name="name" autocomplete="name" required maxlength="100">
          </div>
          <div class="field">
            <label for="email">Email address *</label>
            <input id="email" name="email" type="email" autocomplete="email" required maxlength="160">
          </div>
          <div class="field">
            <label for="phone">Phone (optional)</label>
            <input id="phone" name="phone" type="tel" autocomplete="tel" maxlength="30">
          </div>
          <div class="field">
            <label for="interest">I am interested in *</label>
            <select id="interest" name="interest" required>
              <option value="">Choose an area</option>
              <option>Fresher jobs</option>
              <option>Work from home</option>
              <option>Internships</option>
              <option>Apprenticeships</option>
              <option>Interview preparation</option>
              <option>Resume guidance</option>
              <option>Recruitment services</option>
              <option>Other career support</option>
            </select>
          </div>
          <div class="field full">
            <label for="location">Preferred location (optional)</label>
            <input id="location" name="location" maxlength="120" placeholder="City, state or remote">
          </div>
          <div class="field full">
            <label for="message">Tell us about your goal *</label>
            <textarea id="message" name="message" required maxlength="2000" placeholder="Mention your qualification, target role and the support you need."></textarea>
            <span class="hint">Keep the message focused and do not include sensitive credentials.</span>
          </div>
          <div class="field full">
            <button class="btn btn-primary" type="submit">Prepare email enquiry ↗</button>
            <p class="form-message" role="status" aria-live="polite"></p>
          </div>
        </div>
      </form>
    </div>
  </div>
</section>
"""


def render_page(filename: str, data: dict[str, Any]) -> str:
    title = data["title"]
    description = data["description"]
    canonical = f"{SITE_URL}/career/{filename}"
    breadcrumb = title.split("|", 1)[0].strip()

    stats_html = ''.join(
        f'<div class="stat"><strong>{esc(value)}</strong><span>{esc(label)}</span></div>'
        for value, label in data["stats"]
    )

    sections_html: list[str] = []
    for index, (heading, intro, cards) in enumerate(data["sections"]):
        section_id = (
            "opportunities"
            if filename == "index.html" and index == 0
            else f"section-{index + 1}"
        )
        eyebrow = "EXPLORE" if index == 0 else "YOUR NEXT STEP"
        sections_html.append(
            f'<section class="section" id="{section_id}"><div class="wrap">'
            f'<div class="section-head reveal"><span class="eyebrow">{eyebrow}</span>'
            f'<h2>{esc(heading)}</h2><p>{esc(intro)}</p></div>'
            f'{render_cards(cards)}</div></section>'
        )

    faq_html = ''.join(
        f'<details class="reveal"><summary>{esc(question)}</summary>'
        f'<p>{esc(answer)}</p></details>'
        for question, answer in data["faqs"]
    )

    notes = (
        ("Be specific", "Match your application to the role and explain your relevant skills clearly."),
        ("Verify details", "Check employer identity, job terms and official application channels."),
        ("Keep records", "Save the job description, submission date and any reference number."),
    )
    notes_html = ''.join(
        f'<article class="slide"><span class="eyebrow">CAREER NOTE 0{i + 1}</span>'
        f'<h3>{esc(heading)}</h3><p>{esc(copy)}</p></article>'
        for i, (heading, copy) in enumerate(notes)
    )

    form_html = render_form_section() if filename == "application-form.html" else ""

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#102c23">
<meta name="description" content="{esc(description)}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="{esc(canonical)}">
<title>{esc(title)}</title>
<style>{CSS}</style>
</head>
<body>
<header class="topbar">{nav_html()}</header>
<main id="main-content">
<div class="wrap breadcrumb"><a href="../index.html">Home</a> / <a href="index.html">Career Hub</a> / <span>{esc(breadcrumb)}</span></div>
<section class="hero">
  <div class="wrap hero-grid">
    <div class="reveal">
      <span class="eyebrow">{esc(data["eyebrow"])}</span>
      <h1>{esc(data["heading"])}</h1>
      <p class="lead">{esc(data["intro"])}</p>
      <div class="actions">
        <a class="btn btn-primary" href="{esc(data["primary"][1])}">{esc(data["primary"][0])} ↗</a>
        <a class="btn btn-secondary" href="{esc(data["secondary"][1])}">{esc(data["secondary"][0])}</a>
      </div>
      <div class="stats">{stats_html}</div>
    </div>
    <div class="hero-media reveal">
      <img src="{esc(photo_url(data["image"]))}" alt="Career planning and professional development" fetchpriority="high" decoding="async" width="1200" height="900">
      <div class="image-note"><strong>Move forward with a plan.</strong><span>Useful resources. Clear steps. Safer decisions.</span></div>
    </div>
  </div>
</section>
{''.join(sections_html)}
{form_html}
<section class="section">
  <div class="wrap split">
    <div class="section-head reveal">
      <span class="eyebrow">A SMARTER SEARCH</span>
      <h2>Small steps make progress visible.</h2>
      <p>Use a consistent process, verify details and keep your applications organised.</p>
      <a class="btn btn-primary" href="application-form.html">Plan your next step</a>
    </div>
    <div class="checklist">
      <div class="check reveal"><span class="checkmark" aria-hidden="true">✓</span><div><strong>Confirm the opportunity</strong><p>Check the job description, employer identity, eligibility and application route.</p></div></div>
      <div class="check reveal"><span class="checkmark" aria-hidden="true">✓</span><div><strong>Present accurate information</strong><p>Keep your resume, qualifications and examples truthful and up to date.</p></div></div>
      <div class="check reveal"><span class="checkmark" aria-hidden="true">✓</span><div><strong>Protect your privacy</strong><p>Share only necessary information through verified, secure channels.</p></div></div>
    </div>
  </div>
</section>
<section class="section">
  <div class="wrap">
    <div class="section-head reveal"><span class="eyebrow">CAREER NOTES</span><h2>Keep the fundamentals in focus.</h2><p>Practical reminders to use while exploring opportunities.</p></div>
    <div class="carousel">
      <div class="carousel-track">{notes_html}</div>
      <div class="carousel-controls">
        <button class="circle-btn" type="button" data-slide="prev" aria-label="Previous career note">←</button>
        <button class="circle-btn" type="button" data-slide="next" aria-label="Next career note">→</button>
      </div>
    </div>
  </div>
</section>
<section class="section">
  <div class="wrap">
    <div class="section-head reveal"><span class="eyebrow">COMMON QUESTIONS</span><h2>Before you take the next step</h2></div>
    <div class="faq-list">{faq_html}</div>
  </div>
</section>
<section class="section">
  <div class="wrap">
    <div class="feature-band reveal">
      <span class="eyebrow">MEDORBITS CAREER HUB</span>
      <h2>Make your next move a considered one.</h2>
      <p>Explore the guides, verify every opportunity and prepare an application that reflects your real skills and goals.</p>
      <div class="actions">
        <a class="btn btn-primary" href="application-form.html">Contact career support ↗</a>
        <a class="btn btn-secondary" href="index.html">Back to career hub</a>
      </div>
    </div>
  </div>
</section>
</main>
<footer class="footer">
  <div class="wrap">
    <div class="footer-grid">
      <div><a class="brand" href="../index.html"><span class="brandmark" aria-hidden="true">M</span><span>MedOrbits<small>Education · Admissions · Careers</small></span></a><p>Career resources and practical guidance to help you make informed next steps.</p></div>
      <div><h3>Career resources</h3><ul><li><a href="fresher-jobs.html">Fresher jobs</a></li><li><a href="work-from-home.html">Work from home</a></li><li><a href="internships.html">Internships</a></li><li><a href="apprenticeships.html">Apprenticeships</a></li></ul></div>
      <div><h3>Support and preparation</h3><ul><li><a href="walk-in-interviews.html">Walk-in interviews</a></li><li><a href="resume-guide.html">Resume guide</a></li><li><a href="interview-preparation.html">Interview preparation</a></li><li><a href="application-form.html">Career enquiry</a></li><li><a href="../contact.html">Contact MedOrbits</a></li></ul></div>
    </div>
    <div class="footer-bottom"><span>© <span data-year></span> MedOrbits. All rights reserved.</span><span>Verify vacancies with the employer before applying.</span></div>
  </div>
</footer>
<button class="back-top" type="button" aria-label="Back to top">↑</button>
<script>{JS}</script>
</body>
</html>
"""


def display_path(path: Path, root: Path) -> str:
    try:
        return path.resolve().relative_to(root.resolve()).as_posix()
    except ValueError:
        return str(path)


def find_repo_root(start: Path) -> Path:
    """Locate a plausible root, preferring the nearest Git or package marker."""
    start = start.resolve()
    for candidate in (start, *start.parents):
        if (candidate / ".git").exists() or (candidate / "package.json").is_file():
            return candidate
    if start.name == "scripts":
        return start.parent
    return start


def atomic_write(path: Path, content: str) -> None:
    """Write UTF-8 text atomically without leaving partial target files."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=str(path.parent),
    )
    temp_path = Path(temp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_path, path)
    except Exception:
        try:
            temp_path.unlink(missing_ok=True)
        except OSError:
            pass
        raise


def validate_html(
    path: Path,
    root: Path,
    *,
    check_parent_links: bool = False,
) -> list[str]:
    """
    Run dependency-free smoke checks.

    This is not a replacement for a standards-compliant HTML validator.
    """
    label = display_path(path, root)
    issues: list[str] = []

    try:
        content = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        return [f"{label}: cannot read file: {exc}"]

    lower = content.lower()
    required = (
        "<!doctype html>",
        "<html",
        "<head>",
        "<body",
        "</html>",
        "<title>",
        'name="description"',
        "<main",
        "</main>",
        "<footer",
    )
    for token in required:
        if token not in lower:
            issues.append(f"{label}: missing required markup {token!r}")

    if len(re.findall(r"<section\b", content, re.I)) != len(
        re.findall(r"</section\s*>", content, re.I)
    ):
        issues.append(f"{label}: section tag counts do not match")

    if re.search(r"<img\b(?![^>]*\balt\s*=)", content, re.I):
        issues.append(f"{label}: at least one img element has no alt attribute")

    if not re.search(r"<h1\b", content, re.I):
        issues.append(f"{label}: missing h1 heading")

    if not re.search(r'<html\b[^>]*\blang=["\'][^"\']+["\']', content, re.I):
        issues.append(f"{label}: missing html lang attribute")

    title_match = re.search(r"<title\b[^>]*>(.*?)</title\s*>", content, re.I | re.S)
    if not title_match or not html.unescape(re.sub(r"<[^>]+>", "", title_match.group(1))).strip():
        issues.append(f"{label}: title is empty")

    description_match = re.search(
        r'<meta\b[^>]*\bname=["\']description["\'][^>]*\bcontent=["\']([^"\']*)["\']',
        content,
        re.I,
    )
    if not description_match or not description_match.group(1).strip():
        issues.append(f"{label}: meta description is empty or malformed")

    ids = re.findall(r'\bid=["\']([^"\']+)["\']', content, re.I)
    for identifier, count in Counter(ids).items():
        if count > 1:
            issues.append(f"{label}: duplicate id {identifier!r} occurs {count} times")

    for attribute, raw_value in re.findall(
        r'\b(href|src)=["\']([^"\']*)["\']',
        content,
        re.I,
    ):
        value = html.unescape(raw_value.strip())
        if not value:
            issues.append(f"{label}: empty {attribute} attribute")
            continue

        parsed = urlsplit(value)
        scheme = parsed.scheme.lower()

        if scheme in {"javascript", "vbscript"}:
            issues.append(f"{label}: unsafe {attribute} scheme in {value!r}")
            continue

        if scheme or parsed.netloc or value.startswith("//"):
            continue

        if not parsed.path:
            continue

        target = (path.parent / parsed.path).resolve()
        try:
            target.relative_to(root.resolve())
        except ValueError:
            issues.append(f"{label}: local path escapes repository: {value!r}")
            continue

        if not target.exists():
            # Root-level links belong to the surrounding website and are optional
            # unless the caller explicitly asks to check those dependencies.
            if parsed.path.startswith("../") and not check_parent_links:
                continue
            issues.append(f"{label}: missing local {attribute} target: {value!r}")
        elif target.is_dir() and not (target / "index.html").is_file():
            issues.append(f"{label}: directory target has no index.html: {value!r}")

    if path.name == "application-form.html":
        if 'id="career-form"' not in content:
            issues.append(f"{label}: application form element is missing")
        if "mailto:" not in content:
            issues.append(f"{label}: form does not disclose or implement its mail-draft behaviour")
        if "does not" not in content.lower() or "server" not in content.lower():
            issues.append(f"{label}: form should disclose that it is not a server-side submission")

    return issues


def manifest_content() -> str:
    manifest = {
        "site": SITE_NAME,
        "siteUrl": SITE_URL,
        "careerDirectory": "/career/",
        "pages": list(PAGE_NAMES),
        "styles": "embedded",
        "scripts": "embedded",
        "formMode": "mailto-draft-only",
        "generatedBy": GENERATOR_PATH,
        "generatorVersion": GENERATOR_VERSION,
    }
    return json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"


def safe_report_path(raw_path: Path, root: Path) -> Path:
    """Resolve a report path; reject directory traversal outside the chosen root."""
    destination = raw_path if raw_path.is_absolute() else root / raw_path
    destination = destination.resolve()
    try:
        destination.relative_to(root.resolve())
    except ValueError as exc:
        raise ValueError("JSON report path must be inside the repository root") from exc
    return destination


def ensure_scaffold(
    root: Path,
    *,
    dry_run: bool,
    force_support_files: bool,
) -> tuple[list[str], list[dict[str, str]]]:
    created_dirs: list[str] = []
    actions: list[dict[str, str]] = []

    for relative in SCAFFOLD_DIRS:
        directory = root / relative
        if directory.exists() and not directory.is_dir():
            raise NotADirectoryError(f"Expected a directory but found a file: {directory}")
        if not directory.exists():
            created_dirs.append(relative)
            if not dry_run:
                directory.mkdir(parents=True, exist_ok=True)

    support: dict[str, str] = {}
    for relative, content in SCAFFOLD_FILES.items():
        support[relative] = manifest_content() if content is None else content

    keep_paths = (
        "career/assets/images/.gitkeep",
        "career/data/.gitkeep",
        "career/partials/.gitkeep",
        "career/tests/.gitkeep",
        "tests/career/.gitkeep",
    )

    for relative in keep_paths:
        target = root / relative
        action = "preserved" if target.exists() else ("would_write" if dry_run else "written")
        actions.append({"path": relative, "action": action})
        if not dry_run and not target.exists():
            atomic_write(target, "")

    for relative, content in support.items():
        target = root / relative
        if target.exists() and not force_support_files:
            action = "preserved"
        else:
            action = "would_write" if dry_run else "written"
        actions.append({"path": relative, "action": action})
        if not dry_run and action == "written":
            atomic_write(target, content)

    return created_dirs, actions


def write_report(path: Path, payload: dict[str, Any]) -> None:
    atomic_write(path, json.dumps(payload, ensure_ascii=False, indent=2) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate and validate MedOrbits career pages."
    )
    parser.add_argument("--root", type=Path, help="Repository root; auto-detected by default.")
    parser.add_argument("--force", action="store_true", help="Overwrite existing generated career pages.")
    parser.add_argument(
        "--force-support-files",
        action="store_true",
        help="Also overwrite generator-owned READMEs and page manifest.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview planned changes without writing.")
    parser.add_argument("--validate-only", action="store_true", help="Validate existing pages without generating.")
    parser.add_argument(
        "--check-parent-links",
        action="store_true",
        help="Also report missing parent/root-level links such as ../contact.html.",
    )
    parser.add_argument(
        "--report-json",
        type=Path,
        help="Write a JSON report inside the repository root (not written during dry-run).",
    )
    args = parser.parse_args()

    if args.dry_run and args.validate_only:
        parser.error("--dry-run and --validate-only cannot be used together")

    script_dir = Path(__file__).resolve().parent
    root = args.root.resolve() if args.root else find_repo_root(script_dir)
    career_dir = root / "career"

    if args.validate_only:
        if not career_dir.is_dir():
            print(f"ERROR: career directory not found: {career_dir}", file=sys.stderr)
            return 1

        targets = [career_dir / name for name in PAGE_NAMES if (career_dir / name).is_file()]
        if not targets:
            print("ERROR: none of the configured career pages exists.", file=sys.stderr)
            return 1

        issues = [
            issue
            for target in targets
            for issue in validate_html(
                target,
                root,
                check_parent_links=args.check_parent_links,
            )
        ]
        report = {
            "generatorVersion": GENERATOR_VERSION,
            "mode": "validate-only",
            "root": str(root),
            "pagesChecked": len(targets),
            "issues": issues,
            "success": not issues,
        }

        if args.report_json:
            try:
                report_path = safe_report_path(args.report_json, root)
                write_report(report_path, report)
                print(f"JSON report: {display_path(report_path, root)}")
            except (OSError, ValueError) as exc:
                print(f"ERROR: unable to write report: {exc}", file=sys.stderr)
                return 2

        if issues:
            print("\n".join(f"ERROR: {issue}" for issue in issues))
            return 1

        print(f"Validation passed for {len(targets)} existing career pages.")
        return 0

    print(f"Repository root: {root}")
    print(f"Career directory: {career_dir}")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'WRITE'}")

    if not args.dry_run:
        try:
            root.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            print(f"ERROR: cannot prepare repository root: {exc}", file=sys.stderr)
            return 2

    try:
        directories, support_actions = ensure_scaffold(
            root,
            dry_run=args.dry_run,
            force_support_files=args.force_support_files,
        )
    except (OSError, NotADirectoryError) as exc:
        print(f"ERROR: scaffold setup failed: {exc}", file=sys.stderr)
        return 2

    print("\nDirectories:")
    if directories:
        for relative in directories:
            print(f"  {'WOULD CREATE' if args.dry_run else 'CREATED'} {relative}/")
    else:
        print("  All configured directories already exist.")

    print("\nSupport files:")
    for item in support_actions:
        print(f"  {item['action'].upper():12} {item['path']}")

    created: list[str] = []
    overwritten: list[str] = []
    preserved: list[str] = []
    planned: list[str] = []
    write_errors: list[str] = []

    for filename, data in PAGES.items():
        target = career_dir / filename
        existed = target.exists()

        if existed and not args.force:
            preserved.append(filename)
            print(f"  PRESERVED    career/{filename}")
            continue

        if args.dry_run:
            planned.append(filename)
            print(f"  {'WOULD REPLACE' if existed else 'WOULD CREATE'} career/{filename}")
            continue

        try:
            atomic_write(target, render_page(filename, data))
        except (OSError, ValueError) as exc:
            message = f"career/{filename}: {exc}"
            write_errors.append(message)
            print(f"  ERROR        {message}", file=sys.stderr)
            continue

        if existed:
            overwritten.append(filename)
            print(f"  OVERWROTE    career/{filename}")
        else:
            created.append(filename)
            print(f"  CREATED      career/{filename}")

    if args.dry_run:
        report = {
            "generatorVersion": GENERATOR_VERSION,
            "mode": "dry-run",
            "root": str(root),
            "pagesConfigured": len(PAGES),
            "pagesPlanned": planned,
            "pagesPreserved": preserved,
            "directoriesPlanned": directories,
            "supportFiles": support_actions,
            "success": True,
        }
        if args.report_json:
            print("JSON report not written: --dry-run prevents filesystem writes.")
        print(
            f"\nDry run complete: {len(planned)} pages planned, "
            f"{len(preserved)} existing pages preserved."
        )
        print("No files were written.")
        return 0

    targets = [career_dir / name for name in PAGE_NAMES if (career_dir / name).is_file()]
    validation_issues = [
        issue
        for target in targets
        for issue in validate_html(
            target,
            root,
            check_parent_links=args.check_parent_links,
        )
    ]
    issues = write_errors + validation_issues

    print("\nSummary:")
    print(f"  Created: {len(created)}")
    print(f"  Overwritten: {len(overwritten)}")
    print(f"  Preserved: {len(preserved)}")
    print(f"  Pages validated: {len(targets)}")

    if validation_issues:
        print("\nValidation findings:")
        for issue in validation_issues:
            print(f"  ERROR: {issue}")
        if not args.check_parent_links:
            print("Tip: use --check-parent-links to check root-level links such as ../contact.html.")

    if write_errors:
        print("\nWrite errors:")
        for issue in write_errors:
            print(f"  ERROR: {issue}")

    report = {
        "generatorVersion": GENERATOR_VERSION,
        "mode": "write",
        "root": str(root),
        "pagesConfigured": len(PAGES),
        "pagesCreated": created,
        "pagesOverwritten": overwritten,
        "pagesPreserved": preserved,
        "pagesChecked": len(targets),
        "directoriesCreated": directories,
        "supportFiles": support_actions,
        "issues": issues,
        "success": not issues,
    }

    if args.report_json:
        try:
            report_path = safe_report_path(args.report_json, root)
            write_report(report_path, report)
            print(f"\nJSON report written: {display_path(report_path, root)}")
        except (OSError, ValueError) as exc:
            print(f"ERROR: unable to write JSON report: {exc}", file=sys.stderr)
            return 2

    if issues:
        print("\nGeneration finished with errors. Review the findings above.")
        return 1

    print(f"\nValidation passed for {len(targets)} career pages.")
    print("The enquiry form only prepares an email draft; it does not submit data to a server.")
    print("Before deployment, verify contact routing, canonical URLs, images and sitemap inclusion.")
    print("No files were deleted, committed, pushed or deployed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
