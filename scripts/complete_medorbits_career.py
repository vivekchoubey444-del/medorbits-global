#!/usr/bin/env python3
"""
MedOrbits Career Pages Builder
==============================

Place this file at:
    scripts/complete_medorbits_career.py

Run from the repository root:
    python scripts/complete_medorbits_career.py
    python scripts/complete_medorbits_career.py --dry-run
    python scripts/complete_medorbits_career.py --force

What it does:
- Creates a set of useful MedOrbits career pages under /career/.
- Uses a self-contained premium dark-green, champagne-gold and burgundy design.
- Does NOT require /assets/css/career.css or /assets/js/career.js.
- Keeps existing pages unchanged unless --force is supplied.
- Adds page-specific titles, copy, FAQs, cards and related imagery.
- Adds local navigation between generated pages and the MedOrbits home page.
- Checks generated HTML for basic structure and local-link targets.

Images use remote Unsplash Source URLs. Replace them with locally hosted, licensed images
before production if your deployment policy requires local assets.

This script intentionally does not deploy, push, or commit changes.
"""

from __future__ import annotations

import argparse
import html
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

SITE_NAME = "MedOrbits"
SITE_URL = "https://www.medorbits.in"
THEME_COLOR = "#102c23"

PAGES = {
    "index.html": {
        "title": "MedOrbits Career Hub | Jobs, Internships & Career Support",
        "description": "Explore jobs, internships, apprenticeships, work-from-home opportunities, interview resources and career support with MedOrbits.",
        "eyebrow": "CAREER HUB",
        "heading": "Build your next chapter with confidence.",
        "intro": "Explore opportunities, prepare for interviews and take practical steps toward your next career move with MedOrbits.",
        "image": "photo-1521737711867-e3b97375f902",
        "primary": ("Explore opportunities", "#opportunities"),
        "secondary": ("Career application form", "application-form.html"),
        "stats": [("Career paths", "Explore"), ("Practical guidance", "Prepare"), ("Next step", "Start today")],
        "sections": [
            ("Find your next opportunity", "Browse career resources by the kind of opportunity you are looking for.", [
                ("Fresher jobs", "Entry-level opportunities and a practical starting point for new graduates.", "fresher-jobs.html", "photo-1521791136064-7986c2920216"),
                ("Work from home", "Explore remote-work roles and learn how to assess a listing carefully.", "work-from-home.html", "photo- remote"),
                ("Internships", "Build practical experience and strengthen your early-career profile.", "internships.html", "photo-1523240795612-9a054b0db644"),
                ("Apprenticeships", "Learn about structured workplace training and skill development.", "apprenticeships.html", "photo-1522071820081-009f0129c71c"),
                ("Walk-in interviews", "Prepare your documents and plan for employer walk-in drives.", "walk-in-interviews.html", "photo-1521737711867-e3b97375f902"),
                ("Application form", "Organise your details and submit a career-support enquiry.", "application-form.html", "photo-1454165804606-c3d57bc86b40"),
            ]),
            ("Make your application stronger", "A focused application is easier to review and helps you communicate your strengths clearly.", [
                ("Resume readiness", "Keep your resume accurate, concise and tailored to each role.", "application-form.html", "photo-1454165804606-c3d57bc86b40"),
                ("Interview preparation", "Practise concise examples that show your skills, learning and judgement.", "walk-in-interviews.html", "photo-1521737711867-e3b97375f902"),
                ("Opportunity checks", "Verify employer details, role requirements, location and any fees before applying.", "fresher-jobs.html", "photo-1552664730-d307ca884978"),
            ]),
        ],
        "faqs": [
            ("Does MedOrbits guarantee a job?", "No. Career resources and guidance can support your search, but selection depends on employers and individual eligibility."),
            ("Should I pay an employer to get hired?", "Be cautious of requests for upfront fees, deposits or guaranteed-placement payments. Verify the organisation independently before sharing money or sensitive documents."),
            ("What should I prepare before applying?", "Prepare an updated resume, accurate education and experience details, relevant certificates and a professional email address."),
        ],
    },
    "fresher-jobs.html": {
        "title": "Fresher Jobs | MedOrbits Career Hub",
        "description": "Explore entry-level job search guidance, application preparation and practical checks for fresher opportunities.",
        "eyebrow": "EARLY CAREER",
        "heading": "Start strong. Learn fast. Grow with purpose.",
        "intro": "Use this guide to organise your job search, identify realistic entry-level roles and prepare applications that clearly communicate your strengths.",
        "image": "photo-1521791136064-7986c2920216",
        "primary": ("Prepare an application", "application-form.html"),
        "secondary": ("Explore internships", "internships.html"),
        "stats": [("Resume", "Tailored"), ("Skills", "Demonstrated"), ("Claims", "Verified")],
        "sections": [
            ("A practical fresher job-search plan", "Use a repeatable process rather than applying randomly.", [
                ("Choose target roles", "List roles that match your qualification, location, skills and willingness to learn.", "application-form.html", "photo-1454165804606-c3d57bc86b40"),
                ("Build a focused resume", "Lead with education, projects, internships, certifications and demonstrable skills.", "application-form.html", "photo-1455390582262-044cdead277a"),
                ("Track each application", "Record the employer, role, date, contact, status and next follow-up.", "application-form.html", "photo-1552664730-d307ca884978"),
            ]),
            ("Entry-level areas to explore", "Availability and eligibility vary by employer and location; treat these as search categories, not current vacancies.", [
                ("Operations & administration", "Look for coordinator, operations assistant and office-support roles.", "application-form.html", "photo-1521737711867-e3b97375f902"),
                ("Customer support", "Review communication requirements, shift timings and language expectations.", "work-from-home.html", "photo-1553877522-43269d4ea984"),
                ("Technology & digital", "Show projects, portfolio links, practical skills and learning evidence.", "internships.html", "photo-1516321318423-f06f85e504b3"),
            ]),
        ],
        "faqs": [
            ("Can I apply without work experience?", "Yes, where the role accepts freshers. Highlight relevant projects, coursework, volunteering, certifications and transferable skills."),
            ("Are the roles listed here live vacancies?", "This page provides career-search guidance. Confirm that a vacancy is active on the employer's official careers website."),
            ("How do I avoid fake job offers?", "Verify the employer domain and contact details, be wary of guaranteed-selection claims and never share OTPs, banking passwords or unnecessary identity documents."),
        ],
    },
    "work-from-home.html": {
        "title": "Work From Home Opportunities | MedOrbits",
        "description": "Learn how to search for remote work, evaluate work-from-home listings and prepare for remote applications.",
        "eyebrow": "REMOTE WORK",
        "heading": "Find remote work with a clear, careful plan.",
        "intro": "Explore remote-work categories, prepare for online interviews and check the legitimacy of a listing before sharing personal information.",
        "image": "photo- remote",
        "primary": ("Start an application", "application-form.html"),
        "secondary": ("Explore fresher jobs", "fresher-jobs.html"),
        "stats": [("Role fit", "First"), ("Employer", "Verified"), ("Fees", "Questioned")],
        "sections": [
            ("Remote-work categories", "The actual tasks, pay, hours and eligibility depend on each employer.", [
                ("Customer support", "Check shift patterns, language needs, equipment requirements and training.", "application-form.html", "photo-1553877522-43269d4ea984"),
                ("Writing & content", "Prepare writing samples and confirm ownership, deadlines and revision expectations.", "application-form.html", "photo-1455390582262-044cdead277a"),
                ("Digital & technical", "Show projects, practical skills and a portfolio where relevant.", "internships.html", "photo-1516321318423-f06f85e504b3"),
                ("Virtual administration", "Review calendar, document, communication and confidentiality requirements.", "application-form.html", "photo-1454165804606-c3d57bc86b40"),
            ]),
            ("Remote-job safety checklist", "Pause and verify before proceeding if a listing feels rushed or unclear.", [
                ("Verify the employer", "Check the official website, company email domain and independently sourced contact information.", "fresher-jobs.html", "photo-1552664730-d307ca884978"),
                ("Reject pay-to-work pressure", "Treat registration, training-kit, security-deposit or guaranteed-job fees as warning signs.", "application-form.html", "photo-1521737711867-e3b97375f902"),
                ("Protect your information", "Never disclose OTPs, passwords or full payment-card credentials to a recruiter.", "application-form.html", "photo-1516321318423-f06f85e504b3"),
            ]),
        ],
        "faqs": [
            ("Does work from home always mean flexible hours?", "No. Remote roles may have fixed shifts, attendance rules, targets and location restrictions."),
            ("Should I pay a fee to receive remote work?", "Be highly cautious. Verify any fee independently and do not pay for a promise of guaranteed employment."),
            ("How can I check if a remote job is genuine?", "Cross-check the vacancy on the employer's official careers page and contact the company using independently verified details."),
        ],
    },
    "internships.html": {
        "title": "Internships & Practical Experience | MedOrbits",
        "description": "Explore internship-search guidance, application preparation and ways to build practical experience.",
        "eyebrow": "PRACTICAL EXPERIENCE",
        "heading": "Turn what you learn into work you can show.",
        "intro": "A well-chosen internship can help you practise skills, understand a workplace and build evidence for future applications.",
        "image": "photo-1523240795612-9a054b0db644",
        "primary": ("Prepare your application", "application-form.html"),
        "secondary": ("Explore apprenticeships", "apprenticeships.html"),
        "stats": [("Learning goals", "Defined"), ("Mentorship", "Clarified"), ("Work samples", "Documented")],
        "sections": [
            ("Choose an internship carefully", "Look for a clear learning plan and realistic responsibilities.", [
                ("Match your interests", "Choose a field where you can build relevant, transferable skills.", "application-form.html", "photo-1516321318423-f06f85e504b3"),
                ("Check the learning plan", "Clarify supervision, duration, work hours, stipend and expected deliverables.", "application-form.html", "photo-1521737711867-e3b97375f902"),
                ("Prepare examples", "Use projects, coursework, volunteering and personal work to show your abilities.", "fresher-jobs.html", "photo-1455390582262-044cdead277a"),
            ]),
            ("Before you accept", "Make sure expectations are written down and understandable.", [
                ("Confirm the terms", "Request written details about duties, duration, location, compensation and reporting.", "application-form.html", "photo-1454165804606-c3d57bc86b40"),
                ("Protect your work", "Understand confidentiality, ownership and portfolio-use rules before sharing work.", "application-form.html", "photo-1552664730-d307ca884978"),
                ("Set a learning target", "Define what you want to practise and how progress will be reviewed.", "apprenticeships.html", "photo-1522071820081-009f0129c71c"),
            ]),
        ],
        "faqs": [
            ("Are all internships paid?", "No. Terms differ. Confirm compensation, expenses, hours and learning outcomes before accepting."),
            ("Can an internship guarantee a permanent job?", "Not usually. Ask whether conversion is possible, but treat any guarantee cautiously and get terms in writing."),
            ("What if I have no previous experience?", "Use academic projects, volunteering, self-directed work and relevant coursework to demonstrate your interest and skills."),
        ],
    },
    "apprenticeships.html": {
        "title": "Apprenticeships & Skill Training | MedOrbits",
        "description": "Understand apprenticeship pathways, training expectations, application preparation and important checks.",
        "eyebrow": "LEARN WHILE YOU WORK",
        "heading": "Build skills through structured workplace learning.",
        "intro": "Understand how apprenticeship opportunities work, what to check in a training agreement and how to prepare an accurate application.",
        "image": "photo-1522071820081-009f0129c71c",
        "primary": ("Prepare an application", "application-form.html"),
        "secondary": ("Explore internships", "internships.html"),
        "stats": [("Training", "Structured"), ("Terms", "Written"), ("Skills", "Practical")],
        "sections": [
            ("What to review in an apprenticeship", "Programmes differ by occupation, employer and applicable rules.", [
                ("Eligibility", "Check age, qualification, trade, location and any programme-specific requirements.", "application-form.html", "photo-1454165804606-c3d57bc86b40"),
                ("Training structure", "Understand practical training, classroom learning, assessments and supervision.", "internships.html", "photo-1521737711867-e3b97375f902"),
                ("Stipend and conditions", "Read the written terms for stipend, duration, working hours, leave and safety.", "application-form.html", "photo-1552664730-d307ca884978"),
            ]),
            ("Prepare before applying", "Keep your information accurate and use official channels.", [
                ("Gather documents", "Prepare education records, identity documents and certificates only as requested through a verified process.", "application-form.html", "photo-1455390582262-044cdead277a"),
                ("Use official portals", "Confirm the scheme and employer through relevant official sources before registering.", "fresher-jobs.html", "photo-1516321318423-f06f85e504b3"),
                ("Keep records", "Save the application reference, agreement, contact details and important communications.", "application-form.html", "photo-1454165804606-c3d57bc86b40"),
            ]),
        ],
        "faqs": [
            ("Is an apprenticeship the same as a regular job?", "Not necessarily. It is generally a structured training arrangement with defined terms and learning objectives."),
            ("Do all apprenticeships require the same qualification?", "No. Eligibility depends on the specific trade, employer, scheme and applicable rules."),
            ("Where should I confirm official details?", "Use the relevant government or programme portal and the employer's verified recruitment channel."),
        ],
    },
    "walk-in-interviews.html": {
        "title": "Walk-In Interviews | Preparation Guide | MedOrbits",
        "description": "Prepare for walk-in interviews with a document checklist, interview tips and employer verification guidance.",
        "eyebrow": "INTERVIEW PREPARATION",
        "heading": "Walk in prepared. Leave a clear impression.",
        "intro": "Plan your documents, understand the role and verify the organiser before travelling to a walk-in interview.",
        "image": "photo-1521737711867-e3b97375f902",
        "primary": ("Prepare an application", "application-form.html"),
        "secondary": ("Explore fresher jobs", "fresher-jobs.html"),
        "stats": [("Role details", "Checked"), ("Documents", "Ready"), ("Travel plan", "Set")],
        "sections": [
            ("Before you attend", "A few simple checks can help you avoid wasted travel and suspicious offers.", [
                ("Verify the drive", "Confirm the date, venue, role and organiser using the employer's official contact channel.", "fresher-jobs.html", "photo-1552664730-d307ca884978"),
                ("Prepare your documents", "Carry relevant resume copies and requested certificates; avoid handing over originals unnecessarily.", "application-form.html", "photo-1455390582262-044cdead277a"),
                ("Plan your arrival", "Check the route, reporting time, dress expectations and a reliable contact number.", "application-form.html", "photo-1521737711867-e3b97375f902"),
            ]),
            ("During the interview", "Communicate clearly and ask practical questions about the role.", [
                ("Introduce yourself", "Give a concise overview of your education, relevant skills and interest in the role.", "fresher-jobs.html", "photo-1521737711867-e3b97375f902"),
                ("Clarify the job", "Ask about responsibilities, location, hours, compensation and reporting structure.", "application-form.html", "photo-1454165804606-c3d57bc86b40"),
                ("Watch for red flags", "Do not pay for guaranteed selection or share OTPs, passwords or banking credentials.", "work-from-home.html", "photo-1516321318423-f06f85e504b3"),
            ]),
        ],
        "faqs": [
            ("Are walk-in interview details on this page current?", "No specific live drive is being advertised here. Confirm current details directly with the employer's official channel."),
            ("Should I submit original certificates?", "Carry originals only for inspection if genuinely required, keep them in your possession and do not surrender them without a clear lawful reason."),
            ("Is a recruitment fee normal?", "Be cautious of fees linked to guaranteed selection. Verify the recruiter and terms independently before paying anything."),
        ],
    },
    "application-form.html": {
        "title": "Career Support Enquiry | MedOrbits",
        "description": "Contact MedOrbits about career guidance, job-search resources, internships, apprenticeships and recruitment support.",
        "eyebrow": "CAREER SUPPORT",
        "heading": "Tell us what you want to work toward.",
        "intro": "Share the basic details needed to understand your career enquiry. This demo form validates in the browser and opens an email draft; it does not store or submit data to a server.",
        "image": "photo-1454165804606-c3d57bc86b40",
        "primary": ("Browse opportunities", "index.html#opportunities"),
        "secondary": ("Review interview tips", "walk-in-interviews.html"),
        "stats": [("Details", "Accurate"), ("Privacy", "Considered"), ("Next step", "Clear")],
        "sections": [
            ("Before you submit", "Only provide information needed for your enquiry.", [
                ("Use a professional email", "Choose an email address you can access and check regularly.", "fresher-jobs.html", "photo-1455390582262-044cdead277a"),
                ("Keep documents safe", "Do not include passwords, OTPs, bank details or unnecessary identity-document numbers.", "work-from-home.html", "photo-1516321318423-f06f85e504b3"),
                ("Describe your goal", "Tell us the type of role, field or career support you are seeking.", "internships.html", "photo-1521737711867-e3b97375f902"),
            ]),
        ],
        "faqs": [
            ("Does this form send my details to MedOrbits?", "This standalone generated page opens an email draft on your device. It does not transmit or store form data. Connect a secure backend before using it for live submissions."),
            ("Should I upload identity documents here?", "No upload is provided on this demo page. Share sensitive documents only through a verified, secure process when necessary."),
            ("Does submitting an enquiry guarantee placement?", "No. An enquiry is not a job offer or a guarantee of employment."),
        ],
    },
    "resume-guide.html": {
        "title": "Resume Guide | MedOrbits Career Hub",
        "description": "Create a clear, accurate resume with practical guidance for freshers and early-career applicants.",
        "eyebrow": "APPLICATION TOOLKIT",
        "heading": "Make your skills easy to understand.",
        "intro": "Use a clean, role-focused resume to show what you know, what you have done and how your experience relates to the opportunity.",
        "image": "photo-1455390582262-044cdead277a",
        "primary": ("Career support enquiry", "application-form.html"),
        "secondary": ("Explore fresher jobs", "fresher-jobs.html"),
        "stats": [("Accuracy", "Essential"), ("Relevance", "Focused"), ("Format", "Readable")],
        "sections": [
            ("Resume essentials", "Keep the document readable and specific to the role.", [
                ("Contact details", "Include a professional email and phone number; omit sensitive personal information that is not needed.", "application-form.html", "photo-1454165804606-c3d57bc86b40"),
                ("Skills and projects", "Show concrete examples, tools used and outcomes you can explain honestly.", "internships.html", "photo-1516321318423-f06f85e504b3"),
                ("Education and training", "List relevant qualifications, dates, certificates and coursework accurately.", "apprenticeships.html", "photo-1522071820081-009f0129c71c"),
            ]),
        ],
        "faqs": [
            ("How long should a fresher resume be?", "Usually one page is enough, but relevant content and readability matter more than a strict length."),
            ("Should I include skills I have not used?", "Only list skills you can discuss honestly and demonstrate at an appropriate level."),
            ("Should I use one resume for every role?", "Keep a master resume, then tailor the summary and relevant skills to each role."),
        ],
    },
    "interview-preparation.html": {
        "title": "Interview Preparation | MedOrbits",
        "description": "Prepare for job interviews with practical research, structured examples and questions to ask employers.",
        "eyebrow": "CAREER TOOLKIT",
        "heading": "Prepare with evidence, not memorised scripts.",
        "intro": "Research the employer, practise clear examples and prepare thoughtful questions so you can discuss your experience accurately.",
        "image": "photo-1552664730-d307ca884978",
        "primary": ("Walk-in interview guide", "walk-in-interviews.html"),
        "secondary": ("Career support enquiry", "application-form.html"),
        "stats": [("Research", "Complete"), ("Examples", "Practised"), ("Questions", "Prepared")],
        "sections": [
            ("A repeatable preparation routine", "Use a simple structure to prepare without sounding scripted.", [
                ("Research the role", "Understand the responsibilities, required skills, employer and interview format.", "fresher-jobs.html", "photo-1454165804606-c3d57bc86b40"),
                ("Prepare real examples", "Describe the situation, your actions and the result; be clear about your own contribution.", "resume-guide.html", "photo-1455390582262-044cdead277a"),
                ("Ask useful questions", "Clarify success measures, training, work arrangements, compensation and next steps.", "application-form.html", "photo-1521737711867-e3b97375f902"),
            ]),
        ],
        "faqs": [
            ("What if I do not know an answer?", "Be honest, explain how you would approach the problem and avoid pretending to have experience you do not have."),
            ("How early should I arrive?", "Follow the employer's instructions and plan enough time for travel and check-in."),
            ("What should I ask about salary?", "Ask professionally about the compensation range, benefits, work hours and written terms when appropriate."),
        ],
    },
}

