#!/usr/bin/env python3
"""
MedOrbits Education Repository Builder
======================================

Creates and maintains a complete /education directory using Python's
standard library only.

Features:
- Education landing page and topic pages
- University directory and compatibility alias for universitiy.html
- University, course, and resource JSON catalogs
- Shared responsive CSS and JavaScript
- Search, category filtering, mobile navigation, and FAQ interactions
- SEO metadata, sitemap, robots guidance, JSON schemas, and documentation
- Safe-by-default writes: existing files are preserved unless --force is used
- Dry-run, validation, and JSON build report

Python: 3.10+
Run from the repository root:
    python build_education_repository.py
    python build_education_repository.py --dry-run
    python build_education_repository.py --force
    python build_education_repository.py --validate
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


SCRIPT_VERSION = "1.0.0"
DEFAULT_ROOT = Path(__file__).resolve().parent
SITE_URL = "https://medorbits.in"
EDUCATION_URL = f"{SITE_URL}/education"

# Existing files are not overwritten unless --force is explicitly supplied.
GENERATED_FILES: dict[str, str] = {}


def add_file(path: str, content: str) -> None:
    """Register a file to generate."""
    GENERATED_FILES[path] = content.strip() + "\n"


def json_text(value: Any) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False) + "\n"


# ---------------------------------------------------------------------------
# Education content data
# ---------------------------------------------------------------------------

UNIVERSITIES = [
    {
        "id": "uni-001",
        "name": "University of Delhi",
        "short_name": "DU",
        "state": "Delhi",
        "type": "Central University",
        "website": "https://www.du.ac.in/",
        "description": "Explore academic departments, programmes, admission notices, and university resources.",
        "categories": ["central", "general"],
        "verification_note": "Verify the current programme list and admission process on the official university website.",
    },
    {
        "id": "uni-002",
        "name": "Jawaharlal Nehru University",
        "short_name": "JNU",
        "state": "Delhi",
        "type": "Central University",
        "website": "https://www.jnu.ac.in/",
        "description": "Review schools, centres, academic programmes, research opportunities, and official notices.",
        "categories": ["central", "research"],
        "verification_note": "Programme availability and admission routes vary by course and academic year.",
    },
    {
        "id": "uni-003",
        "name": "Banaras Hindu University",
        "short_name": "BHU",
        "state": "Uttar Pradesh",
        "type": "Central University",
        "website": "https://www.bhu.ac.in/",
        "description": "Find university information, faculties, academic programmes, and admission announcements.",
        "categories": ["central", "general", "medical"],
        "verification_note": "Confirm programme eligibility and admission notices with the university.",
    },
    {
        "id": "uni-004",
        "name": "Aligarh Muslim University",
        "short_name": "AMU",
        "state": "Uttar Pradesh",
        "type": "Central University",
        "website": "https://www.amu.ac.in/",
        "description": "Explore faculties, courses, university notices, and institutional information.",
        "categories": ["central", "general", "medical"],
        "verification_note": "Check the official admission guide for each programme.",
    },
    {
        "id": "uni-005",
        "name": "University of Calcutta",
        "short_name": "CU",
        "state": "West Bengal",
        "type": "State University",
        "website": "https://www.caluniv.ac.in/",
        "description": "Explore academic departments, affiliated-college information, and university resources.",
        "categories": ["state", "general", "research"],
        "verification_note": "Affiliation, eligibility, and admission details should be confirmed through official sources.",
    },
    {
        "id": "uni-006",
        "name": "Jadavpur University",
        "short_name": "JU",
        "state": "West Bengal",
        "type": "State University",
        "website": "https://jadavpuruniversity.in/",
        "description": "Review engineering, arts, science, research, and other university programme information.",
        "categories": ["state", "engineering", "research"],
        "verification_note": "Programme-specific eligibility and selection rules may differ.",
    },
    {
        "id": "uni-007",
        "name": "Assam University",
        "short_name": "AU",
        "state": "Assam",
        "type": "Central University",
        "website": "https://www.aus.ac.in/",
        "description": "Find academic departments, programme information, and official university announcements.",
        "categories": ["central", "general"],
        "verification_note": "Check the current prospectus and programme availability on the official website.",
    },
    {
        "id": "uni-008",
        "name": "Tezpur University",
        "short_name": "TU",
        "state": "Assam",
        "type": "Central University",
        "website": "https://www.tezu.ernet.in/",
        "description": "Explore programmes, research areas, academic resources, and admission information.",
        "categories": ["central", "engineering", "research"],
        "verification_note": "Confirm current admission procedures through the university's official notices.",
    },
    {
        "id": "uni-009",
        "name": "University of Hyderabad",
        "short_name": "UoH",
        "state": "Telangana",
        "type": "Central University",
        "website": "https://uohyd.ac.in/",
        "description": "Review schools, research programmes, academic departments, and university announcements.",
        "categories": ["central", "research", "general"],
        "verification_note": "Entry routes differ between programmes; consult the official admissions information.",
    },
    {
        "id": "uni-010",
        "name": "Anna University",
        "short_name": "AU",
        "state": "Tamil Nadu",
        "type": "State University",
        "website": "https://www.annauniv.edu/",
        "description": "Explore engineering and technology education, university departments, and academic information.",
        "categories": ["state", "engineering"],
        "verification_note": "Confirm the applicable admission process and affiliated-college details officially.",
    },
    {
        "id": "uni-011",
        "name": "Savitribai Phule Pune University",
        "short_name": "SPPU",
        "state": "Maharashtra",
        "type": "State University",
        "website": "https://www.unipune.ac.in/",
        "description": "Find academic departments, affiliated-college resources, and university announcements.",
        "categories": ["state", "general", "research"],
        "verification_note": "Check programme-specific requirements and current university notifications.",
    },
    {
        "id": "uni-012",
        "name": "University of Mumbai",
        "short_name": "MU",
        "state": "Maharashtra",
        "type": "State University",
        "website": "https://mu.ac.in/",
        "description": "Explore university departments, academic programmes, and institutional information.",
        "categories": ["state", "general"],
        "verification_note": "Verify current admission and affiliation information on the official website.",
    },
    {
        "id": "uni-013",
        "name": "Bangalore University",
        "short_name": "BU",
        "state": "Karnataka",
        "type": "State University",
        "website": "https://bangaloreuniversity.karnataka.gov.in/",
        "description": "Review university resources, departments, and available academic information.",
        "categories": ["state", "general"],
        "verification_note": "Confirm the current official domain and admission notices before applying.",
    },
    {
        "id": "uni-014",
        "name": "University of Kerala",
        "short_name": "KU",
        "state": "Kerala",
        "type": "State University",
        "website": "https://www.keralauniversity.ac.in/",
        "description": "Explore university departments, academic resources, and official announcements.",
        "categories": ["state", "general", "research"],
        "verification_note": "Check the latest programme-specific admission requirements.",
    },
    {
        "id": "uni-015",
        "name": "Indira Gandhi National Open University",
        "short_name": "IGNOU",
        "state": "Delhi",
        "type": "Open University",
        "website": "https://www.ignou.ac.in/",
        "description": "Explore distance and open-learning programmes, study resources, and admission information.",
        "categories": ["open", "distance", "general"],
        "verification_note": "Programme availability, eligibility, and admission windows can vary.",
    },
    {
        "id": "uni-016",
        "name": "Dr. A.P.J. Abdul Kalam Technical University",
        "short_name": "AKTU",
        "state": "Uttar Pradesh",
        "type": "State Technical University",
        "website": "https://aktu.ac.in/",
        "description": "Find technical education resources, university announcements, and programme information.",
        "categories": ["state", "engineering", "technology"],
        "verification_note": "Confirm current counselling, affiliation, and programme information through official sources.",
    },
    {
        "id": "uni-017",
        "name": "University of Rajasthan",
        "short_name": "RU",
        "state": "Rajasthan",
        "type": "State University",
        "website": "https://www.uniraj.ac.in/",
        "description": "Explore university departments, academic resources, and current notices.",
        "categories": ["state", "general"],
        "verification_note": "Consult the official prospectus and current notices for admission details.",
    },
    {
        "id": "uni-018",
        "name": "Panjab University",
        "short_name": "PU",
        "state": "Chandigarh",
        "type": "Public University",
        "website": "https://puchd.ac.in/",
        "description": "Review academic departments, programme resources, and university announcements.",
        "categories": ["public", "general", "research"],
        "verification_note": "Check current programme and eligibility details directly with the university.",
    },
]


COURSES = [
    {
        "id": "course-001",
        "name": "MBBS",
        "category": "medical",
        "level": "Undergraduate",
        "description": "Explore medical education, NEET UG eligibility, counselling, and admission resources.",
        "url": "../pages/medical-admissions.html",
        "official_source": "https://www.nmc.org.in/",
    },
    {
        "id": "course-002",
        "name": "BDS",
        "category": "medical",
        "level": "Undergraduate",
        "description": "Review dental education pathways and the relevant examination and counselling notices.",
        "url": "../pages/medical-admissions.html",
        "official_source": "https://www.nmc.org.in/",
    },
    {
        "id": "course-003",
        "name": "BAMS",
        "category": "medical",
        "level": "Undergraduate",
        "description": "Research Ayurveda education, applicable eligibility criteria, and official admission guidance.",
        "url": "../pages/admissions.html",
        "official_source": "https://ncismindia.org/",
    },
    {
        "id": "course-004",
        "name": "BUMS",
        "category": "medical",
        "level": "Undergraduate",
        "description": "Explore Unani medical education and verify current programme and admission requirements.",
        "url": "../pages/admissions.html",
        "official_source": "https://ncismindia.org/",
    },
    {
        "id": "course-005",
        "name": "B.Tech",
        "category": "engineering",
        "level": "Undergraduate",
        "description": "Compare engineering pathways, subject prerequisites, and institution-specific admission routes.",
        "url": "courses.html",
        "official_source": "https://www.aicte-india.org/",
    },
    {
        "id": "course-006",
        "name": "B.Sc.",
        "category": "science",
        "level": "Undergraduate",
        "description": "Explore science degrees and verify subject combinations and eligibility with each institution.",
        "url": "courses.html",
        "official_source": "https://www.ugc.gov.in/",
    },
    {
        "id": "course-007",
        "name": "BBA",
        "category": "management",
        "level": "Undergraduate",
        "description": "Review business and management programmes, admission requirements, and career pathways.",
        "url": "courses.html",
        "official_source": "https://www.ugc.gov.in/",
    },
    {
        "id": "course-008",
        "name": "MBA",
        "category": "management",
        "level": "Postgraduate",
        "description": "Research management programmes, entrance examinations, eligibility, and application deadlines.",
        "url": "courses.html",
        "official_source": "https://www.ugc.gov.in/",
    },
    {
        "id": "course-009",
        "name": "BCA",
        "category": "technology",
        "level": "Undergraduate",
        "description": "Explore computing degrees and check mathematics or other subject prerequisites.",
        "url": "courses.html",
        "official_source": "https://www.ugc.gov.in/",
    },
    {
        "id": "course-010",
        "name": "M.Sc.",
        "category": "science",
        "level": "Postgraduate",
        "description": "Compare postgraduate science programmes, specialisations, and entry requirements.",
        "url": "courses.html",
        "official_source": "https://www.ugc.gov.in/",
    },
    {
        "id": "course-011",
        "name": "Diploma programmes",
        "category": "vocational",
        "level": "Certificate / Diploma",
        "description": "Review vocational and diploma options with the relevant awarding or regulatory body.",
        "url": "courses.html",
        "official_source": "https://www.aicte-india.org/",
    },
    {
        "id": "course-012",
        "name": "Study abroad",
        "category": "international",
        "level": "Varies",
        "description": "Research international study routes, credential requirements, and official destination guidance.",
        "url": "../pages/study-abroad.html",
        "official_source": "https://www.education.gov.in/",
    },
]


RESOURCE_CATEGORIES = [
    {
        "id": "admissions",
        "title": "Admissions",
        "icon": "🎓",
        "description": "Understand applications, eligibility, counselling, and admission planning.",
        "href": "../pages/admissions.html",
    },
    {
        "id": "medical-admissions",
        "title": "Medical admissions",
        "icon": "🩺",
        "description": "Explore medical education and verify current official admission requirements.",
        "href": "../pages/medical-admissions.html",
    },
    {
        "id": "scholarships",
        "title": "Scholarships",
        "icon": "💰",
        "description": "Research funding opportunities, eligibility conditions, and official scheme portals.",
        "href": "../pages/scholarships.html",
    },
    {
        "id": "study-abroad",
        "title": "Study abroad",
        "icon": "🌍",
        "description": "Review international education planning, applications, and document preparation.",
        "href": "../pages/study-abroad.html",
    },
    {
        "id": "documents",
        "title": "Official documents",
        "icon": "📂",
        "description": "Prepare a document checklist and use verified official services.",
        "href": "../official-document.html",
    },
    {
        "id": "career",
        "title": "Career resources",
        "icon": "🚀",
        "description": "Explore career guidance, internships, recruitment, and professional preparation.",
        "href": "../career/index.html",
    },
]


FAQS = [
    {
        "question": "How do I verify whether a university is recognised?",
        "answer": "Check the appropriate official regulator or government authority, the university's official website, and the applicable programme or campus information. Recognition and programme approval are not interchangeable.",
    },
    {
        "question": "Does every university use the same admission process?",
        "answer": "No. Entry routes, entrance examinations, eligibility, selection criteria, application dates, and counselling arrangements vary by institution and programme.",
    },
    {
        "question": "Are the university records on this directory exhaustive?",
        "answer": "No. The initial catalog is a starter directory. It is not a complete national register and does not imply that every listed programme is currently available.",
    },
    {
        "question": "Can MedOrbits guarantee admission?",
        "answer": "No. Admission decisions are made by the competent institution or authority under its current rules. Always confirm eligibility and application details through official sources.",
    },
    {
        "question": "Can I use this directory for the current admission year?",
        "answer": "Use it as a discovery aid only. Verify the current year's prospectus, official notices, deadlines, fees, and application instructions before acting.",
    },
]


# ---------------------------------------------------------------------------
# Shared CSS
# ---------------------------------------------------------------------------

EDUCATION_CSS = r"""
:root {
  color-scheme: dark;
  --edu-bg: #050914;
  --edu-deep: #02040a;
  --edu-panel: #0b1730;
  --edu-panel-2: #10244a;
  --edu-blue: #3569d4;
  --edu-blue-light: #91baff;
  --edu-blue-bright: #d7e6ff;
  --edu-gold: #d8ad50;
  --edu-gold-bright: #ffe3a0;
  --edu-cream: #f7edda;
  --edu-text: #f3f6ff;
  --edu-soft: #d1dbee;
  --edu-muted: #9eacc6;
  --edu-border: rgba(145,186,255,.19);
  --edu-gold-border: rgba(216,173,80,.36);
  --edu-radius: 20px;
  --edu-width: 1200px;
}
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:100px}
body{margin:0;min-height:100vh;display:flex;flex-direction:column;overflow-x:hidden;background:var(--edu-bg);color:var(--edu-text);font:400 14px/1.75 "DM Sans",sans-serif;-webkit-font-smoothing:antialiased}
img{display:block;max-width:100%}
a{color:inherit;text-decoration:none}
button,input,select{font:inherit;color:inherit}
button,a{-webkit-tap-highlight-color:transparent}
[hidden]{display:none!important}
::selection{background:var(--edu-gold);color:#080d19}
a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--edu-gold-bright);outline-offset:4px}
.container{width:min(var(--edu-width),calc(100% - 40px));margin-inline:auto}
.skip-link{position:absolute;top:-80px;left:12px;z-index:9999;padding:10px 14px;border-radius:8px;background:var(--edu-gold-bright);color:#050914;font-weight:800}
.skip-link:focus{top:12px}
.announcement{position:relative;z-index:5;display:flex;justify-content:center;align-items:center;flex-wrap:wrap;gap:8px;padding:8px 12px;border-bottom:1px solid var(--edu-gold-border);background:#03060e;color:#e9d9b7;font-size:9px;font-weight:800;letter-spacing:.09em;text-align:center;text-transform:uppercase}
.announcement span:first-child{color:var(--edu-gold-bright)}
.site-header{position:sticky;top:0;z-index:1000;border-bottom:1px solid var(--edu-border);background:rgba(5,9,20,.96);backdrop-filter:blur(15px)}
.site-header.scrolled{background:#02040a;box-shadow:0 12px 35px rgba(0,0,0,.4)}
.nav-wrap{position:relative;min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:18px}
.brand{display:inline-flex;align-items:center;gap:10px;flex-shrink:0}
.brand-logo{width:46px;height:46px;flex:0 0 46px;object-fit:contain;filter:drop-shadow(0 0 9px rgba(216,173,80,.2))}
.brand strong{display:block;color:var(--edu-gold-bright);font-size:14px;font-weight:800;letter-spacing:.13em;line-height:1.35}
.brand small{display:block;color:#b7c6df;font-size:8px;letter-spacing:.06em;text-transform:uppercase}
.menu-toggle{display:none;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:8px 12px;border:1px solid var(--edu-border);border-radius:9px;background:var(--edu-panel);font-size:10px;font-weight:800;cursor:pointer}
.main-nav{display:flex;align-items:center;gap:17px;font-size:11px}
.main-nav>a:not(.btn){color:var(--edu-soft)}
.main-nav>a:hover{color:var(--edu-gold-bright)}
.nav-group{position:relative}
.nav-trigger{padding:10px 0;border:0;background:transparent;color:var(--edu-soft);font-size:11px;cursor:pointer}
.nav-trigger:hover{color:var(--edu-gold-bright)}
.nav-trigger span{color:var(--edu-gold)}
.dropdown{position:absolute;top:100%;left:-12px;display:none;width:225px;padding:8px;border:1px solid var(--edu-gold-border);border-radius:12px;background:#070c18;box-shadow:0 20px 50px rgba(0,0,0,.4)}
.nav-group.open .dropdown,.nav-group:focus-within .dropdown{display:grid}
.dropdown a{padding:9px 10px;border-radius:7px;color:var(--edu-soft);font-size:11px}
.dropdown a:hover{background:var(--edu-panel);color:var(--edu-gold-bright)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:43px;padding:10px 16px;border:1px solid transparent;border-radius:10px;background:linear-gradient(115deg,#f5d78d,#c29135);color:#14100a!important;font-size:11px;font-weight:800;text-align:center;cursor:pointer;transition:transform .2s ease,filter .2s ease}
.btn:hover{transform:translateY(-2px);filter:brightness(1.08)}
.btn-outline{border-color:rgba(145,186,255,.4);background:transparent;color:var(--edu-blue-bright)!important}
.btn-outline:hover{background:var(--edu-panel)}
.eyebrow{display:inline-flex;align-items:center;gap:9px;color:var(--edu-gold-bright);font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
.eyebrow:before{width:26px;height:2px;border-radius:3px;background:var(--edu-gold);content:""}
.gradient-text{color:var(--edu-gold-bright);background:linear-gradient(100deg,#fff0c7,#d8ad50,#a8c9ff,#ffe3a0);background-size:240% auto;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:edu-shimmer 8s ease-in-out infinite}
@keyframes edu-shimmer{0%,100%{background-position:0 center}50%{background-position:100% center}}
.hero{position:relative;isolation:isolate;padding:34px 0 57px;overflow:hidden;background:radial-gradient(ellipse at 80% 20%,rgba(53,105,212,.18),transparent 40%),linear-gradient(140deg,#0b1730,#050914 70%)}
.hero:after{position:absolute;z-index:-1;top:-150px;right:-120px;width:420px;height:420px;border:1px solid rgba(216,173,80,.14);border-radius:50%;box-shadow:0 0 0 45px rgba(145,186,255,.025),0 0 0 95px rgba(216,173,80,.025);content:"";animation:edu-orbit 40s linear infinite}
@keyframes edu-orbit{to{transform:rotate(360deg)}}
.breadcrumbs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px;color:var(--edu-muted);font-size:10px}
.breadcrumbs a{color:var(--edu-gold-bright)}
.hero-grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(250px,.9fr);align-items:center;gap:40px}
.hero h1{margin:15px 0;font-family:"Playfair Display",Georgia,serif;font-size:clamp(38px,5.3vw,65px);line-height:1.08;letter-spacing:-.04em;text-wrap:balance}
.hero-copy p{max-width:690px;color:#d5deef;font-size:13px;line-height:2}
.hero-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:23px}
.hero-art{position:relative;display:grid;place-items:center;min-height:310px;border:1px solid var(--edu-gold-border);border-radius:27px;background:radial-gradient(ellipse at center,rgba(53,105,212,.28),transparent 60%),#080d19;box-shadow:0 28px 70px rgba(0,0,0,.35);overflow:hidden}
.hero-art:before,.hero-art:after{position:absolute;width:230px;height:230px;border:1px solid rgba(216,173,80,.38);border-radius:50%;content:"";animation:edu-orbit 28s linear infinite}
.hero-art:after{width:285px;height:285px;border-style:dashed;border-color:rgba(145,186,255,.3);animation-direction:reverse;animation-duration:37s}
.hero-emoji{position:relative;z-index:2;font-size:clamp(95px,12vw,145px);filter:drop-shadow(0 15px 20px rgba(0,0,0,.4));animation:edu-float 5s ease-in-out infinite}
@keyframes edu-float{0%,100%{transform:translateY(-4px) rotate(-3deg)}50%{transform:translateY(-13px) rotate(3deg)}}
.art-label{position:absolute;z-index:3;bottom:17px;padding:8px 13px;border:1px solid var(--edu-gold-border);border-radius:100px;background:#050914;color:var(--edu-gold-bright);font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
.hero-badges{display:flex;flex-wrap:wrap;gap:8px;margin-top:19px}
.badge{display:inline-flex;align-items:center;width:fit-content;max-width:100%;padding:5px 9px;border:1px solid transparent;border-radius:100px;font-size:9px;font-weight:800;line-height:1.5;overflow-wrap:anywhere}
.badge-blue{border-color:rgba(145,186,255,.42);background:#102449;color:#d7e6ff}
.badge-gold{border-color:rgba(216,173,80,.45);background:#302514;color:#ffe8b1}
.badge-muted{border-color:rgba(255,255,255,.16);background:#111723;color:#e0e6f3}
.section{position:relative;z-index:1;padding:58px 0;background:var(--edu-bg)}
.section-blue{border-top:1px solid var(--edu-border);border-bottom:1px solid var(--edu-border);background:#070e1d}
.section-heading{margin-bottom:25px}
.section-title{margin:10px 0;font-family:"Playfair Display",Georgia,serif;font-size:clamp(28px,4vw,43px);line-height:1.2;letter-spacing:-.03em;text-wrap:balance}
.section-intro{max-width:790px;margin:0;color:var(--edu-muted);font-size:12px;line-height:2}
.stats-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.stat-card{padding:18px;border:1px solid var(--edu-border);border-radius:16px;background:linear-gradient(145deg,#0d1b36,#080d19)}
.stat-icon{display:grid;place-items:center;width:42px;height:42px;margin-bottom:12px;border:1px solid var(--edu-gold-border);border-radius:12px;background:#142447;font-size:21px}
.stat-card h3{margin:0 0 6px;font-family:"Playfair Display",Georgia,serif;font-size:18px;line-height:1.4}
.stat-card p{margin:0;color:var(--edu-muted);font-size:10px;line-height:1.85}
.search-panel{padding:clamp(20px,4vw,34px);border:1px solid var(--edu-gold-border);border-radius:22px;background:radial-gradient(ellipse at 100% 0,rgba(53,105,212,.17),transparent 45%),#0a1326}
.search-panel h2{margin:9px 0;font-family:"Playfair Display",Georgia,serif;font-size:clamp(24px,3vw,34px)}
.search-panel p{color:var(--edu-muted);font-size:12px}
.search-form{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;margin-top:18px}
.search-input,.filter-select{width:100%;min-width:0;min-height:46px;padding:11px 13px;border:1px solid var(--edu-border);border-radius:10px;background:#050914;color:var(--edu-text);font-size:12px}
.search-input::placeholder{color:#8292ad}
.search-feedback{min-height:22px;margin-top:10px;color:var(--edu-gold-bright);font-size:10px}
.toolbar{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px}
.filter-row{display:flex;flex-wrap:wrap;gap:8px}
.filter-button{padding:8px 12px;border:1px solid var(--edu-border);border-radius:100px;background:#0b1730;color:var(--edu-soft);font-size:10px;font-weight:800;cursor:pointer}
.filter-button[aria-pressed=true]{border-color:var(--edu-gold-border);background:#302514;color:var(--edu-gold-bright)}
.result-count{color:var(--edu-muted);font-size:10px}
.card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}
.directory-card{display:flex;flex-direction:column;min-width:0;min-height:255px;padding:20px;border:1px solid var(--edu-border);border-radius:17px;background:linear-gradient(150deg,#0c1a34,#080d19);transition:transform .22s ease,border-color .22s ease}
.directory-card:hover{transform:translateY(-3px);border-color:var(--edu-gold-border)}
.card-icon{display:grid;place-items:center;width:49px;height:49px;margin-bottom:13px;border:1px solid var(--edu-gold-border);border-radius:14px;background:#142447;font-size:25px}
.directory-card h3{margin:10px 0 7px;font-family:"Playfair Display",Georgia,serif;font-size:19px;line-height:1.4}
.directory-card p{margin:0;color:var(--edu-muted);font-size:11px;line-height:1.9}
.card-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:11px}
.card-link{display:inline-flex;align-items:center;gap:6px;margin-top:auto;padding-top:17px;color:var(--edu-gold-bright);font-size:10px;font-weight:800;overflow-wrap:anywhere}
.card-link:hover{color:var(--edu-blue-bright)}
.empty-state{padding:25px;border:1px dashed var(--edu-gold-border);border-radius:15px;color:var(--edu-muted);text-align:center}
.notice{display:grid;grid-template-columns:auto minmax(0,1fr);gap:14px;padding:21px;border:1px solid var(--edu-gold-border);border-radius:17px;background:linear-gradient(130deg,#171c2b,#0a1326)}
.notice-icon{display:grid;place-items:center;width:46px;height:46px;border:1px solid var(--edu-gold-border);border-radius:13px;background:#302514;font-size:22px}
.notice h3{margin:0 0 7px;color:var(--edu-gold-bright);font-family:"Playfair Display",Georgia,serif;font-size:19px}
.notice p{margin:0;color:var(--edu-soft);font-size:11px;line-height:1.9}
.two-col{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.info-card{padding:21px;border:1px solid var(--edu-border);border-radius:16px;background:linear-gradient(145deg,#0d1b36,#080d19)}
.info-card h3{margin:0 0 10px;font-family:"Playfair Display",Georgia,serif;font-size:19px}
.info-card p,.info-card li{color:var(--edu-muted);font-size:11px;line-height:1.9}
.info-card ul{padding-left:19px}
.info-card li::marker{color:var(--edu-gold)}
.source-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}
.source-link{display:flex;align-items:flex-start;gap:12px;padding:15px;border:1px solid var(--edu-border);border-radius:13px;background:#0b1730;transition:border-color .2s ease}
.source-link:hover{border-color:var(--edu-gold-border)}
.source-icon{display:grid;place-items:center;width:40px;height:40px;flex:0 0 40px;border:1px solid var(--edu-gold-border);border-radius:11px;background:#142447;font-size:20px}
.source-link strong{display:block;margin-bottom:4px;color:var(--edu-cream);font-size:11px}
.source-link span{display:block;color:var(--edu-muted);font-size:10px;line-height:1.8;overflow-wrap:anywhere}
.source-link em{display:block;margin-top:6px;color:var(--edu-gold-bright);font-size:10px;font-style:normal;font-weight:800}
.faq-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}
.faq-item{border:1px solid var(--edu-border);border-radius:13px;background:#0b1730;overflow:hidden}
.faq-item summary{position:relative;padding:15px 38px 15px 15px;color:var(--edu-cream);font-size:11px;font-weight:800;cursor:pointer;list-style:none}
.faq-item summary::-webkit-details-marker{display:none}
.faq-item summary:after{position:absolute;top:50%;right:14px;color:var(--edu-gold-bright);font-size:18px;content:"+";transform:translateY(-50%)}
.faq-item[open] summary:after{content:"−"}
.faq-answer{padding:0 15px 15px;color:var(--edu-muted);font-size:11px;line-height:1.9}
.cta-panel{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:24px;padding:clamp(24px,4vw,42px);border:1px solid var(--edu-gold-border);border-radius:22px;background:radial-gradient(ellipse at 85% 15%,rgba(53,105,212,.2),transparent 45%),linear-gradient(140deg,#101d37,#070b15)}
.cta-panel h2{margin:10px 0;font-family:"Playfair Display",Georgia,serif;font-size:clamp(27px,4vw,42px);line-height:1.2}
.cta-panel p{max-width:720px;color:var(--edu-soft);font-size:12px;line-height:2}
.cta-emoji{font-size:clamp(65px,10vw,110px);animation:edu-float 5s ease-in-out infinite}
.cta-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}
.site-footer{position:relative;z-index:2;margin-top:auto;padding:33px 0 0;border-top:1px solid var(--edu-border);background:#02040a}
.footer-grid{display:grid;grid-template-columns:1.4fr repeat(4,minmax(0,1fr));gap:20px;padding-bottom:24px}
.footer-brand p{max-width:290px;color:var(--edu-muted);font-size:10px;line-height:1.9}
.footer-grid h2{margin:0 0 11px;padding-bottom:8px;border-bottom:1px solid var(--edu-border);color:var(--edu-gold-bright);font-size:9px;letter-spacing:.1em;text-transform:uppercase}
.footer-links a{display:block;margin:8px 0;color:var(--edu-muted);font-size:10px;overflow-wrap:anywhere}
.footer-links a:hover{color:var(--edu-gold-bright)}
.footer-disclaimer{margin:0 0 14px;padding:13px 14px;border-left:2px solid var(--edu-gold);border-radius:0 7px 7px 0;background:#080d19;color:var(--edu-muted);font-size:10px;line-height:1.9}
.footer-bottom{display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;padding:15px 0;border-top:1px solid var(--edu-border);color:var(--edu-muted);font-size:9px}
@media(max-width:1100px){
 .menu-toggle{display:inline-flex}
 .main-nav{position:absolute;top:100%;right:0;left:0;display:none;align-items:stretch;flex-direction:column;gap:3px;max-height:calc(100dvh - 85px);padding:13px 18px 18px;overflow:auto;border:1px solid var(--edu-border);border-top:0;border-radius:0 0 14px 14px;background:#030711;box-shadow:0 20px 45px rgba(0,0,0,.5)}
 .main-nav.open{display:flex}
 .main-nav>a,.nav-trigger{display:block;width:100%;padding:10px 7px;text-align:left}
 .dropdown{position:static;width:100%;margin-bottom:4px;box-shadow:none}
 .footer-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
 .footer-brand{grid-column:1/-1}
 .card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
 .stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(max-width:800px){
 .container{width:calc(100% - 30px)}
 .hero{padding:26px 0 42px}
 .hero-grid{grid-template-columns:minmax(0,1fr);gap:22px}
 .hero-art{order:-1;min-height:250px}
 .hero-emoji{font-size:110px}
 .section{padding:45px 0}
 .cta-panel{grid-template-columns:minmax(0,1fr)}
 .cta-emoji{display:none}
}
@media(max-width:560px){
 .container{width:calc(100% - 24px)}
 .announcement{font-size:8px;letter-spacing:.025em}
 .nav-wrap{min-height:67px;gap:8px}
 .brand{gap:7px}
 .brand-logo{width:38px;height:38px;flex-basis:38px}
 .brand strong{font-size:12px}
 .brand small{font-size:7px}
 .menu-toggle{min-height:37px;padding:7px 9px}
 .hero h1{font-size:clamp(35px,9vw,46px)}
 .hero-copy p{font-size:12px}
 .hero-actions,.cta-actions{flex-direction:column}
 .hero-actions .btn,.cta-actions .btn{width:100%}
 .hero-art{min-height:220px}
 .hero-art:before{width:175px;height:175px}
 .hero-art:after{width:220px;height:220px}
 .section-title{font-size:29px}
 .card-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
 .directory-card{min-height:250px;padding:12px;border-radius:14px}
 .card-icon{width:40px;height:40px;font-size:20px}
 .directory-card h3{font-size:15px}
 .directory-card p{font-size:10px;line-height:1.75}
 .directory-card .badge{font-size:8px;padding:4px 7px}
 .card-link{font-size:9px}
 .stats-grid{gap:8px}
 .stat-card{padding:12px}
 .stat-card h3{font-size:15px}
 .stat-card p{font-size:9px}
 .search-form{grid-template-columns:minmax(0,1fr)}
 .search-form .btn{width:100%}
 .two-col,.source-grid,.faq-grid{grid-template-columns:minmax(0,1fr)}
 .notice{grid-template-columns:minmax(0,1fr)}
 .footer-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 13px}
 .footer-brand{grid-column:1/-1}
 .footer-bottom{flex-direction:column}
}
@media(max-width:350px){
 .container{width:calc(100% - 20px)}
 .brand-logo{width:34px;height:34px;flex-basis:34px}
 .brand strong{font-size:11px}
 .brand small{font-size:6px}
 .card-grid{gap:6px}
 .directory-card{padding:9px}
 .directory-card h3{font-size:14px}
 .directory-card p{font-size:9px}
}
@media(hover:none){.directory-card:hover,.btn:hover{transform:none}}
@media(prefers-reduced-motion:reduce){
 html{scroll-behavior:auto}
 *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}
}
@media(forced-colors:active){.gradient-text{color:CanvasText;background:none;-webkit-text-fill-color:currentColor}.btn,.directory-card{border:1px solid ButtonText}}
"""


# ---------------------------------------------------------------------------
# Shared JavaScript
# ---------------------------------------------------------------------------

EDUCATION_JS = r"""
(() => {
  "use strict";

  const header = document.getElementById("siteHeader");
  const menuToggle = document.getElementById("menuToggle");
  const mainNav = document.getElementById("mainNav");
  const groups = Array.from(document.querySelectorAll(".nav-group"));
  const desktop = window.matchMedia("(min-width: 1101px)");

  const year = document.getElementById("currentYear");
  if (year) year.textContent = String(new Date().getFullYear());

  function setMenu(open) {
    if (!menuToggle || !mainNav) return;
    mainNav.classList.toggle("open", open);
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute(
      "aria-label",
      open ? "Close navigation menu" : "Open navigation menu"
    );
    const label = menuToggle.querySelector(".menu-label");
    const symbol = menuToggle.querySelector(".menu-symbol");
    if (label) label.textContent = open ? "CLOSE" : "MENU";
    if (symbol) symbol.textContent = open ? "×" : "☰";
  }

  function closeGroups(except = null) {
    groups.forEach(group => {
      if (group === except) return;
      group.classList.remove("open");
      const button = group.querySelector(".nav-trigger");
      if (button) button.setAttribute("aria-expanded", "false");
    });
  }

  function closeNavigation() {
    setMenu(false);
    closeGroups();
  }

  if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", () => {
      setMenu(!mainNav.classList.contains("open"));
    });

    groups.forEach(group => {
      const button = group.querySelector(".nav-trigger");
      if (!button) return;

      button.addEventListener("click", event => {
        event.stopPropagation();
        const shouldOpen = !group.classList.contains("open");
        closeGroups();
        if (shouldOpen) {
          group.classList.add("open");
          button.setAttribute("aria-expanded", "true");
        }
      });
    });

    mainNav.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", closeNavigation);
    });

    document.addEventListener("click", event => {
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest(".nav-group")) closeGroups();

      if (
        mainNav.classList.contains("open") &&
        !event.target.closest("#mainNav") &&
        !event.target.closest("#menuToggle")
      ) {
        closeNavigation();
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeNavigation();
    });

    const onBreakpoint = event => {
      if (event.matches) closeNavigation();
    };

    if (typeof desktop.addEventListener === "function") {
      desktop.addEventListener("change", onBreakpoint);
    } else {
      desktop.addListener(onBreakpoint);
    }
  }

  function updateHeader() {
    if (header) header.classList.toggle("scrolled", window.scrollY > 20);
  }
  window.addEventListener("scroll", updateHeader, { passive: true });
  updateHeader();

  const cards = Array.from(document.querySelectorAll("[data-directory-card]"));
  const filters = Array.from(document.querySelectorAll("[data-filter]"));
  const searchForm = document.getElementById("directorySearch");
  const searchInput = document.getElementById("directoryQuery");
  const stateSelect = document.getElementById("stateFilter");
  const count = document.getElementById("resultCount");
  const empty = document.getElementById("emptyState");
  const feedback = document.getElementById("directoryFeedback");

  let activeFilter = "all";
  let activeQuery = "";

  function updateDirectory() {
    let shown = 0;
    const selectedState = stateSelect ? stateSelect.value : "";

    cards.forEach(card => {
      const category = card.dataset.category || "";
      const state = card.dataset.state || "";
      const text = (
        (card.dataset.search || "") + " " + card.textContent
      ).toLowerCase();

      const categoryMatch =
        activeFilter === "all" || category.split(/\s+/).includes(activeFilter);
      const queryMatch = !activeQuery || text.includes(activeQuery);
      const stateMatch = !selectedState || state === selectedState;
      const visible = categoryMatch && queryMatch && stateMatch;

      card.hidden = !visible;
      if (visible) shown += 1;
    });

    if (count) {
      count.textContent = shown + (shown === 1 ? " result" : " results");
    }
    if (empty) empty.hidden = shown !== 0;
    return shown;
  }

  filters.forEach(button => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter || "all";
      filters.forEach(item => {
        item.setAttribute("aria-pressed", String(item === button));
      });
      updateDirectory();
    });
  });

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      activeQuery = searchInput.value.trim().toLowerCase();
      const shown = updateDirectory();
      if (feedback) {
        feedback.textContent = !activeQuery
          ? ""
          : shown
            ? "Matching results are displayed below."
            : "No matches. Try another keyword or reset the filters.";
      }
    });
  }

  if (stateSelect) {
    stateSelect.addEventListener("change", updateDirectory);
  }

  if (searchForm) {
    searchForm.addEventListener("submit", event => {
      event.preventDefault();
      activeQuery = searchInput ? searchInput.value.trim().toLowerCase() : "";
      const shown = updateDirectory();

      if (feedback) {
        feedback.textContent = shown
          ? "Matching results are displayed below."
          : "No results found. Try another search.";
      }

      const target = document.getElementById("directoryResults");
      if (target) {
        target.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "start"
        });
      }
    });
  }

  document.querySelectorAll("[data-search-term]").forEach(button => {
    button.addEventListener("click", () => {
      if (!searchInput) return;
      searchInput.value = button.dataset.searchTerm || "";
      activeQuery = searchInput.value.trim().toLowerCase();
      const shown = updateDirectory();
      if (feedback) {
        feedback.textContent = shown
          ? "Matching results are displayed below."
          : "No results found. Try another keyword.";
      }
    });
  });

  const reset = document.getElementById("resetFilters");
  if (reset) {
    reset.addEventListener("click", () => {
      activeFilter = "all";
      activeQuery = "";
      if (searchInput) searchInput.value = "";
      if (stateSelect) stateSelect.value = "";
      filters.forEach(button => {
        button.setAttribute(
          "aria-pressed",
          String((button.dataset.filter || "all") === "all")
        );
      });
      if (feedback) feedback.textContent = "";
      updateDirectory();
    });
  }

  updateDirectory();
})();
"""


# ---------------------------------------------------------------------------
# HTML generation
# ---------------------------------------------------------------------------

def e(value: Any) -> str:
    """Escape basic HTML text and attribute content."""
    text = str(value)
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


def header_html(active: str = "education") -> str:
    """Shared navigation. Links are relative to /education/."""
    return f"""
<a class="skip-link" href="#main-content">Skip to main content</a>
<div class="announcement">
  <span>MedOrbits</span><span aria-hidden="true">✦</span>
  Education · Admissions · Universities · Opportunities
</div>
<header class="site-header" id="siteHeader">
  <div class="container nav-wrap">
    <a class="brand" href="../index.html" aria-label="MedOrbits home">
      <img class="brand-logo" src="../assets/images/logo/medorbits-logo.png"
           alt="MedOrbits logo" width="46" height="46">
      <span><strong>MEDORBITS</strong><small>Education · Career · Opportunities</small></span>
    </a>
    <button class="menu-toggle" id="menuToggle" type="button"
      aria-expanded="false" aria-controls="mainNav" aria-label="Open navigation menu">
      <span class="menu-symbol" aria-hidden="true">☰</span>
      <span class="menu-label">MENU</span>
    </button>
    <nav class="main-nav" id="mainNav" aria-label="Main navigation">
      <a href="index.html" {"aria-current='page'" if active == "education" else ""}>Education</a>
      <div class="nav-group">
        <button class="nav-trigger" type="button" aria-expanded="false" aria-controls="universityDropdown">Directories <span aria-hidden="true">⌄</span></button>
        <div class="dropdown" id="universityDropdown">
          <a href="universities.html">Universities</a>
          <a href="colleges.html">Colleges</a>
          <a href="courses.html">Courses</a>
          <a href="entrance-exams.html">Entrance examinations</a>
        </div>
      </div>
      <div class="nav-group">
        <button class="nav-trigger" type="button" aria-expanded="false" aria-controls="admissionsDropdown">Admissions <span aria-hidden="true">⌄</span></button>
        <div class="dropdown" id="admissionsDropdown">
          <a href="admissions.html">Admission guide</a>
          <a href="medical-admissions.html">Medical admissions</a>
          <a href="scholarships.html">Scholarships</a>
          <a href="study-abroad.html">Study abroad</a>
          <a href="documents.html">Document resources</a>
        </div>
      </div>
      <a href="../career/index.html">Careers</a>
      <a href="../pages/contact.html">Contact</a>
      <a class="btn" href="../pages/support.html">Get guidance ↗</a>
    </nav>
  </div>
</header>
"""


def footer_html() -> str:
    return """
<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <a class="brand" href="../index.html" aria-label="MedOrbits home">
          <img class="brand-logo" src="../assets/images/logo/medorbits-logo.png"
               alt="MedOrbits logo" width="46" height="46" loading="lazy">
          <span><strong>MEDORBITS</strong><small>Education · Career · Opportunities</small></span>
        </a>
        <p>Explore education pathways, institutions, courses, admission guidance and career resources through MedOrbits.</p>
      </div>
      <div class="footer-links">
        <h2>Education</h2>
        <a href="index.html">Education hub</a>
        <a href="universities.html">Universities</a>
        <a href="colleges.html">Colleges</a>
        <a href="courses.html">Courses</a>
        <a href="entrance-exams.html">Entrance exams</a>
      </div>
      <div class="footer-links">
        <h2>Admissions</h2>
        <a href="admissions.html">Admission guide</a>
        <a href="medical-admissions.html">Medical admissions</a>
        <a href="scholarships.html">Scholarships</a>
        <a href="study-abroad.html">Study abroad</a>
        <a href="documents.html">Document resources</a>
      </div>
      <div class="footer-links">
        <h2>Careers</h2>
        <a href="../career/index.html">Career hub</a>
        <a href="../career/jobs.html">Job resources</a>
        <a href="../career/internships.html">Internships</a>
        <a href="../career/recruitment.html">Recruitment</a>
      </div>
      <div class="footer-links">
        <h2>Support</h2>
        <a href="../pages/about.html">About MedOrbits</a>
        <a href="../pages/support.html">Support centre</a>
        <a href="../pages/contact.html">Contact</a>
        <a href="../legal/privacy-policy.html">Privacy policy</a>
        <a href="../pages/disclaimer.html">Disclaimer</a>
      </div>
    </div>
    <p class="footer-disclaimer">
      Educational information is provided for general guidance. Listings are not
      exhaustive and do not guarantee recognition, admission, eligibility or
      programme availability. Confirm current requirements through the relevant
      official university, regulator, examination body or government authority.
      External websites operate under their own policies.
    </p>
    <div class="footer-bottom">
      <span>© <span id="currentYear"></span> MedOrbits. All rights reserved.</span>
      <span>LEARN · EXPLORE · VERIFY</span>
    </div>
  </div>
</footer>
"""


def page_shell(
    *,
    title: str,
    description: str,
    canonical: str,
    content: str,
    active: str = "education",
    schema: dict[str, Any] | None = None,
) -> str:
    schema_data = schema or {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": title,
        "url": canonical,
        "description": description,
        "inLanguage": "en-IN",
        "isPartOf": {
            "@type": "WebSite",
            "name": "MedOrbits",
            "url": SITE_URL + "/",
        },
        "publisher": {
            "@type": "Organization",
            "name": "MedOrbits",
            "url": SITE_URL + "/",
        },
    }

    schema_script = json.dumps(schema_data, ensure_ascii=False).replace("</", "<\\/")

    return f"""<!doctype html>
<html lang="en-IN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#050914">
  <meta name="description" content="{e(description)}">
  <meta name="author" content="MedOrbits">
  <meta name="robots" content="index, follow">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <title>{e(title)}</title>
  <link rel="canonical" href="{e(canonical)}">
  <link rel="icon" href="../assets/images/logo/medorbits-logo.png" type="image/png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/education.css">
  <script type="application/ld+json">{schema_script}</script>
</head>
<body>
{header_html(active)}
<main id="main-content">
{content}
</main>
{footer_html()}
<script src="assets/js/education.js" defer></script>
</body>
</html>
"""


def hero_html(
    title: str,
    description: str,
    emoji: str,
    breadcrumb: str,
    primary_href: str = "#directoryResults",
    primary_label: str = "Explore resources",
) -> str:
    return f"""
<section class="hero" aria-labelledby="pageTitle">
  <div class="container">
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="../index.html">Home</a><span aria-hidden="true">›</span>
      <a href="index.html">Education</a><span aria-hidden="true">›</span>
      <span aria-current="page">{e(breadcrumb)}</span>
    </nav>
    <div class="hero-grid">
      <div class="hero-copy">
        <span class="eyebrow">MedOrbits education directory</span>
        <h1 id="pageTitle">{title}</h1>
        <p>{e(description)}</p>
        <div class="hero-actions">
          <a class="btn" href="{e(primary_href)}">{e(primary_label)} ↗</a>
          <a class="btn btn-outline" href="#officialSources">Official resources</a>
        </div>
        <div class="hero-badges">
          <span class="badge badge-blue">🎓 Education</span>
          <span class="badge badge-gold">✦ Plan carefully</span>
          <span class="badge badge-muted">🔎 Verify officially</span>
        </div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <span class="hero-emoji">{emoji}</span>
        <span class="art-label">Explore · Compare · Verify</span>
      </div>
    </div>
  </div>
</section>
"""


def card_html(
    *,
    icon: str,
    label: str,
    title: str,
    description: str,
    href: str,
    category: str = "general",
    state: str = "",
    search: str = "",
    meta: str = "",
    link_label: str = "Explore details",
) -> str:
    search_value = " ".join(
        [title, description, category, state, search, meta]
    ).lower()

    return f"""
<article class="directory-card"
  data-directory-card
  data-category="{e(category)}"
  data-state="{e(state)}"
  data-search="{e(search_value)}">
  <div class="card-icon" aria-hidden="true">{icon}</div>
  <span class="badge badge-blue">{e(label)}</span>
  <h3>{e(title)}</h3>
  <p>{e(description)}</p>
  {f'<div class="card-meta"><span class="badge badge-muted">{e(meta)}</span></div>' if meta else ''}
  <a class="card-link" href="{e(href)}">{e(link_label)} ↗</a>
</article>
"""


def directory_controls(
    *,
    placeholder: str,
    filters: list[tuple[str, str]],
    include_state: bool = False,
    states: list[str] | None = None,
) -> str:
    filter_buttons = "".join(
        f'<button class="filter-button" type="button" data-filter="{e(value)}" '
        f'aria-pressed="{str(value == "all").lower()}">{e(label)}</button>'
        for value, label in filters
    )

    state_control = ""
    if include_state:
        options = "".join(
            f'<option value="{e(state)}">{e(state)}</option>'
            for state in (states or [])
        )
        state_control = (
            '<label class="filter-label" for="stateFilter">'
            '<span class="visually-hidden">Filter by state</span>'
            '<select class="filter-select" id="stateFilter">'
            '<option value="">All states</option>'
            f"{options}</select></label>"
        )

    return f"""
<section class="section section-blue" aria-labelledby="searchHeading">
  <div class="container">
    <div class="search-panel">
      <span class="eyebrow">Search the directory</span>
      <h2 id="searchHeading">Find your next education resource.</h2>
      <p>Search by name, state, category or keyword. Confirm important details with the relevant official source.</p>
      <form class="search-form" id="directorySearch" role="search">
        <label class="visually-hidden" for="directoryQuery">Search directory</label>
        <input class="search-input" id="directoryQuery" type="search"
          maxlength="120" placeholder="{e(placeholder)}">
        <button class="btn" type="submit">Search ↗</button>
      </form>
      <div class="toolbar" style="margin-top:14px;margin-bottom:0">
        <div class="filter-row" role="group" aria-label="Directory category filters">
          {filter_buttons}
        </div>
        {state_control}
      </div>
      <div class="search-feedback" id="directoryFeedback" role="status" aria-live="polite"></div>
    </div>
  </div>
</section>
"""


def results_section(cards: str, heading: str, intro: str) -> str:
    return f"""
<section class="section" id="directoryResults" aria-labelledby="resultsHeading">
  <div class="container">
    <div class="section-heading">
      <span class="eyebrow">Directory results</span>
      <h2 class="section-title" id="resultsHeading">{heading}</h2>
      <p class="section-intro">{e(intro)}</p>
    </div>
    <div class="toolbar">
      <span class="result-count" id="resultCount" aria-live="polite">Loading results…</span>
      <button class="filter-button" type="button" id="resetFilters">Reset filters</button>
    </div>
    <div class="card-grid">{cards}</div>
    <p class="empty-state" id="emptyState" hidden>No matching results. Try a different keyword or reset the filters.</p>
  </div>
</section>
"""


def notice_section(title: str, message: str) -> str:
    return f"""
<section class="section section-blue">
  <div class="container">
    <div class="notice">
      <div class="notice-icon" aria-hidden="true">⚠️</div>
      <div><h3>{e(title)}</h3><p>{e(message)}</p></div>
    </div>
  </div>
</section>
"""


def official_sources_section() -> str:
    sources = [
        ("🇮🇳", "University Grants Commission (UGC)", "Official higher-education regulator resources.", "https://www.ugc.gov.in/"),
        ("⚙️", "All India Council for Technical Education", "Consult official technical education information.", "https://www.aicte-india.org/"),
        ("🩺", "National Medical Commission", "Consult official medical education regulatory information.", "https://www.nmc.org.in/"),
        ("📚", "Ministry of Education", "Explore official national education information.", "https://www.education.gov.in/"),
        ("📝", "National Testing Agency", "Find examination notices and official examination services.", "https://nta.ac.in/"),
        ("💰", "National Scholarship Portal", "Check scholarship scheme information and portal notices.", "https://scholarships.gov.in/"),
    ]

    items = "".join(
        f"""
<a class="source-link" href="{e(url)}" target="_blank" rel="noopener noreferrer">
  <span class="source-icon" aria-hidden="true">{icon}</span>
  <span><strong>{e(title)}</strong><span>{e(desc)}</span><em>Visit official website ↗</em></span>
</a>"""
        for icon, title, desc, url in sources
    )

    return f"""
<section class="section section-blue" id="officialSources" aria-labelledby="officialSourcesTitle">
  <div class="container">
    <div class="section-heading">
      <span class="eyebrow">Trusted starting points</span>
      <h2 class="section-title" id="officialSourcesTitle">Verify with official sources.</h2>
      <p class="section-intro">Use the relevant regulator, government department, examination authority, or institution for current rules and programme details.</p>
    </div>
    <div class="source-grid">{items}</div>
  </div>
</section>
"""


def faq_section() -> str:
    items = "".join(
        f'<details class="faq-item"><summary>{e(item["question"])}</summary>'
        f'<div class="faq-answer">{e(item["answer"])}</div></details>'
        for item in FAQS
    )

    return f"""
<section class="section section-blue" aria-labelledby="faqTitle">
  <div class="container">
    <div class="section-heading">
      <span class="eyebrow">Frequently asked questions</span>
      <h2 class="section-title" id="faqTitle">Make informed education decisions.</h2>
      <p class="section-intro">General guidance for researching institutions and programmes.</p>
    </div>
    <div class="faq-grid">{items}</div>
  </div>
</section>
"""


def cta_section() -> str:
    return """
<section class="section">
  <div class="container">
    <div class="cta-panel">
      <div>
        <span class="eyebrow">Your next step</span>
        <h2>Plan your education journey with clarity.</h2>
        <p>Explore courses, institutions, admissions, scholarships, and career resources. Verify all important decisions with the relevant official authority.</p>
        <div class="cta-actions">
          <a class="btn" href="admissions.html">Admission guidance ↗</a>
          <a class="btn btn-outline" href="../pages/contact.html">Contact MedOrbits</a>
        </div>
      </div>
      <div class="cta-emoji" aria-hidden="true">🎓</div>
    </div>
  </div>
</section>
"""


def make_university_page() -> str:
    states = sorted({item["state"] for item in UNIVERSITIES})

    cards = "".join(
        card_html(
            icon="🏛️",
            label=item["type"],
            title=item["name"],
            description=item["description"],
            href=item["website"],
            category=" ".join(item["categories"]),
            state=item["state"],
            search=item["short_name"] + " " + item["verification_note"],
            meta=item["state"],
            link_label="Official university website",
        )
        for item in UNIVERSITIES
    )

    content = (
        hero_html(
            "Explore universities.<br><span class='gradient-text'>Choose with confidence.</span>",
            "Discover a starter directory of universities in India. Compare broad institution types, explore official websites, and verify current programmes, recognition, eligibility, fees, and admissions directly with the relevant authority.",
            "🏛️",
            "Universities",
            "#directoryResults",
            "Browse universities",
        )
        + """
<section class="section" aria-label="University directory overview">
  <div class="container">
    <div class="stats-grid">
      <article class="stat-card"><div class="stat-icon" aria-hidden="true">🏛️</div><h3>Institution discovery</h3><p>Explore university websites and institutional information.</p></article>
      <article class="stat-card"><div class="stat-icon" aria-hidden="true">🗺️</div><h3>Across regions</h3><p>Use the state filter to narrow your initial research.</p></article>
      <article class="stat-card"><div class="stat-icon" aria-hidden="true">🎓</div><h3>Programme research</h3><p>Confirm the availability of each course with its institution.</p></article>
      <article class="stat-card"><div class="stat-icon" aria-hidden="true">🔎</div><h3>Official verification</h3><p>Check regulators and current official notifications.</p></article>
    </div>
  </div>
</section>
"""
        + directory_controls(
            placeholder="Search university, state, institution type or subject...",
            filters=[
                ("all", "All"),
                ("central", "Central"),
                ("state", "State"),
                ("open", "Open learning"),
                ("engineering", "Engineering"),
                ("medical", "Medical"),
                ("research", "Research"),
            ],
            include_state=True,
            states=states,
        )
        + results_section(
            cards,
            "University directory",
            "This starter directory is for discovery and is not an exhaustive national register. Use official sources to confirm current details.",
        )
        + notice_section(
            "Verify recognition and programme approval separately",
            "Institution status, campus details, programme approval, professional recognition, and admission eligibility can involve different authorities. Do not treat a directory listing as proof of recognition or eligibility.",
        )
        + official_sources_section()
        + faq_section()
        + cta_section()
    )

    schema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "University Directory | MedOrbits",
        "url": f"{EDUCATION_URL}/universities.html",
        "description": "Explore a starter directory of universities in India and verify current information through official websites.",
        "inLanguage": "en-IN",
        "isPartOf": {"@type": "WebSite", "name": "MedOrbits", "url": SITE_URL + "/"},
        "mainEntity": {
            "@type": "ItemList",
            "numberOfItems": len(UNIVERSITIES),
            "itemListElement": [
                {
                    "@type": "ListItem",
                    "position": index,
                    "name": item["name"],
                    "url": item["website"],
                }
                for index, item in enumerate(UNIVERSITIES, start=1)
            ],
        },
    }

    return page_shell(
        title="University Directory in India | MedOrbits",
        description="Explore a starter directory of Indian universities, official websites, institution types, and education resources.",
        canonical=f"{EDUCATION_URL}/universities.html",
        content=content,
        active="education",
        schema=schema,
    )


def make_courses_page() -> str:
    cards = "".join(
        card_html(
            icon={
                "medical": "🩺",
                "engineering": "⚙️",
                "science": "🔬",
                "management": "📊",
                "technology": "💻",
                "vocational": "🧰",
                "international": "🌍",
            }.get(item["category"], "🎓"),
            label=item["level"],
            title=item["name"],
            description=item["description"],
            href=item["url"],
            category=item["category"],
            state="",
            search=item["level"] + " " + item["official_source"],
            meta=item["category"].title(),
            link_label="Explore course",
        )
        for item in COURSES
    )

    content = (
        hero_html(
            "Find a course.<br><span class='gradient-text'>Map your future.</span>",
            "Explore a starter catalog of medical, engineering, science, management, technology, vocational, and international education pathways. Use each course as a starting point and verify its current entry requirements with the relevant institution and regulator.",
            "📚",
            "Courses",
        )
        + directory_controls(
            placeholder="Search MBBS, BDS, B.Tech, BBA, MBA, science...",
            filters=[
                ("all", "All courses"),
                ("medical", "Medical"),
                ("engineering", "Engineering"),
                ("science", "Science"),
                ("management", "Management"),
                ("technology", "Technology"),
                ("international", "International"),
            ],
        )
        + results_section(
            cards,
            "Browse course pathways",
            "Course names are discovery categories, not confirmation of current availability or eligibility at a specific institution.",
        )
        + notice_section(
            "Check the applicable regulator",
            "Professional programmes can have specific eligibility and regulatory requirements. Confirm course recognition, current rules, and the relevant admission route before making an application.",
        )
        + official_sources_section()
        + faq_section()
        + cta_section()
    )

    return page_shell(
        title="Courses and Education Pathways | MedOrbits",
        description="Explore course pathways across medical, engineering, science, management, technology, and international education.",
        canonical=f"{EDUCATION_URL}/courses.html",
        content=content,
    )


def make_resource_page(page: dict[str, str]) -> str:
    cards = "".join(
        card_html(
            icon=item["icon"],
            label="Education resource",
            title=item["title"],
            description=item["description"],
            href=item["href"],
            category="general",
            search=item["id"],
            meta="Guidance",
            link_label="Explore resource",
        )
        for item in RESOURCE_CATEGORIES
    )

    content = (
        hero_html(
            e(page["headline"]),
            page["description"],
            page["emoji"],
            page["label"],
        )
        + """
<section class="section" aria-label="Education resource overview">
  <div class="container">
    <div class="two-col">
      <article class="info-card"><h3>Research before you apply</h3><p>Read the current official prospectus, eligibility rules, application steps, fees, deadlines, and document requirements before submitting an application.</p></article>
      <article class="info-card"><h3>Keep a verification record</h3><p>Save official notices, application acknowledgements, and payment receipts securely. Recheck important information when the admission year or programme changes.</p></article>
    </div>
  </div>
</section>
"""
        + directory_controls(
            placeholder="Search admissions, scholarships, medical courses...",
            filters=[("all", "All resources"), ("general", "Education resources")],
        )
        + results_section(
            cards,
            "Explore related resources",
            "Choose the relevant topic and verify details with the official institution or authority.",
        )
        + official_sources_section()
        + faq_section()
        + cta_section()
    )

    return page_shell(
        title=page["title"],
        description=page["description"],
        canonical=f"{EDUCATION_URL}/{page['file']}",
        content=content,
    )


def make_colleges_page() -> str:
    content = (
        hero_html(
            "Explore colleges.<br><span class='gradient-text'>Compare your options.</span>",
            "Use the college directory as a starting point for researching institutions, courses, locations, and official admission information. The starter page does not represent a complete or independently verified register of colleges.",
            "🏫",
            "Colleges",
        )
        + """
<section class="section" aria-labelledby="collegeResearchTitle">
  <div class="container">
    <div class="section-heading">
      <span class="eyebrow">Research framework</span>
      <h2 class="section-title" id="collegeResearchTitle">What to verify before shortlisting.</h2>
      <p class="section-intro">Confirm each detail using the official institution website and the relevant regulator or affiliating university.</p>
    </div>
    <div class="two-col">
      <article class="info-card"><h3>🏛️ Institutional status</h3><ul><li>Official name and campus address</li><li>Affiliating university, where applicable</li><li>Applicable regulator and programme approval</li><li>Current course availability</li></ul></article>
      <article class="info-card"><h3>🎓 Admissions and costs</h3><ul><li>Eligibility and selection process</li><li>Published fees and additional charges</li><li>Official application deadlines</li><li>Hostels, facilities, and student support</li></ul></article>
    </div>
  </div>
</section>
"""
        + notice_section(
            "College information must be checked programme by programme",
            "Affiliation or institutional status does not automatically confirm approval for every course, campus, intake, or academic year. Verify the exact programme and current admission information before paying fees.",
        )
        + official_sources_section()
        + faq_section()
        + cta_section()
    )

    return page_shell(
        title="College Directory and Research Guide | MedOrbits",
        description="Research colleges, programme eligibility, official institutional information, and admission verification steps.",
        canonical=f"{EDUCATION_URL}/colleges.html",
        content=content,
    )


def make_exams_page() -> str:
    exam_items = [
        ("🩺", "NEET UG", "Medical undergraduate entrance examination information.", "https://exams.nta.ac.in/NEET/"),
        ("📝", "CUET", "Check the current Common University Entrance Test notices and participating-institution information.", "https://exams.nta.ac.in/"),
        ("⚙️", "JEE Main", "Consult the official examination authority for engineering entrance notices.", "https://jeemain.nta.nic.in/"),
        ("📊", "CAT", "Use the official Common Admission Test website for current information.", "https://iimcat.ac.in/"),
        ("🏛️", "University-specific exams", "Some institutions publish their own programme-specific admission and selection procedures.", "https://www.ugc.gov.in/"),
        ("🌍", "International tests", "Verify language tests and other requirements with the destination institution and relevant test provider.", "https://www.education.gov.in/"),
    ]

    cards = "".join(
        card_html(
            icon=icon,
            label="Entrance examinations",
            title=title,
            description=desc,
            href=url,
            category="general",
            search=title + " examination admit card result scorecard registration",
            meta="Official source",
            link_label="Open official resource",
        )
        for icon, title, desc, url in exam_items
    )

    content = (
        hero_html(
            "Understand entrance exams.<br><span class='gradient-text'>Prepare with clarity.</span>",
            "Explore a starter list of entrance examination resources. Confirm registration windows, eligibility, examination patterns, fees, correction windows, and results through each exam's official website.",
            "📝",
            "Entrance examinations",
        )
        + directory_controls(
            placeholder="Search NEET, JEE, CUET, CAT or university exams...",
            filters=[("all", "All"), ("general", "Examinations")],
        )
        + results_section(
            cards,
            "Examination resources",
            "Examination schedules and web addresses may change. Always check the latest official notice.",
        )
        + notice_section(
            "Avoid unofficial application links",
            "Use verified official examination websites for registration, payment, admit cards, results, and corrections. Do not share passwords or one-time passwords with third parties.",
        )
        + official_sources_section()
        + faq_section()
        + cta_section()
    )

    return page_shell(
        title="Entrance Examinations and Official Resources | MedOrbits",
        description="Explore entrance examination resources and verify registration, eligibility, schedules, and results through official websites.",
        canonical=f"{EDUCATION_URL}/entrance-exams.html",
        content=content,
    )


# ---------------------------------------------------------------------------
# Generate page catalog
# ---------------------------------------------------------------------------

def make_education_home() -> str:
    cards = "".join(
        card_html(
            icon=item["icon"],
            label="Education directory",
            title=item["title"],
            description=item["description"],
            href=item["href"],
            category="general",
            search=item["id"],
            meta="Explore",
            link_label="Explore section",
        )
        for item in RESOURCE_CATEGORIES
    )

    university_preview = "".join(
        card_html(
            icon="🏛️",
            label=item["type"],
            title=item["name"],
            description=item["description"],
            href="universities.html",
            category="general",
            state=item["state"],
            search=item["short_name"],
            meta=item["state"],
            link_label="Browse university directory",
        )
        for item in UNIVERSITIES[:6]
    )

    content = (
        hero_html(
            "Explore education.<br><span class='gradient-text'>Build your next chapter.</span>",
            "Navigate university and college directories, course pathways, admission guidance, medical education, scholarships, entrance examinations, official documents, and international study resources with MedOrbits.",
            "🎓",
            "Education",
            "universities.html",
            "Explore universities",
        )
        + """
<section class="section" aria-labelledby="educationFeaturesTitle">
  <div class="container">
    <div class="section-heading">
      <span class="eyebrow">Your education workspace</span>
      <h2 class="section-title" id="educationFeaturesTitle">Research. Compare. Verify.</h2>
      <p class="section-intro">Start with a topic, build a shortlist, and confirm important decisions through the relevant official source.</p>
    </div>
    <div class="stats-grid">
      <article class="stat-card"><div class="stat-icon" aria-hidden="true">🏛️</div><h3>Institutions</h3><p>Research university and college websites.</p></article>
      <article class="stat-card"><div class="stat-icon" aria-hidden="true">📚</div><h3>Courses</h3><p>Explore academic and professional pathways.</p></article>
      <article class="stat-card"><div class="stat-icon" aria-hidden="true">🩺</div><h3>Admissions</h3><p>Find medical and general admission guidance.</p></article>
      <article class="stat-card"><div class="stat-icon" aria-hidden="true">🌍</div><h3>Opportunities</h3><p>Research scholarships and international education.</p></article>
    </div>
  </div>
</section>
"""
        + results_section(
            cards,
            "Explore education resources",
            "Use these sections to navigate the MedOrbits education directory.",
        )
        + """
<section class="section section-blue" aria-labelledby="universityPreviewTitle">
  <div class="container">
    <div class="section-heading">
      <span class="eyebrow">Institution discovery</span>
      <h2 class="section-title" id="universityPreviewTitle">Start exploring universities.</h2>
      <p class="section-intro">A small preview from the starter directory. Visit the complete university directory for more entries and filters.</p>
    </div>
    <div class="card-grid">
"""
        + university_preview
        + """
    </div>
    <div class="hero-actions"><a class="btn" href="universities.html">View all universities ↗</a></div>
  </div>
</section>
"""
        + official_sources_section()
        + faq_section()
        + cta_section()
    )

    return page_shell(
        title="Education Directory | Universities, Courses and Admissions | MedOrbits",
        description="Explore university directories, courses, admissions, medical education, scholarships, examinations, documents, and study abroad resources.",
        canonical=f"{EDUCATION_URL}/index.html",
        content=content,
    )


def make_documents_page() -> str:
    document_types = [
        ("📄", "Academic certificates", "Review marksheets, passing certificates, transcripts, and qualification proof."),
        ("🩺", "Entrance examination records", "Check registration confirmations, admit cards, scorecards, and official result notices."),
        ("🪪", "Identity and address proof", "Confirm which identity and address documents are accepted for your application."),
        ("📜", "Category and domicile certificates", "Check the issuing authority, format, date, and validity requirements."),
        ("💰", "Scholarship records", "Prepare the academic and financial evidence requested by the relevant scheme."),
        ("🌍", "International applications", "Research passport, visa, financial, language, and translation requirements."),
    ]

    cards = "".join(
        card_html(
            icon=icon,
            label="Document guidance",
            title=title,
            description=description,
            href="../official-document.html",
            category="general",
            search=title,
            meta="Verify requirements",
            link_label="Open document guidance",
        )
        for icon, title, description in document_types
    )

    content = (
        hero_html(
            "Prepare your documents.<br><span class='gradient-text'>Check every detail.</span>",
            "Use document preparation guidance to organise academic, examination, identity, scholarship, and international application records. The final requirements depend on the relevant authority and application.",
            "📂",
            "Document resources",
            "../official-document.html",
            "Open document directory",
        )
        + results_section(
            cards,
            "Common document categories",
            "These categories are general preparation guidance, not a guaranteed list of documents for any specific application.",
        )
        + notice_section(
            "Protect your personal information",
            "Only submit documents through verified, authorised portals when required. This page does not collect or upload your documents. Never share passwords or one-time passwords.",
        )
        + official_sources_section()
        + cta_section()
    )

    return page_shell(
        title="Education Document Resources | MedOrbits",
        description="Organise education application documents and verify official requirements for admissions, examinations, scholarships, and international study.",
        canonical=f"{EDUCATION_URL}/documents.html",
        content=content,
    )


# ---------------------------------------------------------------------------
# Supporting files
# ---------------------------------------------------------------------------

def add_data_files() -> None:
    add_file("education/data/universities.json", json_text({
        "schema_version": "1.0.0",
        "generated_by": "MedOrbits Education Repository Builder",
        "updated_date": date.today().isoformat(),
        "notice": (
            "Starter discovery catalog. Not exhaustive. Verify institution "
            "details and programme recognition through official authorities."
        ),
        "universities": UNIVERSITIES,
    }))

    add_file("education/data/courses.json", json_text({
        "schema_version": "1.0.0",
        "generated_by": "MedOrbits Education Repository Builder",
        "updated_date": date.today().isoformat(),
        "notice": (
            "Starter course catalog. Availability, eligibility and regulation "
            "must be confirmed with the relevant institution and authority."
        ),
        "courses": COURSES,
    }))

    add_file("education/data/categories.json", json_text({
        "schema_version": "1.0.0",
        "categories": RESOURCE_CATEGORIES,
    }))

    add_file("education/data/faqs.json", json_text({
        "schema_version": "1.0.0",
        "faqs": FAQS,
    }))

    add_file("education/data/education-config.json", json_text({
        "site_name": "MedOrbits",
        "base_url": SITE_URL,
        "education_base_url": EDUCATION_URL,
        "default_language": "en-IN",
        "theme": "sapphire-blue-champagne",
        "directories": {
            "universities": "data/universities.json",
            "courses": "data/courses.json",
            "categories": "data/categories.json",
            "faqs": "data/faqs.json",
        },
        "features": {
            "client_side_search": True,
            "category_filtering": True,
            "state_filtering": True,
            "responsive_layout": True,
            "reduced_motion_support": True,
        },
    }))

    university_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "MedOrbits Universities Catalog",
        "type": "object",
        "required": ["schema_version", "universities"],
        "properties": {
            "schema_version": {"type": "string"},
            "updated_date": {"type": "string", "format": "date"},
            "notice": {"type": "string"},
            "universities": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": [
                        "id", "name", "state", "type", "website",
                        "description", "categories",
                    ],
                    "properties": {
                        "id": {"type": "string"},
                        "name": {"type": "string"},
                        "short_name": {"type": "string"},
                        "state": {"type": "string"},
                        "type": {"type": "string"},
                        "website": {"type": "string", "format": "uri"},
                        "description": {"type": "string"},
                        "categories": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                        "verification_note": {"type": "string"},
                    },
                    "additionalProperties": True,
                },
            },
        },
        "additionalProperties": True,
    }

    add_file("education/schemas/universities.schema.json", json_text(university_schema))

    add_file("education/schemas/courses.schema.json", json_text({
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "MedOrbits Courses Catalog",
        "type": "object",
        "required": ["schema_version", "courses"],
        "properties": {
            "schema_version": {"type": "string"},
            "courses": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": [
                        "id", "name", "category", "level", "description",
                        "url", "official_source",
                    ],
                    "properties": {
                        "id": {"type": "string"},
                        "name": {"type": "string"},
                        "category": {"type": "string"},
                        "level": {"type": "string"},
                        "description": {"type": "string"},
                        "url": {"type": "string"},
                        "official_source": {"type": "string", "format": "uri"},
                    },
                },
            },
        },
    }))


def add_documentation() -> None:
    add_file("education/README.md", r"""
# MedOrbits Education Directory

This directory contains static education pages, shared presentation assets,
JSON catalogs, schemas, and validation helpers.

## Main pages

- `index.html` -- education hub
- `universities.html` -- university directory
- `universitiy.html` -- compatibility alias for the misspelled filename
- `colleges.html` -- college research guide
- `courses.html` -- course catalog
- `admissions.html` -- admissions resources
- `medical-admissions.html` -- medical education guidance
- `entrance-exams.html` -- examination resources
- `scholarships.html` -- scholarship guidance
- `study-abroad.html` -- international education guidance
- `documents.html` -- document preparation resources

## Shared assets

- `assets/css/education.css`
- `assets/js/education.js`

## Data

- `data/universities.json`
- `data/courses.json`
- `data/categories.json`
- `data/faqs.json`
- `data/education-config.json`

JSON schemas are in `schemas/`.

## Important limitations

The catalog is a starter dataset, not an exhaustive national directory.
University, course, regulator, recognition, admission, fee, and deadline
information must be verified with the relevant official source.

The pages are static. They do not include a backend, authentication, a database,
document uploads, application submission, or a live API connection.

## Regenerate

From the repository root:

```bash
python build_education_repository.py
python build_education_repository.py --validate
""")