# Image IDs are intentionally mapped to stable Unsplash photo IDs.
PHOTO_IDS = {
    "photo- remote": "photo-1498050108023-c5249f4df085",
    "photo-1521737711867-e3b97375f902": "photo-1521737711867-e3b97375f902",
    "photo-1521791136064-7986c2920216": "photo-1521791136064-7986c2920216",
    "photo-1523240795612-9a054b0db644": "photo-1523240795612-9a054b0db644",
    "photo-1522071820081-009f0129c71c": "photo-1522071820081-009f0129c71c",
    "photo-1454165804606-c3d57bc86b40": "photo-1454165804606-c3d57bc86b40",
    "photo-1455390582262-044cdead277a": "photo-1455390582262-044cdead277a",
    "photo-1552664730-d307ca884978": "photo-1552664730-d307ca884978",
    "photo-1553877522-43269d4ea984": "photo-1553877522-43269d4ea984",
    "photo-1516321318423-f06f85e504b3": "photo-1516321318423-f06f85e504b3",
}

CSS = r"""
:root{color-scheme:dark;--bg:#0b1713;--panel:#12251e;--panel2:#182c24;--gold:#d7b77a;--gold2:#f0d9a6;--cream:#f4eee2;--muted:#c0c8bf;--line:rgba(215,183,122,.24);--wine:#572b38;--radius:22px;--shadow:0 20px 60px rgba(0,0,0,.26)}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:100px}body{margin:0;background:radial-gradient(ellipse at 10% 0%,rgba(87,43,56,.34),transparent 38%),radial-gradient(ellipse at 90% 12%,rgba(215,183,122,.10),transparent 30%),var(--bg);color:var(--cream);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.65}a{color:inherit;text-decoration:none}img{display:block;max-width:100%}button,input,select,textarea{font:inherit}.wrap{width:min(1160px,calc(100% - 40px));margin-inline:auto}.topbar{position:sticky;top:0;z-index:20;background:rgba(8,20,15,.88);backdrop-filter:blur(18px);border-bottom:1px solid var(--line)}.nav{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{display:flex;align-items:center;gap:12px;font-weight:800;letter-spacing:.02em}.brandmark{display:grid;place-items:center;width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,#f0d9a6,#a98143);color:#15241b;font-weight:900;box-shadow:0 8px 24px #0004}.brand small{display:block;color:var(--muted);font-size:.68rem;font-weight:600;letter-spacing:.16em;text-transform:uppercase}.navlinks{display:flex;align-items:center;gap:20px;color:#e5e0d5;font-size:.91rem}.navlinks a:hover,.footer a:hover{color:var(--gold2)}.menu-toggle{display:none;background:transparent;color:var(--cream);border:1px solid var(--line);border-radius:12px;padding:8px 12px}.hero{padding:70px 0 56px;overflow:hidden}.hero-grid{display:grid;grid-template-columns:1.03fr .97fr;gap:48px;align-items:center}.eyebrow{display:inline-flex;align-items:center;gap:9px;color:var(--gold2);font-size:.75rem;font-weight:800;letter-spacing:.19em;text-transform:uppercase}.eyebrow:before{content:"";width:28px;height:1px;background:var(--gold)}h1,h2,h3,p{margin-top:0}h1{font-size:clamp(2.45rem,5vw,4.8rem);line-height:1.04;letter-spacing:-.055em;margin:18px 0 22px;max-width:760px}h1 em{font-style:normal;color:var(--gold2)}.lead{color:#d0d6ce;font-size:1.12rem;max-width:640px}.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}.btn{display:inline-flex;justify-content:center;align-items:center;gap:9px;border:1px solid var(--line);border-radius:999px;padding:12px 19px;font-weight:750;transition:transform .2s,background .2s}.btn:hover{transform:translateY(-2px)}.btn-primary{background:linear-gradient(135deg,#e7cc91,#bd9658);color:#15231b;border-color:transparent}.btn-secondary{background:rgba(255,255,255,.035)}.hero-media{position:relative;min-height:400px;border-radius:30px;overflow:hidden;border:1px solid var(--line);box-shadow:var(--shadow)}.hero-media img{width:100%;height:100%;min-height:400px;object-fit:cover;filter:saturate(.78)}.hero-media:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 45%,rgba(6,17,12,.82))}.image-note{position:absolute;z-index:1;bottom:22px;left:24px;right:24px;color:white}.image-note strong{display:block;font-size:1.2rem}.image-note span{color:#e4dfd4;font-size:.9rem}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:34px}.stat{padding:17px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.025)}.stat strong{display:block;color:var(--gold2);font-size:1rem}.stat span{color:var(--muted);font-size:.82rem}.section{padding:64px 0}.section-head{max-width:760px;margin-bottom:28px}.section-head h2{font-size:clamp(1.8rem,3vw,2.7rem);line-height:1.15;letter-spacing:-.035em;margin:12px 0}.section-head p{color:var(--muted)}.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.card{overflow:hidden;background:linear-gradient(145deg,rgba(25,47,37,.96),rgba(15,31,24,.96));border:1px solid var(--line);border-radius:var(--radius);transition:transform .25s,border-color .25s;min-width:0}.card:hover{transform:translateY(-5px);border-color:rgba(240,217,166,.62)}.card img{width:100%;height:190px;object-fit:cover;filter:saturate(.75)}.card-body{padding:22px}.card h3{font-size:1.2rem;margin:0 0 9px}.card p{color:var(--muted);font-size:.94rem;margin-bottom:18px}.text-link{display:inline-flex;align-items:center;gap:8px;color:var(--gold2);font-weight:800;font-size:.92rem}.text-link:after{content:"↗"}.feature-band{padding:34px;border:1px solid var(--line);border-radius:28px;background:linear-gradient(120deg,rgba(87,43,56,.38),rgba(215,183,122,.08)),var(--panel)}.feature-band h2{font-size:clamp(1.65rem,3vw,2.35rem);margin-bottom:10px}.feature-band p{color:var(--muted);max-width:760px}.split{display:grid;grid-template-columns:.8fr 1.2fr;gap:32px;align-items:start}.checklist{display:grid;gap:12px}.check{display:flex;gap:13px;padding:17px;border-radius:16px;border:1px solid var(--line);background:rgba(255,255,255,.025)}.checkmark{flex:0 0 30px;width:30px;height:30px;border-radius:10px;display:grid;place-items:center;background:rgba(215,183,122,.13);color:var(--gold2)}.check strong{display:block;margin-bottom:3px}.check p{margin:0;color:var(--muted);font-size:.92rem}.carousel{position:relative}.carousel-track{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.slide{padding:22px;background:var(--panel);border:1px solid var(--line);border-radius:20px}.slide p{color:var(--muted);margin-bottom:0}.carousel-controls{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}.circle-btn{width:42px;height:42px;border-radius:50%;border:1px solid var(--line);background:var(--panel);color:var(--gold2);cursor:pointer}.faq-list{display:grid;gap:10px}.faq-list details{background:rgba(255,255,255,.025);border:1px solid var(--line);border-radius:16px;padding:17px 20px}.faq-list summary{font-weight:800;cursor:pointer}.faq-list details p{margin:12px 0 0;color:var(--muted)}.form-shell{display:grid;grid-template-columns:.8fr 1.2fr;gap:24px}.form-aside,.form-panel{padding:28px;border:1px solid var(--line);border-radius:24px;background:var(--panel)}.form-aside p{color:var(--muted)}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.field{display:grid;gap:7px}.field.full{grid-column:1/-1}.field label{font-weight:750;font-size:.9rem}.field input,.field select,.field textarea{width:100%;border:1px solid rgba(215,183,122,.28);border-radius:12px;padding:12px 13px;background:#0b1913;color:var(--cream);outline:none}.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--gold)}.field textarea{min-height:120px;resize:vertical}.hint{font-size:.82rem;color:var(--muted)}.form-message{margin-top:14px;color:var(--gold2)}.footer{padding:42px 0 26px;border-top:1px solid var(--line);background:rgba(4,12,8,.38)}.footer-grid{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:28px}.footer p,.footer li{color:var(--muted);font-size:.91rem}.footer ul{list-style:none;padding:0;margin:10px 0;display:grid;gap:8px}.footer h3{font-size:1rem}.footer-bottom{display:flex;justify-content:space-between;gap:15px;flex-wrap:wrap;margin-top:30px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:.82rem}.reveal{opacity:0;transform:translateY(18px);transition:opacity .65s ease,transform .65s ease}.reveal.visible{opacity:1;transform:none}.notice{padding:14px 16px;border-radius:14px;background:rgba(215,183,122,.09);border:1px solid var(--line);color:#e8ddc7;font-size:.9rem}.breadcrumb{padding-top:22px;color:var(--muted);font-size:.86rem}.breadcrumb a{color:var(--gold2)}.back-top{position:fixed;right:18px;bottom:18px;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:var(--gold);color:#17241b;box-shadow:var(--shadow);z-index:10;opacity:0;pointer-events:none;transition:opacity .2s}.back-top.show{opacity:1;pointer-events:auto}
@media(max-width:900px){.hero-grid,.split,.form-shell{grid-template-columns:1fr}.hero{padding-top:46px}.hero-media,.hero-media img{min-height:320px}.cards{grid-template-columns:repeat(2,minmax(0,1fr))}.carousel-track{grid-template-columns:1fr}.carousel-track .slide:not(:first-child){display:none}.footer-grid{grid-template-columns:1fr 1fr}.footer-grid>div:first-child{grid-column:1/-1}}
@media(max-width:640px){.wrap{width:min(100% - 28px,1160px)}.nav{min-height:68px}.menu-toggle{display:block}.navlinks{display:none;position:absolute;top:68px;left:14px;right:14px;padding:16px;border:1px solid var(--line);border-radius:16px;background:#0d1d15;flex-direction:column;align-items:stretch;gap:4px}.navlinks.open{display:flex}.navlinks a{padding:10px}.hero{padding:36px 0 28px}.hero-grid{gap:25px}h1{font-size:clamp(2.35rem,12vw,3.5rem)}.hero-media,.hero-media img{min-height:270px}.stats{gap:8px}.stat{padding:12px 9px}.stat span{font-size:.74rem}.section{padding:44px 0}.cards{grid-template-columns:1fr}.card img{height:200px}.feature-band{padding:24px}.form-aside,.form-panel{padding:20px}.form-grid{grid-template-columns:1fr}.field.full{grid-column:auto}.footer-grid{grid-template-columns:1fr}.footer-grid>div:first-child{grid-column:auto}.footer-bottom{display:block}.actions .btn{width:100%}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition:none!important;animation:none!important}.reveal{opacity:1;transform:none}}
"""

JS = r"""
(function(){
  const menu=document.querySelector('.menu-toggle');
  const links=document.querySelector('.navlinks');
  if(menu&&links){menu.addEventListener('click',()=>{const open=links.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));});links.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{links.classList.remove('open');menu.setAttribute('aria-expanded','false');}));}
  const revealEls=document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window){const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target);}}),{threshold:.08});revealEls.forEach(el=>io.observe(el));}else{revealEls.forEach(el=>el.classList.add('visible'));}
  const top=document.querySelector('.back-top');
  if(top){window.addEventListener('scroll',()=>top.classList.toggle('show',window.scrollY>500),{passive:true});top.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));}
  const track=document.querySelector('.carousel-track');
  const prev=document.querySelector('[data-slide="prev"]'),next=document.querySelector('[data-slide="next"]');
  if(track&&prev&&next){const slides=Array.from(track.children);let index=0;const render=()=>{if(window.matchMedia('(max-width: 900px)').matches){slides.forEach((s,i)=>s.style.display=i===index?'block':'none');}else{slides.forEach(s=>s.style.display='block');}};prev.addEventListener('click',()=>{index=(index-1+slides.length)%slides.length;render()});next.addEventListener('click',()=>{index=(index+1)%slides.length;render()});window.addEventListener('resize',render);render();}
  const form=document.querySelector('#career-form');
  if(form){form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;const d=new FormData(form);const subject=encodeURIComponent('MedOrbits career enquiry - '+(d.get('interest')||'Career support'));const body=encodeURIComponent('Career enquiry\\n\\nName: '+d.get('name')+'\\nEmail: '+d.get('email')+'\\nPhone: '+(d.get('phone')||'Not provided')+'\\nInterest: '+d.get('interest')+'\\nLocation: '+(d.get('location')||'Not provided')+'\\nMessage: '+(d.get('message')||'Not provided')+'\\n\\nPlease review and reply to this enquiry.');const msg=document.querySelector('.form-message');if(msg)msg.textContent='Your email app should open with a draft. The page itself does not store or transmit this information.';window.location.href='mailto:careers@medorbits.in?subject='+subject+'&body='+body;});}
  const year=document.querySelector('[data-year]');if(year)year.textContent=new Date().getFullYear();
})();
"""

def e(value: str) -> str:
    return html.escape(str(value), quote=True)

def photo_url(photo_id: str) -> str:
    key = PHOTO_IDS.get(photo_id, photo_id)
    return f"https://images.unsplash.com/{key}?auto=format&fit=crop&w=1200&q=82"

def nav_html() -> str:
    links = [
        ("Career Hub", "index.html"),
        ("Fresher Jobs", "fresher-jobs.html"),
        ("Work From Home", "work-from-home.html"),
        ("Internships", "internships.html"),
        ("Apprenticeships", "apprenticeships.html"),
        ("Walk-In Interviews", "walk-in-interviews.html"),
    ]
    return '<nav class="nav wrap" aria-label="Main navigation"><a class="brand" href="../index.html" aria-label="MedOrbits home"><span class="brandmark">M</span><span>MedOrbits<small>Education · Admissions · Careers</small></span></a><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="primary-nav">Menu</button><div class="navlinks" id="primary-nav">' + ''.join(
        f'<a href="{e(href)}">{e(label)}</a>' for label, href in links
    ) + '<a class="btn btn-primary" href="application-form.html">Get career support</a></div></nav>'

def render_cards(cards: list[tuple[str, str, str, str]]) -> str:
    out = []
    for title, desc, href, image in cards:
        out.append(
            '<article class="card reveal">'
            f'<img loading="lazy" src="{e(photo_url(image))}" alt="{e(title)}" width="800" height="500">'
            f'<div class="card-body"><h3>{e(title)}</h3><p>{e(desc)}</p>'
            f'<a class="text-link" href="{e(href)}">Explore guide</a></div></article>'
        )
    return '<div class="cards">' + ''.join(out) + '</div>'

def render_page(filename: str, data: dict) -> str:
    title = data["title"]
    desc = data["description"]
    stats = ''.join(f'<div class="stat"><strong>{e(value)}</strong><span>{e(label)}</span></div>' for label, value in data["stats"])
    sections = []
    for idx, (heading, intro, cards) in enumerate(data["sections"]):
        sections.append(
            f'<section class="section" id="{"opportunities" if filename == "index.html" and idx == 0 else "section-" + str(idx+1)}">'
            f'<div class="wrap"><div class="section-head reveal"><span class="eyebrow">{"EXPLORE" if idx == 0 else "YOUR NEXT STEP"}</span>'
            f'<h2>{e(heading)}</h2><p>{e(intro)}</p></div>{render_cards(cards)}</div></section>'
        )
    faq_html = ''.join(f'<details class="reveal"><summary>{e(q)}</summary><p>{e(a)}</p></details>' for q, a in data["faqs"])
    slides = [
        ("Be specific", "Match your application to the role and explain your relevant skills clearly."),
        ("Verify details", "Check employer identity, job terms and official application channels."),
        ("Keep records", "Save the job description, submission date and any reference number."),
    ]
    slide_html = ''.join(f'<article class="slide"><span class="eyebrow">CAREER NOTE 0{i+1}</span><h3>{e(h)}</h3><p>{e(p)}</p></article>' for i, (h, p) in enumerate(slides))
    form_section = ""
    if filename == "application-form.html":
        form_section = """
<section class="section" id="enquiry"><div class="wrap form-shell">
  <aside class="form-aside reveal"><span class="eyebrow">CAREER ENQUIRY</span><h2>Share your next step.</h2>
  <p>Use this form to prepare a career enquiry. Submitting opens a draft email in your email application; it does not send automatically or save data to a server.</p>
  <div class="notice">Safety note: do not enter passwords, OTPs, banking credentials or unnecessary identity-document numbers.</div>
  <p style="margin-top:18px">Email: <a class="text-link" href="mailto:careers@medorbits.in">careers@medorbits.in</a></p></aside>
  <div class="form-panel reveal"><form id="career-form">
    <div class="form-grid">
      <div class="field"><label for="name">Full name *</label><input id="name" name="name" autocomplete="name" required maxlength="100"></div>
      <div class="field"><label for="email">Email address *</label><input id="email" name="email" type="email" autocomplete="email" required maxlength="160"></div>
      <div class="field"><label for="phone">Phone (optional)</label><input id="phone" name="phone" type="tel" autocomplete="tel" maxlength="30"></div>
      <div class="field"><label for="interest">I am interested in *</label><select id="interest" name="interest" required><option value="">Choose an area</option><option>Fresher jobs</option><option>Work from home</option><option>Internships</option><option>Apprenticeships</option><option>Interview preparation</option><option>Resume guidance</option><option>Recruitment services</option><option>Other career support</option></select></div>
      <div class="field full"><label for="location">Preferred location (optional)</label><input id="location" name="location" maxlength="120" placeholder="City, state or remote"></div>
      <div class="field full"><label for="message">Tell us about your goal *</label><textarea id="message" name="message" required maxlength="2000" placeholder="Mention your qualification, target role and the support you need."></textarea><span class="hint">Keep the message focused and do not include sensitive credentials.</span></div>
      <div class="field full"><button class="btn btn-primary" type="submit">Prepare email enquiry ↗</button><p class="form-message" role="status" aria-live="polite"></p></div>
    </div>
  </form></div></div></section>
"""
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="{THEME_COLOR}">
<meta name="description" content="{e(desc)}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="{SITE_URL}/career/{e(filename)}">
<title>{e(title)}</title>
<style>{CSS}</style>
</head>
<body>
<header class="topbar">{nav_html()}</header>
<main>
<div class="wrap breadcrumb"><a href="../index.html">Home</a> / <a href="index.html">Career Hub</a> / <span>{e(title.split('|')[0].strip())}</span></div>
<section class="hero"><div class="wrap hero-grid">
  <div class="reveal"><span class="eyebrow">{e(data["eyebrow"])}</span>
    <h1>{e(data["heading"])}</h1><p class="lead">{e(data["intro"])}</p>
    <div class="actions"><a class="btn btn-primary" href="{e(data["primary"][1])}">{e(data["primary"][0])} ↗</a><a class="btn btn-secondary" href="{e(data["secondary"][1])}">{e(data["secondary"][0])}</a></div>
    <div class="stats">{stats}</div>
  </div>
  <div class="hero-media reveal"><img src="{e(photo_url(data["image"]))}" alt="Career planning and professional development" fetchpriority="high" width="1200" height="900"><div class="image-note"><strong>Move forward with a plan.</strong><span>Useful resources. Clear steps. Safer decisions.</span></div></div>
</div></section>
{''.join(sections)}
{form_section}
<section class="section"><div class="wrap split">
  <div class="section-head reveal"><span class="eyebrow">A SMARTER SEARCH</span><h2>Small steps make progress visible.</h2><p>Use a consistent process, verify details and keep your applications organised.</p><a class="btn btn-primary" href="application-form.html">Plan your next step</a></div>
  <div class="checklist">
    <div class="check reveal"><span class="checkmark">✓</span><div><strong>Confirm the opportunity</strong><p>Check the job description, employer identity, eligibility and application route.</p></div></div>
    <div class="check reveal"><span class="checkmark">✓</span><div><strong>Present accurate information</strong><p>Keep your resume, qualifications and examples truthful and up to date.</p></div></div>
    <div class="check reveal"><span class="checkmark">✓</span><div><strong>Protect your privacy</strong><p>Share only necessary information through verified, secure channels.</p></div></div>
  </div>
</div></section>
<section class="section"><div class="wrap"><div class="section-head reveal"><span class="eyebrow">CAREER NOTES</span><h2>Keep the fundamentals in focus.</h2><p>Practical reminders to use while exploring opportunities.</p></div>
<div class="carousel"><div class="carousel-track">{slide_html}</div><div class="carousel-controls"><button class="circle-btn" type="button" data-slide="prev" aria-label="Previous career note">←</button><button class="circle-btn" type="button" data-slide="next" aria-label="Next career note">→</button></div></div></div></section>
<section class="section"><div class="wrap"><div class="section-head reveal"><span class="eyebrow">COMMON QUESTIONS</span><h2>Before you take the next step</h2></div><div class="faq-list">{faq_html}</div></div></section>
<section class="section"><div class="wrap"><div class="feature-band reveal"><span class="eyebrow">MEDORBITS CAREER HUB</span><h2>Make your next move a considered one.</h2><p>Explore the guides, verify every opportunity and prepare an application that reflects your real skills and goals.</p><div class="actions"><a class="btn btn-primary" href="application-form.html">Contact career support ↗</a><a class="btn btn-secondary" href="index.html">Back to career hub</a></div></div></div></section>
</main>
<footer class="footer"><div class="wrap"><div class="footer-grid">
  <div><a class="brand" href="../index.html"><span class="brandmark">M</span><span>MedOrbits<small>Education · Admissions · Careers</small></span></a><p>Career resources and practical guidance to help you make informed next steps.</p></div>
  <div><h3>Career resources</h3><ul><li><a href="fresher-jobs.html">Fresher jobs</a></li><li><a href="work-from-home.html">Work from home</a></li><li><a href="internships.html">Internships</a></li><li><a href="apprenticeships.html">Apprenticeships</a></li></ul></div>
  <div><h3>Support & preparation</h3><ul><li><a href="walk-in-interviews.html">Walk-in interviews</a></li><li><a href="resume-guide.html">Resume guide</a></li><li><a href="interview-preparation.html">Interview preparation</a></li><li><a href="application-form.html">Career enquiry</a></li><li><a href="../contact.html">Contact MedOrbits</a></li></ul></div>
</div><div class="footer-bottom"><span>© <span data-year></span> MedOrbits. All rights reserved.</span><span>Verify vacancies with the employer before applying.</span></div></div></footer>
<button class="back-top" type="button" aria-label="Back to top">↑</button>
<script>{JS}</script>
</body>
</html>
"""

def find_repo_root(start: Path) -> Path:
    candidates = [start, *start.parents]
    for candidate in candidates:
        if (candidate / ".git").exists() or (candidate / "package.json").exists() or (candidate / "index.html").exists():
            return candidate
    return start

def validate_html(path: Path, repo_root: Path) -> list[str]:
    content = path.read_text(encoding="utf-8")
    issues = []
    for tag in ("<!doctype html>", "<html", "<head>", "<body", "</html>", "<title>", 'name="description"'):
        if tag.lower() not in content.lower():
            issues.append(f"{path.relative_to(repo_root)}: missing {tag}")
    if content.count("<section") != content.count("</section>"):
        issues.append(f"{path.relative_to(repo_root)}: unbalanced section tags")
    # Check relative href targets. Ignore anchors, mailto, external URLs, and parent paths
    # that resolve outside the repo.
    for href in re.findall(r"""href=["']([^"']+)["']""", content):
        if href.startswith(("#", "mailto:", "tel:", "http://", "https://", "javascript:")):
            continue
        target_part = href.split("#", 1)[0]
        if not target_part:
            continue
        target = (path.parent / target_part).resolve()
        try:
            target.relative_to(repo_root.resolve())
        except ValueError:
            continue
        if not target.exists():
            issues.append(f"{path.relative_to(repo_root)}: local link target missing: {href}")
    return issues

# Repository scaffold related to the career hub. Empty folders receive .gitkeep files
# so they are represented in Git; folders are only created, never deleted.
SCAFFOLD_DIRS = [
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
]

SCAFFOLD_FILES = {
    "career/README.md": """# MedOrbits Career Hub

This folder contains the public-facing career hub pages generated by
`scripts/complete_medorbits_career.py`.

## Pages
- `index.html` -- career hub landing page
- `fresher-jobs.html` -- fresher job search guidance
- `work-from-home.html` -- remote-work guidance and safety checks
- `internships.html` -- internship preparation
- `apprenticeships.html` -- apprenticeship guidance
- `walk-in-interviews.html` -- walk-in interview preparation
- `application-form.html` -- client-side career enquiry draft
- `resume-guide.html` -- resume preparation guidance
- `interview-preparation.html` -- interview preparation guidance

## Design
The current pages are self-contained: CSS and JavaScript are embedded in each HTML file.
They do not depend on shared career CSS/JS assets. Images are remotely loaded from Unsplash;
review licensing, availability, privacy and performance requirements before production.

## Application form warning
The generated form uses `mailto:` to prepare an email draft. It does not securely submit
or persist data. Connect it to a validated server endpoint before treating it as a live form.

## Build and validate
From the repository root:

```bash
python scripts/complete_medorbits_career.py --dry-run
python scripts/complete_medorbits_career.py
python scripts/complete_medorbits_career.py --validate-only
```
""",
    "docs/career/IMPLEMENTATION.md": """# Career Hub implementation notes

- The generator is idempotent by default: existing target pages are preserved.
- Use `--force` only when intentionally replacing generated target pages.
- Use `--root PATH` to specify a repository root explicitly.
- Use `--dry-run` to preview page and scaffold actions.
- Use `--validate-only` to check existing generated career pages.
- The generator does not commit, push, deploy, or delete files.
- Review canonical URLs and ensure they match the production route structure.
- Connect the enquiry form to a secure backend before collecting live user data.
- Confirm the career contact email address before production.
""",
    "career/data/page-manifest.json": None,
    "career/tests/README.md": """# Career page checks

The generator performs basic HTML and local-link validation after writing pages.
For production, add an HTML validator and browser-based smoke tests to CI.
""",
    "tests/career/README.md": """# Career hub test area

Place automated tests for the generated career hub here. Suggested checks:
- all expected pages exist;
- each page contains a title, description, main landmark and footer;
- local links resolve;
- images have alt text;
- the enquiry form clearly explains that it is not a server-side submission;
- mobile navigation and reduced-motion behaviour work in a browser test.
""",
    "career/assets/images/README.md": """# Career images

Optional location for locally hosted, licensed career images. The current generated pages
use remote Unsplash image URLs. If you migrate images locally, update `photo_url()` in the
generator and the image references in generated HTML.
""",
    "career/assets/README.md": """# Career assets

The generated HTML currently embeds its CSS and JavaScript, so no shared CSS or JS files
are required. This folder is reserved for future local images or other career-only assets.
""",
    "career/partials/README.md": """# Career partials

Reserved for reusable templates if the career pages are later refactored into a templating
system. The current generator builds complete standalone HTML pages.
""",
}

def _write_text_if_missing(path: Path, content: str, *, force: bool = False) -> str:
    """Write a UTF-8 file only when absent unless force=True. Return action label."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and not force:
        return "preserved"
    path.write_text(content, encoding="utf-8", newline="\n")
    return "written"

def ensure_scaffold(root: Path, *, dry_run: bool = False, force_support_files: bool = False) -> tuple[list[str], list[str]]:
    """Create relevant directories and support files without deleting anything."""
    made_dirs: list[str] = []
    file_actions: list[str] = []
    for relative in SCAFFOLD_DIRS:
        directory = root / relative
        if not directory.exists():
            made_dirs.append(relative)
            if not dry_run:
                directory.mkdir(parents=True, exist_ok=True)
        elif not directory.is_dir():
            raise NotADirectoryError(f"Expected a directory but found a file: {directory}")

    # Keep otherwise-empty directories visible in Git.
    for relative in ("career/assets/images", "career/data", "career/partials", "career/tests", "tests/career"):
        keep = root / relative / ".gitkeep"
        if not keep.exists():
            file_actions.append(f"CREATE {keep.relative_to(root)}")
            if not dry_run:
                keep.parent.mkdir(parents=True, exist_ok=True)
                keep.write_text("", encoding="utf-8")

    manifest = {
        "site": "MedOrbits",
        "careerDirectory": "/career/",
        "pages": list(PAGES.keys()),
        "styles": "embedded",
        "scripts": "embedded",
        "formMode": "mailto-draft-only",
        "generatedBy": "scripts/complete_medorbits_career.py",
    }
    import json
    for relative, content in SCAFFOLD_FILES.items():
        if relative == "career/data/page-manifest.json":
            payload = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
        else:
            payload = content
        target = root / relative
        action = "preserved" if target.exists() and not force_support_files else "written"
        file_actions.append(f"{action.upper()} {relative}")
        if not dry_run:
            _write_text_if_missing(target, payload, force=force_support_files)
    return made_dirs, file_actions

def find_repo_root(start: Path) -> Path:
    """Find a likely project root, preferring the nearest repository marker."""
    for candidate in (start, *start.parents):
        if (candidate / ".git").exists() or (candidate / "package.json").exists():
            return candidate
    # For this script's expected location scripts/complete_medorbits_career.py,
    # its grandparent is the repository root even if Git metadata is unavailable.
    if start.name == "scripts":
        return start.parent
    return start

def validate_html(path: Path, repo_root: Path) -> list[str]:
    content = path.read_text(encoding="utf-8")
    issues: list[str] = []
    required = ("<!doctype html>", "<html", "<head>", "<body", "</html>", "<title>", 'name="description"')
    for token in required:
        if token.lower() not in content.lower():
            issues.append(f"{path.relative_to(repo_root)}: missing {token}")
    if content.count("<section") != content.count("</section>"):
        issues.append(f"{path.relative_to(repo_root)}: unbalanced section tags")
    if "<main" not in content.lower() or "</main>" not in content.lower():
        issues.append(f"{path.relative_to(repo_root)}: missing main landmark")
    if "<footer" not in content.lower():
        issues.append(f"{path.relative_to(repo_root)}: missing footer")
    if re.search(r'<img\b(?![^>]*\balt=)', content, re.I):
        issues.append(f"{path.relative_to(repo_root)}: image missing alt attribute")

    # Validate relative links within the repository. Links to pages outside this
    # generator's ownership (e.g. ../contact.html) are reported as warnings by caller.
    for href in re.findall(r"""href=["']([^"']+)["']""", content):
        if href.startswith(("#", "mailto:", "tel:", "http://", "https://", "javascript:")):
            continue
        target_part = href.split("#", 1)[0].split("?", 1)[0]
        if not target_part:
            continue
        target = (path.parent / target_part).resolve()
        try:
            target.relative_to(repo_root.resolve())
        except ValueError:
            continue
        if not target.exists():
            issues.append(f"{path.relative_to(repo_root)}: local link target missing: {href}")
    return issues

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate MedOrbits career pages and their supporting folder structure."
    )
    parser.add_argument("--root", type=Path, default=None, help="Repository root (auto-detected by default).")
    parser.add_argument("--force", action="store_true", help="Overwrite existing generated career HTML pages.")
    parser.add_argument("--force-support-files", action="store_true",
                        help="Also overwrite generator-owned README/manifest support files.")
    parser.add_argument("--dry-run", action="store_true", help="Preview planned directories and files without writing.")
    parser.add_argument("--validate-only", action="store_true", help="Validate existing generated career pages only.")
    args = parser.parse_args()

    script_path = Path(__file__).resolve()
    root = args.root.resolve() if args.root else find_repo_root(script_path.parent)
    career_dir = root / "career"

    if args.validate_only:
        targets = [career_dir / name for name in PAGES if (career_dir / name).is_file()]
        if not targets:
            print(f"No target career pages found in {career_dir}")
            return 1
        issues = [issue for page in targets for issue in validate_html(page, root)]
        if issues:
            print("\n".join("ERROR: " + issue for issue in issues))
            return 1
        print(f"Validated {len(targets)} career pages; no basic HTML/local-link issues found.")
        return 0

    print(f"Repository root: {root}")
    print(f"Career directory: {career_dir}")
    if not args.dry_run:
        root.mkdir(parents=True, exist_ok=True)

    try:
        dirs, support_actions = ensure_scaffold(
            root, dry_run=args.dry_run, force_support_files=args.force_support_files
        )
    except NotADirectoryError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    print("\nDirectory scaffold:")
    if dirs:
        for item in dirs:
            print(f"  {'WOULD CREATE' if args.dry_run else 'CREATED'} {item}/")
    else:
        print("  All configured directories already exist.")
    print("\nSupport files:")
    for action in support_actions:
        print(f"  {action}")

    created: list[str] = []
    skipped: list[str] = []
    overwritten: list[str] = []
    for filename, data in PAGES.items():
        target = career_dir / filename
        existed_before = target.exists()
        if existed_before and not args.force:
            skipped.append(filename)
            print(f"  PRESERVED career/{filename}")
            continue
        if args.dry_run:
            print(f"  {'OVERWRITE' if existed_before else 'CREATE'} career/{filename}")
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(render_page(filename, data), encoding="utf-8", newline="\n")
        if existed_before:
            overwritten.append(filename)
            print(f"  OVERWROTE career/{filename}")
        else:
            created.append(filename)
            print(f"  CREATED career/{filename}")

    if args.dry_run:
        print(f"\nDry run complete. {len(PAGES)} career pages and {len(SCAFFOLD_DIRS)} directories considered.")
        return 0

    print("\nSummary:")
    print(f"  Created pages: {len(created)}")
    print(f"  Overwritten pages: {len(overwritten)}")
    print(f"  Preserved existing pages: {len(skipped)}")

    targets = [career_dir / name for name in PAGES if (career_dir / name).is_file()]
    issues = [issue for page in targets for issue in validate_html(page, root)]
    if issues:
        print("\nValidation findings:")
        print("\n".join("  ! " + issue for issue in issues))
        print("\nSome findings may refer to surrounding site pages (for example ../contact.html) not managed by this script.")
        print("Create or verify those pages before deployment.")
        return 1

    print(f"\nValidation passed for {len(targets)} generated career pages.")
    print("Important: application-form.html opens a mail draft; it does not submit data to a server.")
    print("Review contact email routing, canonical URLs, remote image licensing and sitemap inclusion before deployment.")
    print("No files were committed, pushed, deployed, or deleted.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
